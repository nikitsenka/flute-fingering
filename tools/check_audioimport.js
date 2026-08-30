/* Checks the half of audio import that turns heard notes into a written piece.
 *
 * The listener is not involved. audiopitch.js answers "what was played, in
 * hertz and seconds"; everything here answers "how is that written down", and
 * the two are checked apart on purpose -- a rhythm bug and a tracking bug look
 * nothing alike and should not be able to hide behind one another. So the
 * recordings below are not audio at all: they are the note events a listener
 * would have produced, written out by hand, including the ones a human player
 * produces rather than a metronome.
 *
 * What this pins down is the part that will actually be wrong in the field:
 * a note held 0.94 of a beat is a quarter, a gap of a few hundredths is not a
 * rest, a note that runs past a barline has to be cut at it, and every bar has
 * to come out holding exactly what its time signature says -- the same rule
 * tools/check_songs.js applies to the pieces that ship.
 *
 *     node tools/check_audioimport.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");

var sandbox = {window:{}, document:{documentElement:{}}};
sandbox.global = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js", "notenames.js", "durations.js",
 "instruments.js", "instruments/flute.js", "instruments/piano.js",
 "audioimport.js"].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});

var AudioImport = sandbox.window.AudioImport;
var BEATS = sandbox.window.DURATIONS.beats;
var perBar = sandbox.window.DURATIONS.perBar;

var problems = [];
function check(what, ok, detail){
  if(!ok){ problems.push(what + (detail ? ": " + detail : "")); }
}

/* A recording, as the listener would have described it. `at` and `dur` are in
   seconds, and 60 bpm makes a beat one second, so the numbers below read as
   beats while still exercising the conversion. */
function heard(notes, extra){
  var e = extra || {};
  return {
    kind: "audio", samples: null, rate: 16000, seconds: e.seconds || 30,
    heard: {
      notes: notes.map(function(n){
        return {midi:n[0], cents:n[2] || 0, t:n[1][0], dur:n[1][1], conf:n[3] === undefined ? 0.9 : n[3]};
      }),
      tempo: {bpm: e.bpm || 60, conf: e.tempoConf === undefined ? 0.9 : e.tempoConf},
      source: {verdict: e.verdict || "mono", share: 1}
    }
  };
}

function codes(score){
  return score.measures.map(function(m){
    return m.notes.map(function(n){ return n[0] + ":" + n[1]; }).join(" ");
  });
}

/* every bar full, whatever the signature -- the rule the shipped pieces obey */
function barsAddUp(where, result, time){
  var want = perBar(time || "4/4");
  result.score.measures.forEach(function(m){
    var sum = 0;
    m.notes.forEach(function(n){ sum += BEATS[n[1]]; });
    check(where + " bar " + m.n + " full", Math.abs(sum - want) < 1e-9,
          sum + " beats, expected " + want);
  });
}

/* ---------- a metronome ---------- */
(function(){
  var notes = [];
  for(var i = 0; i < 8; i++){ notes.push([60 + i, [i, 0.9]]); }
  var audio = heard(notes);
  var line = AudioImport.analyze(audio)[0];
  check("clean: one line", !!line, "none");
  check("clean: counted", line.notes === 8, line.notes + " notes");
  check("clean: range", line.lo === 60 && line.hi === 67, line.lo + ".." + line.hi);

  var out = AudioImport.convert(audio, line, {});
  check("clean: bars", out.score.measures.length === 2, out.score.measures.length + " bars");
  check("clean: all quarters", codes(out.score)[0] === "c/4:q c#/4:q d/4:q d#/4:q",
        codes(out.score)[0]);
  check("clean: nothing to report", out.report.problems.length === 0,
        out.report.problems.join(" | "));
  barsAddUp("clean:", out);
})();

/* ---------- the same thing played by a person ----------
   Attacks early and late by up to a twelfth of a beat, notes released early:
   the grid has to absorb all of it and produce the same eight quarters. */
(function(){
  var jitter = [0, 0.06, -0.05, 0.07, -0.08, 0.04, 0.05, -0.06];
  var notes = jitter.map(function(j, i){ return [60 + i, [i + j, 0.6 + (i % 3) * 0.1]]; });
  var audio = heard(notes);
  var out = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {});
  check("human: bars", out.score.measures.length === 2, out.score.measures.length + " bars");
  check("human: still quarters", codes(out.score).join(" | ") ===
        "c/4:q c#/4:q d/4:q d#/4:q | e/4:q f/4:q f#/4:q g/4:q", codes(out.score).join(" | "));
  check("human: short gaps are not rests",
        codes(out.score).join(" ").indexOf("R:") < 0, "a rest crept in");
  barsAddUp("human:", out);
})();

