/* Validates every song in songs.js.
 *
 * score.js is generated and make_score.py already asserts its bar lengths, but
 * songs.js is written by hand, so it gets the same checks here plus a test that
 * every pitch it uses can actually be played on every instrument the app
 * registers -- a built-in piece is offered whatever is selected, so a pitch
 * that one of them cannot reach is a bug in the piece, not in the instrument.
 *
 *     node tools/check_songs.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");

/* the files expect to be classic browser scripts sharing one global.
   instruments/*.js reach for notenames.js (Note.midi) and, through it, i18n.js
   for the spelling of a note -- none of which this check needs, so prefs.js
   and i18n.js come along to keep those lookups from throwing. */
var sandbox = {window:{}, document:{documentElement:{}}};
sandbox.global = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js", "notenames.js", "durations.js", "score.js", "songs.js",
 "instruments.js", "instruments/flute.js", "instruments/piano.js"].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});

var INSTRUMENTS = sandbox.window.Instruments.list();
var BEATS = sandbox.window.DURATIONS.beats;
var problems = [];

var PER_BAR = sandbox.window.DURATIONS.perBar;

/* Both built-in pieces are in 4/4, so nothing below would notice if the bar
   length went back to being a constant. These cases are the guard: a beat is a
   quarter, so 3/4 holds three and 6/8 holds three as well. */
[["4/4", 4], ["3/4", 3], ["2/4", 2], ["6/8", 3], ["2/2", 4], ["12/8", 6],
 ["", 4], [undefined, 4], ["nonsense", 4]].forEach(function(pair){
  var got = PER_BAR(pair[0]);
  if(Math.abs(got - pair[1]) > 1e-9){
    problems.push("DURATIONS.perBar(" + JSON.stringify(pair[0]) + ") = " + got +
                  ", expected " + pair[1]);
  }
});

sandbox.SONGS.forEach(function(song){
  var where = song.id;
  /* what a bar holds is the piece's own business -- songimport.js reads the
     signature out of a file and writes it into the score, so a check that
     insisted on four would reject every waltz the moment one was imported */
  var time = song.score.time || "4/4";
  var perBar = PER_BAR(time);
  var pitches = {};
  var beats = 0;

  /* built-in pieces name themselves through a translation key instead */
  if(!song.title && !song.titleKey){ problems.push(where + ": no title"); }
  if(!song.score || !song.score.measures || !song.score.measures.length){
    problems.push(where + ": no measures");
    return;
  }
  if(!song.score.key){ problems.push(where + ": no key signature"); }

  song.score.measures.forEach(function(m, i){
    var sum = 0;
    m.notes.forEach(function(n){
      var d = BEATS[n[1]];
      if(d === undefined){
        problems.push(where + " bar " + m.n + ": unknown duration " + JSON.stringify(n[1]));
        return;
      }
      sum += d;
      if(n[0] !== "R"){ pitches[n[0]] = true; }
    });
    if(Math.abs(sum - perBar) > 1e-9){
      problems.push(where + " bar " + m.n + ": " + sum + " beats, expected " + perBar +
                    " for " + time);
    }
    if(i > 0 && m.n <= song.score.measures[i - 1].n){
      problems.push(where + " bar " + m.n + ": bar numbers must increase");
    }
    beats += sum;
  });

  var all = Object.keys(pitches).sort();
  INSTRUMENTS.forEach(function(inst){
    all.forEach(function(p){
      if(!inst.has(p)){
        problems.push(where + ": " + inst.id + " cannot play " + p);
      }
    });
  });

  console.log(
    pad(song.id, 8) + pad(song.score.key + " " + (song.score.time || "?"), 8) +
    pad(song.score.measures.length + " bars", 9) +
    pad(beats + " beats", 11) +
    pad(all.length + " pitches", 12) +
    INSTRUMENTS.map(function(i){ return i.id; }).join(" ")
  );
});

function pad(s, n){ return (s + "          ").slice(0, Math.max(n, String(s).length + 1)); }

console.log("");
if(problems.length){
  problems.forEach(function(p){ console.log("  ! " + p); });
  console.log("\n" + problems.length + " problem(s)");
  process.exit(1);
}
console.log("all songs OK");
