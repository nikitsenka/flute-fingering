/* What to call a pitch in the language the reader picked.
 *
 * Load after i18n.js. The seven diatonic names live in the translations under
 * note.c ... note.b, so German simply spells note.b as H and nothing here has
 * to know about it. The sharp sign is the same everywhere.
 *
 * Two octave systems are in use and the translations choose between them with
 * octave.system:
 *   "scientific"  C4, C5 -- the octave number as written in the pitch itself
 *   "register"    Russian schooling counts от контроктавы: c/4 is первая октава
 */
(function(global){
  "use strict";

  var LETTERS = ["c","d","e","f","g","a","b"];
  var SEMI = {c:0, d:2, e:4, f:5, g:7, a:9, b:11};
  /* the chromatic scale spelled with sharps, as the app always spells it */
  var CHROMA = [["c",0],["c",1],["d",0],["d",1],["e",0],["f",0],
                ["f",1],["g",0],["g",1],["a",0],["a",1],["b",0]];

  var SHARP = "♯";
  var FLAT  = "♭";

  function T(key, params){ return global.I18n.t(key, params); }

  /* "f#/5" -> {step:"f", sharp:true, oct:5} */
  function parse(pitch){
    var bits = String(pitch).split("/");
    return {
      step: bits[0][0].toLowerCase(),
      sharp: bits[0].indexOf("#") > 0,
      oct: +bits[1]
    };
  }

  function step(letter, sharp){
    return T("note." + letter) + (sharp ? SHARP : "");
  }

  function of(pitch){
    var p = parse(pitch);
    return step(p.step, p.sharp);
  }

  function midi(pitch){
    var p = parse(pitch);
    return (p.oct + 1) * 12 + SEMI[p.step] + (p.sharp ? 1 : 0);
  }

  function ofMidi(m){
    var c = CHROMA[((Math.round(m) % 12) + 12) % 12];
    return step(c[0], !!c[1]);
  }

  /* scientific octave of a midi number: 60 -> 4 */
  function sciOfMidi(m){ return Math.floor(Math.round(m) / 12) - 1; }

  function scientific(){ return T("octave.system") !== "register"; }

  /* Which register a scientific octave falls in, for the languages that name
     them: 4 -> 1 (первая), 3 -> 0 (малая), 2 -> -1 (большая), lower -> контр */
  function register(sci){ return sci - 3; }

  function octaveKey(sci){
    if(scientific()){ return null; }
    var r = register(sci);
    if(r >= 1){ return null; }
    return r === 0 ? "octave.small" : r === -1 ? "octave.great" : "octave.contra";
  }

  /* "oct. 4" / "1-я окт." -- lane labels and note buttons */
  function octaveShort(sci){
    var named = octaveKey(sci);
    if(named){ return T(named + ".short"); }
    return T("octave.short", {n: scientific() ? sci : register(sci)});
  }

  /* "octave 4" / "1-я октава" -- the readout on the reference page */
  function octaveLong(sci){
    var named = octaveKey(sci);
    if(named){ return T(named + ".long"); }
    return T("octave.long", {n: scientific() ? sci : register(sci)});
  }

  /* The tight form used inside a range: "C4" / "До1" / "Ре♯ мал." */
  function compactMidi(m){
    var sci = sciOfMidi(m);
    var named = octaveKey(sci);
    var tail = named ? " " + T(named + ".short")
                     : String(scientific() ? sci : register(sci));
    return ofMidi(m) + tail;
  }

  function compact(pitch){ return compactMidi(midi(pitch)); }

  /* ---------- key signatures ---------- */
  /* VexFlow spells them "C", "F", "Bb", "Am", "F#m". */
  function key(vexKey){
    var text = String(vexKey || "C");
    var minor = /m$/.test(text);
    if(minor){ text = text.slice(0, -1); }
    var letter = text[0].toLowerCase();
    if(LETTERS.indexOf(letter) < 0){ return text; }
    var sign = text.indexOf("#") > 0 ? SHARP : text.indexOf("b") > 0 ? FLAT : "";
    var name = T("note." + letter) + sign;
    return T(minor ? "key.minor" : "key.major", {note: name});
  }

  global.Note = {
    parse: parse,
    midi: midi,
    step: step,
    of: of,
    ofMidi: ofMidi,
    sciOfMidi: sciOfMidi,
    sci: function(pitch){ return parse(pitch).oct; },
    octaveShort: octaveShort,
    octaveLong: octaveLong,
    compact: compact,
    compactMidi: compactMidi,
    key: key
  };
})(window);
