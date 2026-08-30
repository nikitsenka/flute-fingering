/* Checks that audiopitch.js hears what was played, on signals built here so
 * that "what was played" is known exactly.
 *
 * check_pitch.js proves the app's note table and frequency formula agree with
 * equal temperament. This is the same idea pointed the other way: a waveform is
 * built from a list of notes, handed to the detector, and what comes back is
 * compared with the list. Pitch, the moment each note starts, how long it
 * lasts, how many there are.
 *
 * The cases are chosen to be the ones that break pitch detectors, not the ones
 * that flatter them:
 *
 *   melody       an ordinary line with harmonics -- the baseline
 *   pure sine    a bare sine high up, the textbook octave-down trap. Kept
 *                because it is the classic statement of the problem, but be
 *                warned: it does NOT catch the naive rule. Replacing "first
 *                dip below the threshold" with "deepest dip" leaves this case
 *                green and breaks `hollow` and `melody` instead, which are
 *                therefore the cases actually guarding the octave.
 *   hollow tone  a weak fundamental under a strong second harmonic. Tempts a
 *                loose threshold into locking onto the harmonic and reporting
 *                an octave high, and a deepest-dip rule into the opposite.
 *   struck twice the same pitch played twice in a row, which is one long note
 *                unless the second attack is noticed
 *   quiet take   the melody at a fiftieth of the level, as a phone across the
 *                room records it: the same notes must come out
 *   hiss         noise and silence, which must yield no notes at all
 *   chord        three pitches at once, which must be reported as not one line
 *                rather than transcribed as whichever is loudest
 *
 * What this does NOT check: real playing. There is no breath noise here, no
 * room, no vibrato, no automatic gain riding the level, and every note starts
 * exactly where it was asked to. Synthetic signals can prove the arithmetic and
 * catch a regression; they cannot say the thresholds are right for a flute in a
 * kitchen. That needs a recording, and until one exists this check should not
 * be read as saying audio import works.
 *
 *     node tools/check_audiopitch.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");

/* audiopitch.js is a browser script sharing one global, like everything else
   the checks load -- see check_songs.js for the same sandbox. */
var sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "audiopitch.js"), "utf8"), sandbox,
                {filename: "audiopitch.js"});
var AudioPitch = sandbox.AudioPitch;

var SR = 44100;

/* ---------- building signals ---------- */

function hz(midi){ return 440 * Math.pow(2, (midi - 69) / 12); }

/* One note: partials at the given relative amplitudes, with an attack and a
   release steep enough to be heard as a note boundary but not so steep they
   click. The click matters -- a step edge is broadband, and a detector could
   pass by finding the edges rather than the pitch. */
function tone(buf, at, midi, seconds, partials, level){
  var f0 = hz(midi);
  var start = Math.round(at * SR);
  var n = Math.round(seconds * SR);
  var attack = Math.round(0.008 * SR);
  var release = Math.round(0.030 * SR);

  for(var i = 0; i < n; i++){
    var env = 1;
    if(i < attack){ env = i / attack; }
    else if(i > n - release){ env = Math.max(0, (n - i) / release); }

    var s = 0;
    for(var p = 0; p < partials.length; p++){
      s += partials[p] * Math.sin(2 * Math.PI * f0 * (p + 1) * i / SR);
    }
    if(start + i < buf.length){ buf[start + i] += level * env * s; }
  }
}

function silence(seconds){ return new Float32Array(Math.round(seconds * SR)); }

/* A plain line: fundamental plus a couple of partials, the way most wind and
   string instruments actually look. */
var VOICE = [1, 0.5, 0.25, 0.12];

/* ---------- the cases ---------- */

var problems = [];
var lines = [];

function report(name, text){ lines.push("  " + pad(name, 14) + text); }
function fail(name, text){ problems.push(name + ": " + text); }
function pad(s, n){ s = String(s); while(s.length < n){ s += " "; } return s; }

/* Compares what came back against the list the signal was built from. */
function expectNotes(name, got, want, opts){
  opts = opts || {};
  var onsetTol = opts.onset || 0.035;
  var durTol = opts.dur || 0.090;

  if(got.length !== want.length){
    fail(name, "found " + got.length + " notes, expected " + want.length +
               " [" + got.map(function(n){ return n.midi + "@" + n.t.toFixed(2); }).join(" ") + "]");
    return;
  }
  for(var i = 0; i < want.length; i++){
    var g = got[i], w = want[i];
    if(g.midi !== w.midi){
      fail(name, "note " + (i + 1) + ": midi " + g.midi + ", expected " + w.midi +
                 " (off by " + (g.midi - w.midi) + " semitones)");
    }
    if(Math.abs(g.t - w.t) > onsetTol){
      fail(name, "note " + (i + 1) + ": starts at " + g.t.toFixed(3) +
                 "s, expected " + w.t.toFixed(3) + "s");
    }
    if(Math.abs(g.dur - w.dur) > durTol){
      fail(name, "note " + (i + 1) + ": lasts " + g.dur.toFixed(3) +
                 "s, expected " + w.dur.toFixed(3) + "s");
    }
  }
}