/* ---------- lengths that are not all the same ---------- */
(function(){
  var audio = heard([
    [60, [0, 1.9]],      /* half            */
    [62, [2, 0.9]],      /* quarter         */
    [64, [3, 0.45]],     /* eighth          */
    [65, [3.5, 0.45]],   /* eighth          */
    [67, [4, 1.4]],      /* dotted quarter  */
    [69, [5.5, 0.4]],    /* eighth          */
    [71, [6, 1.9]]       /* half            */
  ]);
  var out = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {});
  check("mixed: bar 1", codes(out.score)[0] === "c/4:h d/4:q e/4:8 f/4:8", codes(out.score)[0]);
  check("mixed: bar 2", codes(out.score)[1] === "g/4:qd a/4:8 b/4:h", codes(out.score)[1]);
  barsAddUp("mixed:", out);
})();

/* ---------- a real silence becomes a rest ---------- */
(function(){
  var audio = heard([
    [60, [0, 0.9]],
    [62, [1, 0.9]],
    [64, [3, 0.9]],      /* a beat of nothing before this one */
    [65, [4, 0.9]]
  ]);
  var out = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {});
  check("rest: written", codes(out.score)[0] === "c/4:q d/4:q R:q e/4:q", codes(out.score)[0]);
  barsAddUp("rest:", out);
})();

/* ---------- a note that runs past the barline ---------- */
(function(){
  var audio = heard([
    [60, [0, 2.9]],      /* three beats     */
    [62, [3, 1.9]],      /* two, from beat 3 -- one of them in the next bar */
    [64, [5, 2.9]]
  ]);
  var out = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {});
  barsAddUp("barline:", out);
  check("barline: cut", codes(out.score)[0] === "c/4:hd d/4:q" && codes(out.score)[1].indexOf("d/4:q") === 0,
        codes(out.score).join(" | "));
  check("barline: reported", out.report.problems.some(function(p){ return /across a barline/.test(p); }),
        out.report.problems.join(" | "));
})();

/* ---------- a waltz, so the signature is not decoration ---------- */
(function(){
  var notes = [];
  for(var i = 0; i < 6; i++){ notes.push([60 + i, [i, 0.9]]); }
  var audio = heard(notes);
  var out = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {time:"3/4"});
  check("waltz: bars", out.score.measures.length === 2, out.score.measures.length + " bars");
  check("waltz: signature kept", out.score.time === "3/4", out.score.time);
  barsAddUp("waltz:", out, "3/4");
})();

/* ---------- what the player has to be told ---------- */
(function(){
  var audio = heard([[60, [0, 0.9]], [62, [1, 0.9]]], {verdict:"dense", tempoConf:0.2});
  var out = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {});
  check("warnings: mix named", out.report.problems.some(function(p){ return /more than one instrument/.test(p); }),
        out.report.problems.join(" | "));
  check("warnings: guessed tempo named", out.report.problems.some(function(p){ return /tempo was guessed/.test(p); }),
        out.report.problems.join(" | "));

  var stated = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {bpm:96});
  check("warnings: a stated tempo is not guessed",
        !stated.report.problems.some(function(p){ return /tempo was guessed/.test(p); }),
        stated.report.problems.join(" | "));
  check("warnings: stated tempo used", stated.report.bpm === 96, String(stated.report.bpm));
})();

/* ---------- out-of-tune and unsure notes are flagged, not hidden ---------- */
(function(){
  var audio = heard([[60, [0, 0.9], 45], [62, [1, 0.9], 0, 0.4], [64, [2, 0.9]], [65, [3, 0.9]]]);
  var out = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {});
  check("flags: off pitch", out.report.problems.some(function(p){ return /off pitch/.test(p); }),
        out.report.problems.join(" | "));
  check("flags: low confidence", out.report.problems.some(function(p){ return /low confidence/.test(p); }),
        out.report.problems.join(" | "));
})();

/* ---------- octave slips, which the listener cannot see itself ----------
   The flute spans 23 semitones (c/4..b/5). A line wider than that cannot be
   made to fit by any shift, so it is evidence of mishearing rather than of a
   piece in the wrong register -- and a line that keeps leaping exactly twelve
   semitones and coming back is the same thing seen from another angle. */
