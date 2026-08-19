/* The pieces the game can play.
 *
 * Same shape as score.js: `key` is a VexFlow key signature, `measures[].notes`
 * are [pitch, duration] pairs with "R" for a rest, and every measure has to add
 * up to four beats. beams/ties/slurs/systems/crossSlurs are only read by
 * notes.html; the game needs key, measures[].n and measures[].notes.
 *
 * Load after score.js — SCORE is a top-level const there, so it is a global
 * lexical binding rather than a property of window.
 */

/* До Ре Ми Фа Соль Ля Си До, and back down. */
var GAMMA = {
  key: "C",
  time: "4/4",
  measures: [
    {n:1, notes:[["c/4","q"],["d/4","q"],["e/4","q"],["f/4","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:0},
    {n:2, notes:[["g/4","q"],["a/4","q"],["b/4","q"],["c/5","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:0},
    {n:3, notes:[["b/4","q"],["a/4","q"],["g/4","q"],["f/4","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:1},
    {n:4, notes:[["e/4","q"],["d/4","q"],["c/4","q"],["R","q"]],
     beams:[], ties:[], slurs:[], bar:"double", repeat:null, sys:1}
  ],
  systems: [[1,2],[3,4]],
  crossSlurs: []
};

/* A built-in piece carries a translation key rather than a title, so its name
   follows the language and the note-naming convention: {key} is filled in with
   the localised key signature, "C major" / "До мажор" / "C-Dur".
   Zombie is a proper name and stays as it is; so does anything imported from a
   file, which keeps whatever title the reader typed. */
var SONGS = [
  {id:"gamma",  titleKey:"song.gamma", score:GAMMA},
  {id:"zombie", title:"Zombie",        score:SCORE}
];

function songTitle(s){
  if(!s){ return ""; }
  if(!s.titleKey){ return s.title; }
  return I18n.t(s.titleKey, {key: Note.key(s.score.key)});
}