/* ---------- melody: the baseline ---------- */
(function(){
  var want = [
    {midi: 72, t: 0.10, dur: 0.45},   /* C5 */
    {midi: 74, t: 0.65, dur: 0.45},   /* D5 */
    {midi: 76, t: 1.20, dur: 0.45},   /* E5 */
    {midi: 67, t: 1.75, dur: 0.45}    /* G4, a leap down */
  ];
  var buf = silence(2.5);
  want.forEach(function(w){ tone(buf, w.t, w.midi, w.dur, VOICE, 0.3); });

  var out = AudioPitch.notes(buf, SR);
  expectNotes("melody", out.notes, want);
  if(out.source.verdict !== "mono"){
    fail("melody", "read as " + out.source.verdict + ", expected mono");
  }
  report("melody", out.notes.length + " notes, " + out.source.verdict +
                   ", aperiodicity " + out.source.aperiodicity);
})();

/* ---------- pure sine: the classic octave-down trap ----------
   A bare sine repeats just as well at two periods as at one. A detector that
   takes the deepest dip in the difference function rather than the first one
   below its threshold reports this an octave low, and reports it confidently. */
(function(){
  var want = [{midi: 91, t: 0.10, dur: 0.60}];   /* G6, 1568 Hz */
  var buf = silence(1.0);
  tone(buf, 0.10, 91, 0.60, [1], 0.3);

  var out = AudioPitch.notes(buf, SR);
  expectNotes("pure sine", out.notes, want);
  /* And in tune, which is a separate claim from being the right note. This is
     the highest note in the file, so it is where the decimated signal is
     coarsest -- a period up here is a handful of samples, and without the
     refinement pass this reads a quarter of a semitone sharp while still
     naming the right note. Assert it here or that pass is unguarded. */
  if(out.notes.length === 1 && Math.abs(out.notes[0].cents) > 10){
    fail("pure sine", "reads " + out.notes[0].cents +
                      " cents off a note built exactly in tune");
  }
  report("pure sine", out.notes.length ? "midi " + out.notes[0].midi +
         " (" + out.notes[0].cents + " cents)" : "nothing found");
})();

/* ---------- hollow tone: the octave-up trap ----------
   The fundamental is a fifth of the second harmonic, which happens on a flute
   pushed into its upper register and on a badly placed microphone. The
   waveform still repeats at the fundamental, but only just, so a threshold set
   too loose finds the harmonic's shorter period first and calls the note an
   octave too high. */
(function(){
  var want = [{midi: 62, t: 0.10, dur: 0.60}];   /* D4 */
  var buf = silence(1.0);
  tone(buf, 0.10, 62, 0.60, [0.2, 1.0, 0.4, 0.2], 0.3);

  var out = AudioPitch.notes(buf, SR);
  expectNotes("hollow", out.notes, want);
  report("hollow", out.notes.length ? "midi " + out.notes[0].midi +
         " (" + out.notes[0].cents + " cents)" : "nothing found");
})();

/* ---------- forty cents sharp ----------
   `cents` is what an intonation reading would be built on, so it has to be a
   measurement and not a decoration. Two things are checked here as a pair: a
   note built deliberately out of tune is reported as out of tune by roughly
   the right amount, and a note built exactly in tune is reported as in tune.
   Only together do they mean anything -- a detector that always answered zero
   would pass the second on its own. */
(function(){
  var buf = silence(1.0);
  var f = 440 * Math.pow(2, 40 / 1200);          /* A4, sharp by 40 cents */
  var start = Math.round(0.10 * SR);
  var n = Math.round(0.60 * SR);
  for(var i = 0; i < n; i++){
    var env = Math.max(0, Math.min(1, i / (0.008 * SR), (n - i) / (0.030 * SR)));
    var s = 0;
    for(var p = 0; p < VOICE.length; p++){
      s += VOICE[p] * Math.sin(2 * Math.PI * f * (p + 1) * i / SR);
    }
    buf[start + i] += 0.3 * env * s;
  }

  var out = AudioPitch.notes(buf, SR);
  if(out.notes.length !== 1){
    fail("detuned", "found " + out.notes.length + " notes, expected 1");
  } else {
    var got = out.notes[0];
    if(got.midi !== 69){ fail("detuned", "midi " + got.midi + ", expected 69"); }
    if(Math.abs(got.cents - 40) > 12){
      fail("detuned", "reported " + got.cents + " cents, expected about 40");
    }
    report("detuned", "midi " + got.midi + ", " + got.cents + " cents (built 40 sharp)");
  }
})();

