/* The note lengths a song may use, in one place.
 *
 * game.html times playback from `beats`, notes.html engraves from `vf`/`dot`/
 * `triplet`, songimport.js and tools/check_songs.js validate against `beats`,
 * and tools/import_musicxml.py parses this file to turn beats back into a code.
 * Adding a length here is enough to teach all of them about it.
 *
 *   code     what it is              beats
 *   w        whole                   4
 *   hd       dotted half             3
 *   h        half                    2
 *   qd       dotted quarter          1.5
 *   q        quarter                 1
 *   8d       dotted eighth           0.75
 *   qt       quarter triplet         2/3
 *   8        eighth                  0.5
 *   8t       eighth triplet          1/3
 *   16       sixteenth               0.25
 *
 * A triplet is three in the place of two, so it does not land on a whole
 * number of beats; VexFlow draws those as ordinary notes inside a VF.Tuplet.
 */
(function(global){
  "use strict";

  /* longest first -- import tools walk this to turn a beat count into a code */
  var LIST = [
    {code:"w",   beats:4,     vf:"w"},
    {code:"hd",  beats:3,     vf:"hd", dot:true},
    {code:"h",   beats:2,     vf:"h"},
    {code:"qd",  beats:1.5,   vf:"qd", dot:true},
    {code:"q",   beats:1,     vf:"q"},
    {code:"8d",  beats:0.75,  vf:"8d", dot:true},
    {code:"qt",  beats:2 / 3, vf:"q",  triplet:true},
    {code:"8",   beats:0.5,   vf:"8"},
    {code:"8t",  beats:1 / 3, vf:"8",  triplet:true},
    {code:"16",  beats:0.25,  vf:"16"}
  ];

  var OF = {}, BEATS = {};
  LIST.forEach(function(d){
    OF[d.code] = d;
    BEATS[d.code] = d.beats;
  });

  global.DURATIONS = {
    list: LIST,      /* longest first */
    of: OF,          /* code -> the whole entry */
    beats: BEATS,    /* code -> beats */

    /* the code for a beat count, or null if it does not fit the grid */
    codeFor: function(beats){
      for(var i = 0; i < LIST.length; i++){
        if(Math.abs(beats - LIST[i].beats) < 1e-6){ return LIST[i].code; }
      }
      return null;
    }
  };
})(window);
