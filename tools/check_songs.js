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

sandbox.SONGS.forEach(function(song){
  var where = song.id;
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
    if(Math.abs(sum - 4) > 1e-9){
      problems.push(where + " bar " + m.n + ": " + sum + " beats, expected 4");
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
