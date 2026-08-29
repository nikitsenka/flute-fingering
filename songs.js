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

/* Super Mario Bros. "Ground Theme" (Koji Kondo), the tune as it is usually
   played through: the opening phrase, its repeat from bar 3, the chromatic
   middle section, and the closing "C C C D E" figure.
   Written in C major, the key it is normally transcribed in. Two things the
   flute forced:
     - the B-flat in bar 4 is spelled a#/4, because the scores here write
       sharps throughout (notenames.js parses no flats);
     - bar 14 answers the E with C an octave below the original. The phrase
       reaches for C6 and the flute this app models stops at b/5, so the note
       is folded down rather than left out -- the rhythm is what carries that
       bar anyway.
   Bars 4 and 8 end on an eighth-note triplet; notes.html brackets a run of
   them on its own, so only the durations have to say so. */
var MARIO = {
  key: "C",
  time: "4/4",
  measures: [
    /* the head: E E . E . C E */
    {n:1, notes:[["e/5","8"],["e/5","8"],["R","8"],["e/5","8"],
                 ["R","8"],["c/5","8"],["e/5","q"]],
     beams:[[0,1]], ties:[], slurs:[], bar:null, repeat:null, sys:0},
    {n:2, notes:[["g/5","q"],["R","q"],["g/4","q"],["R","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:0},
    {n:3, notes:[["c/5","qd"],["g/4","8"],["R","q"],["e/4","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:0},
    {n:4, notes:[["a/4","q"],["b/4","q"],["a#/4","8"],["a/4","8"],
                 ["g/4","8t"],["e/5","8t"],["g/5","8t"]],
     beams:[[2,3],[4,5,6]], ties:[], slurs:[], bar:null, repeat:null, sys:1},
    {n:5, notes:[["a/5","q"],["f/5","8"],["g/5","8"],
                 ["R","8"],["e/5","8"],["c/5","8"],["d/5","8"]],
     beams:[[1,2],[4,5,6]], ties:[], slurs:[], bar:null, repeat:null, sys:1},
    {n:6, notes:[["b/4","hd"],["R","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:1},

    /* and the same four bars again, which is how the tune goes */
    {n:7, notes:[["c/5","qd"],["g/4","8"],["R","q"],["e/4","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:2},
    {n:8, notes:[["a/4","q"],["b/4","q"],["a#/4","8"],["a/4","8"],
                 ["g/4","8t"],["e/5","8t"],["g/5","8t"]],
     beams:[[2,3],[4,5,6]], ties:[], slurs:[], bar:null, repeat:null, sys:2},
    {n:9, notes:[["a/5","q"],["f/5","8"],["g/5","8"],
                 ["R","8"],["e/5","8"],["c/5","8"],["d/5","8"]],
     beams:[[1,2],[4,5,6]], ties:[], slurs:[], bar:null, repeat:null, sys:2},
    {n:10, notes:[["b/4","hd"],["R","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:3},

    /* middle section: the chromatic slide, answered twice low and once high */
    {n:11, notes:[["R","q"],["g/5","8"],["f#/5","8"],["f/5","8"],
                  ["d#/5","8"],["e/5","8"],["R","8"]],
     beams:[[1,2,3,4]], ties:[], slurs:[], bar:null, repeat:null, sys:3},
    {n:12, notes:[["g#/4","8"],["a/4","8"],["c/5","8"],["R","8"],
                  ["a/4","8"],["c/5","8"],["d/5","q"]],
     beams:[[0,1,2],[4,5]], ties:[], slurs:[], bar:null, repeat:null, sys:3},
    {n:13, notes:[["R","q"],["g/5","8"],["f#/5","8"],["f/5","8"],
                  ["d#/5","8"],["e/5","8"],["R","8"]],
     beams:[[1,2,3,4]], ties:[], slurs:[], bar:null, repeat:null, sys:4},
    {n:14, notes:[["c/5","8"],["R","8"],["c/5","8"],["c/5","8"],["R","h"]],
     beams:[[2,3]], ties:[], slurs:[], bar:null, repeat:null, sys:4},
    {n:15, notes:[["R","q"],["g/5","8"],["f#/5","8"],["f/5","8"],
                  ["d#/5","8"],["e/5","8"],["R","8"]],
     beams:[[1,2,3,4]], ties:[], slurs:[], bar:null, repeat:null, sys:4},
    {n:16, notes:[["g#/4","8"],["a/4","8"],["c/5","8"],["R","8"],
                  ["a/4","8"],["c/5","8"],["d/5","q"]],
     beams:[[0,1,2],[4,5]], ties:[], slurs:[], bar:null, repeat:null, sys:5},
    {n:17, notes:[["d#/5","q"],["R","8"],["d/5","8"],["R","q"],["c/5","q"]],
     beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:5},

    /* the close */
    {n:18, notes:[["c/5","8"],["c/5","8"],["R","8"],["c/5","8"],
                  ["R","8"],["c/5","8"],["d/5","8"],["R","8"]],
     beams:[[0,1]], ties:[], slurs:[], bar:null, repeat:null, sys:5},
    {n:19, notes:[["e/5","8"],["R","8"],["c/5","8"],["R","8"],
                  ["a/4","8"],["g/4","8"],["R","q"]],
     beams:[[4,5]], ties:[], slurs:[], bar:null, repeat:null, sys:6},
    {n:20, notes:[["c/5","8"],["c/5","8"],["R","8"],["c/5","8"],
                  ["R","8"],["c/5","8"],["d/5","8"],["R","8"]],
     beams:[[0,1]], ties:[], slurs:[], bar:null, repeat:null, sys:6},
    {n:21, notes:[["e/5","h"],["R","h"]],
     beams:[], ties:[], slurs:[], bar:"double", repeat:null, sys:6}
  ],
  systems: [[1,2,3],[4,5,6],[7,8,9],[10,11,12],[13,14,15],[16,17,18],[19,20,21]],
  crossSlurs: []
};

/* A built-in piece carries a translation key rather than a title, so its name
   follows the language and the note-naming convention: {key} is filled in with
   the localised key signature, "C major" / "До мажор" / "C-Dur".
   Zombie is a proper name and stays as it is; so does anything imported from a
   file, which keeps whatever title the reader typed. */
var SONGS = [
  {id:"gamma",  titleKey:"song.gamma", score:GAMMA},
  {id:"zombie", title:"Zombie",        score:SCORE},
  {id:"mario",  title:"Mario",         score:MARIO}
];

function songTitle(s){
  if(!s){ return ""; }
  if(!s.titleKey){ return s.title; }
  return I18n.t(s.titleKey, {key: Note.key(s.score.key)});
}
