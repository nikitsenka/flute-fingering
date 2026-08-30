/* Checks that the two halves of audio import fit together.
 *
 * check_audiopitch.js proves the listener hears the right notes out of a
 * signal. check_audioimport.js proves the writer turns note events into bars
 * correctly. Neither one runs the other, on purpose -- a tracking bug and a
 * rhythm bug should not be able to hide behind each other -- which leaves
 * exactly one thing unproven: that what the first hands over is what the
 * second expects. Two people wrote those files against a written interface,
 * and a written interface is precisely the sort of thing both sides can obey
 * while still disagreeing about seconds versus beats, or about whether a
 * confidence is a fraction or a percentage.
 *
 * So this runs the whole way through, from samples to a piece: synthesise a
 * scale a flute could have played, and require the score that comes out to
 * hold those pitches, in bars, at the tempo it was played at.
 *
 * The signal is synthetic, and everything the header of check_audiopitch.js
 * says about that applies here too: no room, no breath, no phone microphone.
 * This shows the seam holds. It does not show that importing a real recording
 * works, and one real recording would tell us more than all of it.
 *
 *     node tools/check_import_chain.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");

var sandbox = {window:{}, document:{documentElement:{}}};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js", "notenames.js", "durations.js",
 "instruments.js", "instruments/flute.js", "instruments/piano.js",
 "audiopitch.js", "audioimport.js"].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});

var AudioImport = sandbox.window.AudioImport;

var problems = [];
function check(what, ok, detail){
  if(!ok){ problems.push(what + (detail ? ": " + detail : "")); }
}

var RATE = 44100;

/* A tone with the shape of a flute's: a strong fundamental, two harmonics
   fading above it, a soft attack and a little breath. Not an imitation -- just
   enough structure that the tracker is not handed a bare sine, which is the
   one signal every pitch detector gets right. */
function play(midis, bpm, hold){
  var beat = 60 / bpm;
  var total = Math.round(RATE * beat * midis.length);
  var buf = new Float32Array(total);

  midis.forEach(function(m, i){
    var f = 440 * Math.pow(2, (m - 69) / 12);
    var start = Math.round(i * beat * RATE);
    var len = Math.round(beat * RATE * hold);
    for(var n = 0; n < len; n++){
      var t = n / RATE;
      var env = Math.min(1, t / 0.02) * Math.min(1, (len - n) / RATE / 0.03);
      buf[start + n] = env * (
        0.60 * Math.sin(2 * Math.PI * f * t) +
        0.25 * Math.sin(4 * Math.PI * f * t) +
        0.10 * Math.sin(6 * Math.PI * f * t) +
        0.01 * (Math.random() - 0.5)
      );
    }
  });

  return {kind:"audio", samples:buf, rate:RATE, seconds:total / RATE, heard:null};
}

function codes(score){
  return score.measures.map(function(m){
    return m.notes.map(function(n){ return n[0] + ":" + n[1]; }).join(" ");
  });
}

/* D major, the scale a flute walks when it closes one hole at a time -- and
   every note of it inside the instrument's range, so the report should have
   nothing to complain about. */
(function(){
  var audio = play([62, 64, 66, 67, 69, 71, 73, 74], 120, 0.85);
  var lines = AudioImport.analyze(audio);
  check("chain: a line came back", lines.length === 1, lines.length + " lines");
  if(!lines.length){ return; }

  var line = lines[0];
  check("chain: eight notes heard", line.notes === 8, line.notes + " notes");
  check("chain: range", line.lo === 62 && line.hi === 74, line.lo + ".." + line.hi);
  check("chain: all playable on a flute", line.share === 1, Math.round(line.share * 100) + "%");
  check("chain: heard as one voice", line.source.verdict === "mono", line.source.verdict);
  check("chain: tempo within 5%", Math.abs(line.tempo.bpm - 120) < 6,
        Math.round(line.tempo.bpm) + " bpm");

  var out = AudioImport.convert(audio, line, {});
  check("chain: two bars", out.report.bars === 2, out.report.bars + " bars");
  check("chain: the scale, in quarters",
        codes(out.score).join(" | ") ===
        "d/4:q e/4:q f#/4:q g/4:q | a/4:q b/4:q c#/5:q d/5:q",
        codes(out.score).join(" | "));
  check("chain: nothing to report", out.report.problems.length === 0,
        out.report.problems.join(" | "));
})();

/* Half the tempo and twice the length: the same notes have to come out, which
   is what says the writer is reading the listener's seconds rather than
   assuming a beat. */
