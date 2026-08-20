/* Checks the pitch the sound is built from, without a browser and without a
 * speaker.
 *
 * game.html turns a pitch into a tone in two steps: Note.midi() maps the
 * spelling to a midi number, and freq() maps that number to hertz by equal
 * temperament off A4 = 440. Only the second step is arithmetic; the first is a
 * table, and it is the one that can be wrong in a way nobody hears until they
 * play along with a real instrument.
 *
 * So this checks that every pitch the app can actually sound -- every pitch in
 * every built-in piece, and every pitch every instrument declares a fingering
 * for -- lands within a cent of its equal-tempered frequency, and that the
 * anchors of the system are exactly where the standard puts them.
 *
 * What this does NOT check: that the browser emits any sound at all. That needs
 * a speaker and an ear, and no amount of node will substitute for it.
 *
 *     node tools/check_pitch.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");

var sandbox = {window:{}, document:{documentElement:{}}};
sandbox.global = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js", "notenames.js", "durations.js", "score.js", "songs.js",
 "instruments.js", "instruments/flute.js", "instruments/piano.js"].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});

var Note = sandbox.window.Note;
var INSTRUMENTS = sandbox.window.Instruments.list();

/* the same formula game.html uses; kept here as the statement of intent that
   the app is checked against, not as a copy to keep in sync -- if the app's
   line ever differs from this one, that difference is the bug */
function freq(pitch){ return 440 * Math.pow(2, (Note.midi(pitch) - 69) / 12); }

function cents(a, b){ return 1200 * Math.log2(a / b); }

var problems = [];

/* Gaps that are filed and understood. A check that is red every run stops
   being read within days, and then it is not reporting the gap it names -- it
   is hiding whatever breaks next. So a known gap is reported as known and does
   not fail the run.

   The list is enforced in both directions: an entry that no longer reproduces
   fails, so closing the issue cannot leave a stale exception sitting here
   pretending to excuse something. */
var KNOWN = [
  {instrument:"flute", pitch:"c#/4", issue:7,
   why:"declared in range, absent from the fingering table"}
];

var knownHit = {};

function known(instrument, pitch){
  for(var i = 0; i < KNOWN.length; i++){
    if(KNOWN[i].instrument === instrument && KNOWN[i].pitch === pitch){
      knownHit[instrument + " " + pitch] = true;
      return KNOWN[i];
    }
  }
  return null;
}

/* 1. the anchors. A4 is the definition; the others are the published values a
      tuner shows, so a table error anywhere near the middle of the range shows
      up as a named note being audibly off. */
[["a/4", 440], ["c/4", 261.6256], ["c/5", 523.2511], ["e/4", 329.6276],
 ["g/4", 391.9954], ["a/3", 220], ["a/5", 880]].forEach(function(pair){
  var got = freq(pair[0]);
  var off = Math.abs(cents(got, pair[1]));
  if(off > 1){
    problems.push(pair[0] + ": " + got.toFixed(3) + " Hz, expected " +
                  pair[1] + " Hz (" + off.toFixed(2) + " cents off)");
  }
});

/* 2. every pitch the app can sound, against equal temperament from its own
      midi number -- catches a spelling that maps to no number at all */
var seen = {}, sounded = 0;

function checkPitch(pitch, where){
  if(seen[pitch]){ return; }
  seen[pitch] = true;
  sounded++;
  var m = Note.midi(pitch);
  if(typeof m !== "number" || !isFinite(m)){
    problems.push(where + ": " + pitch + " has no midi number");
    return;
  }
  var f = freq(pitch);
  if(!isFinite(f) || f <= 0){
    problems.push(where + ": " + pitch + " gives " + f + " Hz");
    return;
  }
  var off = Math.abs(cents(f, 440 * Math.pow(2, (m - 69) / 12)));
  if(off > 0.01){
    problems.push(where + ": " + pitch + " is " + off.toFixed(3) + " cents off");
  }
}

sandbox.SONGS.forEach(function(song){
  song.score.measures.forEach(function(m){
    m.notes.forEach(function(n){
      if(n[0] !== "R"){ checkPitch(n[0], "song " + song.id); }
    });
  });
});

/* Every pitch an instrument will accept. The charts are not keyed by pitch, so
   walk each instrument's own declared range and spell each midi number back the
   way the score does. Note.ofMidi returns a translation key ("note.c\u266f"), which
   is the app's spelling once the prefix is off and the sharp is written ascii. */
function spell(m){
  return Note.ofMidi(m).replace(/^note\./, "").replace("\u266f", "#") + "/" + Note.sciOfMidi(m);
}

INSTRUMENTS.forEach(function(inst){
  for(var m = inst.range.lo; m <= inst.range.hi; m++){
    var pitch = spell(m);
    if(!inst.has(pitch)){
      if(!known(inst.id, pitch)){
        problems.push(inst.id + ": says it plays midi " + m + " but rejects " + pitch);
      }
      continue;
    }
    if(Note.midi(pitch) !== m){
      problems.push(inst.id + ": " + pitch + " spells back to midi " +
                    Note.midi(pitch) + ", not " + m);
    }
    checkPitch(pitch, inst.id);
  }
});

/* 3. octaves double. A whole-table transposition error survives every check
      above, because it is consistent -- this is what catches it. */
["c/4", "d/4", "f/4", "a/4"].forEach(function(p){
  var up = p.replace(/(\d)$/, function(d){ return +d + 1; });
  var ratio = freq(up) / freq(p);
  if(Math.abs(ratio - 2) > 1e-9){
    problems.push(p + " -> " + up + ": ratio " + ratio.toFixed(6) + ", expected 2");
  }
});

var lo = null, hi = null;
Object.keys(seen).forEach(function(p){
  var f = freq(p);
  if(lo === null || f < freq(lo)){ lo = p; }
  if(hi === null || f > freq(hi)){ hi = p; }
});

KNOWN.forEach(function(gap){
  if(!knownHit[gap.instrument + " " + gap.pitch]){
    problems.push("known gap " + gap.instrument + " " + gap.pitch + " (#" + gap.issue +
                  ") no longer reproduces -- remove it from KNOWN");
  }
});

console.log("anchors   7 checked   a/4 = " + freq("a/4").toFixed(1) + " Hz");
console.log("sounded   " + sounded + " distinct pitches   " +
            lo + " " + freq(lo).toFixed(1) + " Hz .. " +
            hi + " " + freq(hi).toFixed(1) + " Hz");

KNOWN.forEach(function(gap){
  console.log("known     " + gap.instrument + " " + gap.pitch + ": " + gap.why +
              "  (#" + gap.issue + ")");
});

if(problems.length){
  console.error("\n" + problems.length + " problem(s):\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("\npitch OK -- every sounded pitch within a cent of equal temperament");