(function(){
  var buf = silence(1.0);
  tone(buf, 0.10, 74, 0.60, VOICE, 0.3);
  var out = AudioPitch.notes(buf, SR);
  if(out.notes.length === 1 && Math.abs(out.notes[0].cents) > 10){
    fail("in tune", "a note built exactly in tune reads " + out.notes[0].cents + " cents off");
  }
  report("in tune", out.notes.length ? out.notes[0].cents + " cents" : "nothing found");
})();

/* ---------- the same pitch twice ----------
   Two crotchets on one note are one minim unless the second attack is seen. */
(function(){
  var want = [
    {midi: 69, t: 0.10, dur: 0.40},
    {midi: 69, t: 0.55, dur: 0.40}
  ];
  var buf = silence(1.2);
  want.forEach(function(w){ tone(buf, w.t, w.midi, w.dur, VOICE, 0.3); });

  var out = AudioPitch.notes(buf, SR);
  expectNotes("struck twice", out.notes, want);
  report("struck twice", out.notes.length + " notes at midi " +
         out.notes.map(function(n){ return n.midi; }).join(","));
})();

/* ---------- the same melody, recorded quietly ----------
   A phone on the far side of the room. Nothing about which notes were played
   has changed, so nothing about the answer may change either: a detector with
   an absolute loudness gate hears silence here and returns nothing. */
(function(){
  var want = [
    {midi: 72, t: 0.10, dur: 0.45},
    {midi: 74, t: 0.65, dur: 0.45},
    {midi: 76, t: 1.20, dur: 0.45},
    {midi: 67, t: 1.75, dur: 0.45}
  ];
  var buf = silence(2.5);
  want.forEach(function(w){ tone(buf, w.t, w.midi, w.dur, VOICE, 0.006); });

  var out = AudioPitch.notes(buf, SR);
  expectNotes("quiet take", out.notes, want);
  report("quiet take", out.notes.length + " notes at a fiftieth of the level");
})();

/* ---------- hiss: nothing was played ---------- */
(function(){
  var buf = silence(1.5);
  /* a fixed sequence rather than Math.random, so a failure here is the same
     failure tomorrow */
  var seed = 12345;
  for(var i = 0; i < buf.length; i++){
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    buf[i] = (seed / 0x7fffffff - 0.5) * 0.02;
  }

  var out = AudioPitch.notes(buf, SR);
  if(out.notes.length){
    fail("hiss", "found " + out.notes.length + " notes in noise [" +
                 out.notes.map(function(n){ return n.midi; }).join(",") + "]");
  }
  if(out.source.verdict === "mono"){
    fail("hiss", "noise read as a single clean line");
  }
  report("hiss", out.notes.length + " notes, " + out.source.verdict);
})();

/* ---------- three notes at once ----------
   The case the whole `source` field exists for. A monophonic tracker cannot
   transcribe this and must not pretend otherwise: whatever it reports about
   pitch, it has to report that this is not one line. */
(function(){
  var buf = silence(1.5);
  tone(buf, 0.10, 60, 1.20, VOICE, 0.22);
  tone(buf, 0.10, 64, 1.20, VOICE, 0.22);
  tone(buf, 0.10, 67, 1.20, VOICE, 0.22);

  var out = AudioPitch.notes(buf, SR);
  if(out.source.verdict === "mono"){
    fail("chord", "a three-note chord read as one clean line (share " +
                  out.source.share + ", aperiodicity " + out.source.aperiodicity + ")");
  }
  report("chord", out.source.verdict + ", share " + out.source.share +
                  ", aperiodicity " + out.source.aperiodicity);
})();

/* ---------- tempo ----------
   Eight notes on a strict half-second grid is 120 to the minute. The detector
   is allowed to answer in a different octave of the tempo -- 60 and 120 fit the
   same onsets equally well and no listener can settle it either -- but it has
   to land on the family. */
(function(){
  var buf = silence(4.6);
  var scale = [60, 62, 64, 65, 67, 69, 71, 72];
  for(var i = 0; i < scale.length; i++){
    tone(buf, 0.10 + i * 0.5, scale[i], 0.40, VOICE, 0.3);
  }

  var out = AudioPitch.notes(buf, SR);
  var bpm = out.tempo.bpm;
  var ok = [60, 120].indexOf(bpm) >= 0;
  if(!ok){
    fail("tempo", "read " + bpm + " bpm from a 120 bpm grid (conf " + out.tempo.conf + ")");
  }
  if(out.notes.length !== scale.length){
    fail("tempo", "found " + out.notes.length + " notes, expected " + scale.length);
  }
  report("tempo", bpm + " bpm, confidence " + out.tempo.conf +
                  ", " + out.notes.length + " notes");
})();

/* ---------- verdict ---------- */

console.log(lines.join("\n"));
if(problems.length){
  console.log("");
  console.log("audiopitch: " + problems.length + " problem(s)");
  problems.forEach(function(p){ console.log("  " + p); });
  process.exit(1);
}
console.log("");
console.log("audiopitch: ok -- pitch, octave traps, repeated notes, a quiet take,");
console.log("            noise, a chord and tempo all read as built");