(function(){
  var audio = play([67, 69, 71, 72], 60, 0.9);
  var line = AudioImport.analyze(audio)[0];
  var out = AudioImport.convert(audio, line, {});
  check("slow: tempo", Math.abs(line.tempo.bpm - 60) < 4, Math.round(line.tempo.bpm) + " bpm");
  check("slow: one bar of quarters", codes(out.score).join(" | ") === "g/4:q a/4:q b/4:q c/5:q",
        codes(out.score).join(" | "));
})();

/* ---------- a second voice under the tune ----------
   The failure everyone expects from a single-pitch tracker, and the reason the
   whole chain carries warnings at all. What matters is not that the notes come
   out right -- with two voices sounding they often cannot -- but that every
   case where they come out WRONG is one the player is told about.

   Measurement, across the intervals a second part actually sits at, says
   something better than we assumed. Every harmful case raises something: a
   third, a sixth, or an independently moving line under the melody all end up
   flagged, because what the tracker returns is neither voice and lands outside
   the instrument. The one case that raises nothing is a parallel octave
   doubling -- and there the tracker returns the melody itself, note for note,
   an octave down, which the octave control in the dialog fixes completely.

   So the untested claim to keep honest is exactly this: silence is only ever
   allowed when the notes are right. */

function withSecondVoice(melody, second, bpm){
  var beat = 60 / bpm;
  var total = Math.round(RATE * beat * melody.length);
  var buf = new Float32Array(total);

  [{midis:melody, gain:0.35, duty:0.25}, {midis:second, gain:0.30, duty:0.5}].forEach(function(v){
    v.midis.forEach(function(m, i){
      var f = 440 * Math.pow(2, (m - 69) / 12);
      var start = Math.round(i * beat * RATE);
      var len = Math.round(beat * RATE * 0.9);
      for(var n = 0; n < len && start + n < total; n++){
        var t = n / RATE;
        var env = Math.min(1, (len - n) / RATE / 0.01);
        /* a pulse wave: two of them at once is the hardest thing to tell apart,
           and closer to an arrangement than two sines would be */
        buf[start + n] += v.gain * env * (((f * t) % 1) < v.duty ? 1 : -1);
      }
    });
  });

  return {kind:"audio", samples:buf, rate:RATE, seconds:total / RATE, heard:null};
}

(function(){
  var MELODY = [72, 74, 76, 77, 79, 77, 76, 74];
  function under(semitones){ return MELODY.map(function(m){ return m - semitones; }); }

  function heardMidis(audio){
    return audio.heard.notes.map(function(n){ return Math.round(n.midi); });
  }
  function quiet(line){
    return line.source.verdict === "mono" && line.trouble.verdict === "clear";
  }

  /* harmful: what comes back is neither voice, and the player has to be told */
  [["a third below", under(4)],
   ["a sixth below", under(9)],
   ["a line moving on its own", [65, 64, 65, 67, 65, 64, 62, 64]]].forEach(function(pair){
    var audio = withSecondVoice(MELODY, pair[1], 120);
    var line = AudioImport.analyze(audio)[0];
    var got = heardMidis(audio);
    var right = got.length === MELODY.length && got.every(function(v, i){ return v === MELODY[i]; });
    check("second voice: " + pair[0] + " is not passed off as clean",
          right || !quiet(line),
          "heard " + got.join(" ") + " with verdict " + line.source.verdict +
          "/" + line.trouble.verdict + " and said nothing");
  });

  /* benign: a parallel octave, where nothing is raised because nothing is wrong
     except the register -- and the dialog's octave control is exactly that */
  var octave = withSecondVoice(MELODY, under(12), 120);
  var octaveLine = AudioImport.analyze(octave)[0];
  var got = heardMidis(octave);
  var melodyDown = got.length === MELODY.length &&
                   got.every(function(v, i){ return v === MELODY[i] - 12; });
  check("second voice: an octave doubling gives the melody, an octave down", melodyDown,
        "heard " + got.join(" "));
  if(melodyDown){
    var lifted = AudioImport.convert(octave, octaveLine, {octave:1});
    check("second voice: and the octave control puts it right",
          codes(lifted.score).join(" | ") === "c/5:q d/5:q e/5:q f/5:q | g/5:q f/5:q e/5:q d/5:q",
          codes(lifted.score).join(" | "));
  }
})();

if(problems.length){
  console.log("import chain: " + problems.length + " problem(s)");
  problems.forEach(function(p){ console.log("  " + p); });
  process.exit(1);
}
console.log("import chain: ok -- a scale in bars at the tempo it was played, and a second "
          + "voice under the tune either warned about or harmless");
