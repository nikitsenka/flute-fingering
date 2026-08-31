/* Checks the octave the import dialog suggests.
 *
 * Every importer -- MusicXML, a recording, a PDF, a scan -- puts a line in
 * front of the reader with an octave already chosen, and that choice is the
 * one thing in the dialog nobody checks by eye: a piece that arrives an octave
 * low still looks like the piece, and sounds like a piece, and is wrong. That
 * is exactly how it went unnoticed -- reported as "the notes are very low",
 * with the import blamed for it.
 *
 * The rule the suggestion has to keep: leave the music where it is unless
 * moving it lets the instrument play more of it. A line that already fits is
 * not to be moved at all, however many shifts fit equally well.
 *
 *     node tools/check_octave.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");

var sandbox = {document:{documentElement:{}}};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js", "notenames.js", "durations.js", "instruments.js",
 "instruments/flute.js", "instruments/piano.js", "songimport.js"
].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});

var suggest = sandbox.SongImport.suggestOctave;
var midi = sandbox.Note.midi;
var range = sandbox.Instruments.current().range;

var problems = [];
function ok(what, cond, saw){
  console.log("  " + (cond ? "ok  " : "BAD ") + what + (saw === undefined ? "" : "   " + saw));
  if(!cond){ problems.push(what + (saw === undefined ? "" : ": " + saw)); }
}

function line(lo, hi){ return {lo:midi(lo), hi:midi(hi), notes:8, used:{}}; }

console.log("what octave the dialog offers, for the flute (" +
            sandbox.Note.compact(sandbox.Note.keyOfMidi(range.lo)) + ".." +
            sandbox.Note.compact(sandbox.Note.keyOfMidi(range.hi)) + ")");

/* Anything that already fits stays put. Several shifts score the same here --
   the line fits at nought and it fits an octave down -- and the tie has to go
   to nought, which is what was wrong. */
[["c/5", "e/5"], ["c/5", "g/5"], ["c/4", "c/5"], ["g/4", "e/5"], ["c/4", "b/5"]]
  .forEach(function(pair){
    ok("a line inside the range is left alone: " + pair[0] + ".." + pair[1],
       suggest(line(pair[0], pair[1])) === 0, "suggested " + suggest(line(pair[0], pair[1])));
  });

/* And a line that does not fit is moved, in the direction that helps. */
ok("an octave too low is lifted", suggest(line("c/3", "e/3")) === 1,
   "suggested " + suggest(line("c/3", "e/3")));
ok("two octaves too low is lifted twice", suggest(line("c/2", "e/2")) === 2,
   "suggested " + suggest(line("c/2", "e/2")));
ok("too high is dropped", suggest(line("c/7", "e/7")) === -1,
   "suggested " + suggest(line("c/7", "e/7")));

/* A line wider than the instrument cannot be made to fit; whatever it answers,
   it must not throw away notes it could have kept. */
var wide = line("c/3", "c/7");
var at = suggest(wide);
function playable(shift){
  var lo = wide.lo + shift * 12, hi = wide.hi + shift * 12;
  return Math.max(0, Math.min(hi, range.hi) - Math.max(lo, range.lo) + 1);
}
ok("a line too wide to fit keeps as much as any shift would",
   [-2, -1, 0, 1, 2].every(function(s){ return playable(at) >= playable(s); }),
   "suggested " + at + ", keeping " + playable(at) + " semitones");

console.log("");
if(problems.length){
  problems.forEach(function(p){ console.log("  ! " + p); });
  console.log("\n" + problems.length + " problem(s)");
  process.exit(1);
}
console.log("octave: ok -- music that fits is left where it was written, and\n" +
            "        music that does not is moved the least that helps");