(function(){
  /* a plain melody, well inside the instrument: nothing to say */
  var calm = heard([[60, [0, 0.9]], [62, [1, 0.9]], [64, [2, 0.9]], [65, [3, 0.9]],
                    [67, [4, 0.9]], [65, [5, 0.9]], [64, [6, 0.9]], [62, [7, 0.9]]]);
  var line = AudioImport.analyze(calm)[0];
  check("slips: a calm line is clear", line.trouble.verdict === "clear",
        JSON.stringify(line.trouble));
  var out = AudioImport.convert(calm, line, {});
  check("slips: nothing reported for it",
        !out.report.problems.some(function(p){ return /octave|semitones/.test(p); }),
        out.report.problems.join(" | "));

  /* one real octave leap in the middle of a tune is music, not a slip */
  var leap = heard([[60, [0, 0.9]], [72, [1, 0.9]], [71, [2, 0.9]], [69, [3, 0.9]],
                    [67, [4, 0.9]], [65, [5, 0.9]], [64, [6, 0.9]], [62, [7, 0.9]]]);
  check("slips: a single leap is not a slip",
        AudioImport.analyze(leap)[0].trouble.verdict === "clear",
        JSON.stringify(AudioImport.analyze(leap)[0].trouble));

  /* wider than the instrument physically is */
  var wide = heard([[40, [0, 0.9]], [84, [1, 0.9]], [60, [2, 0.9]], [62, [3, 0.9]],
                    [45, [4, 0.9]], [64, [5, 0.9]], [80, [6, 0.9]], [50, [7, 0.9]]]);
  var wideLine = AudioImport.analyze(wide)[0];
  check("slips: too wide for the flute", wideLine.trouble.verdict === "wide",
        JSON.stringify(wideLine.trouble));
  var wideOut = AudioImport.convert(wide, wideLine, {});
  check("slips: the width is reported",
        wideOut.report.problems.some(function(p){ return /span .* semitones/.test(p); }),
        wideOut.report.problems.join(" | "));

  /* in range, but leaping the octave over and over */
  var jumpy = heard([[60, [0, 0.9]], [72, [1, 0.9]], [60, [2, 0.9]], [72, [3, 0.9]],
                     [62, [4, 0.9]], [74, [5, 0.9]], [64, [6, 0.9]], [65, [7, 0.9]]]);
  var jumpyLine = AudioImport.analyze(jumpy)[0];
  check("slips: jumpy is caught", jumpyLine.trouble.verdict === "jumpy",
        JSON.stringify(jumpyLine.trouble));
  var jumpyOut = AudioImport.convert(jumpy, jumpyLine, {});
  check("slips: the leaps are reported",
        jumpyOut.report.problems.some(function(p){ return /exactly an octave apart/.test(p); }),
        jumpyOut.report.problems.join(" | "));

  /* The listener says "one voice" on exactly this case, because it measures
     from the fundamental that slipped. Two verdicts that disagree would be a
     trap for whoever read the wrong one, so the line carries one answer. */
  check("slips: the line's verdict agrees with the trouble",
        jumpyLine.source.verdict === "suspect", jumpyLine.source.verdict);
  check("slips: the listener's own reading is kept",
        jumpyLine.source.heard === "mono", JSON.stringify(jumpyLine.source));
  /* A line that came out entirely under the instrument. This one is genuinely
     ambiguous -- a cello part reads the same way -- so what is checked is that
     it is raised at all, and the wording offers both readings rather than
     picking one. */
  var low = heard([[40, [0, 0.9]], [42, [1, 0.9]], [44, [2, 0.9]], [45, [3, 0.9]],
                   [47, [4, 0.9]], [45, [5, 0.9]], [44, [6, 0.9]], [42, [7, 0.9]]]);
  var lowLine = AudioImport.analyze(low)[0];
  check("slips: a line under the instrument is raised", lowLine.trouble.verdict === "below",
        JSON.stringify(lowLine.trouble));
  check("slips: and reported",
        AudioImport.convert(low, lowLine, {}).report.problems
          .some(function(p){ return /below the instrument's range/.test(p); }),
        AudioImport.convert(low, lowLine, {}).report.problems.join(" | "));

  check("slips: a clear line keeps the listener's verdict",
        AudioImport.analyze(calm)[0].source.verdict === "mono",
        AudioImport.analyze(calm)[0].source.verdict);
})();

/* ---------- an octave shift moves the whole line ---------- */
(function(){
  var audio = heard([[48, [0, 0.9]], [50, [1, 0.9]], [52, [2, 0.9]], [53, [3, 0.9]]]);
  var line = AudioImport.analyze(audio)[0];
  var out = AudioImport.convert(audio, line, {octave:1});
  check("shift: pitches moved", codes(out.score)[0] === "c/4:q d/4:q e/4:q f/4:q", codes(out.score)[0]);
  check("shift: reported pitches", out.report.pitches.join(",") === "c/4,d/4,e/4,f/4",
        out.report.pitches.join(","));
})();

/* ---------- nothing heard ---------- */
(function(){
  var audio = heard([]);
  check("empty: analyze says nothing", AudioImport.analyze(audio).length === 0, "a line appeared");
  var threw = false;
  try { AudioImport.convert(audio, null, {}); } catch(e){ threw = /no notes/.test(e.message); }
  check("empty: convert refuses", threw, "it did not refuse");
})();

/* ---------- what a flute cannot play is named ---------- */
(function(){
  var audio = heard([[60, [0, 0.9]], [40, [1, 0.9]], [62, [2, 0.9]], [64, [3, 0.9]]]);
  var out = AudioImport.convert(audio, AudioImport.analyze(audio)[0], {});
  check("range: unplayable listed", out.report.missing.indexOf("e/2") >= 0,
        out.report.missing.join(",") || "nothing listed");
})();

if(problems.length){
  console.log("audioimport: " + problems.length + " problem(s)");
  problems.forEach(function(p){ console.log("  " + p); });
  process.exit(1);
}
console.log("audioimport: ok -- played by a person, a waltz, a barline split, rests, "
          + "warnings, octave slips and an octave shift");
