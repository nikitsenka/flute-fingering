/* The piano: which key to press.
 *
 * There is nothing to decode here the way there was for the flute -- a piano
 * has one key per pitch and that is the whole of it. What the diagrams show is
 * *where* on the keyboard the note sits, which is the thing a beginner is
 * actually hunting for.
 *
 * Deliberately no finger numbers. Piano fingering belongs to a passage, not to
 * an isolated note -- the same C is a thumb in one bar and a fifth finger in
 * the next -- so a per-pitch chart cannot honestly carry one.
 */
(function(global){
  "use strict";

  var el = global.Instruments.svgEl;
  var clear = global.Instruments.clear;
  var Note = global.Note;

  var LOW = 21, HIGH = 108;              /* a/0 .. c/8, an 88-key piano */

  /* where each letter sits among the seven white keys of an octave */
  var WHITE = {c:0, d:1, e:2, f:3, g:4, a:5, b:6};
  /* the white keys a black key sits to the right of: C#, D#, F#, G#, A# */
  var BLACKS = [0, 1, 3, 4, 5];

  function midiOf(pitch){
    var m = Note.midi(pitch);
    return isFinite(m) ? m : null;
  }

  /* ---------- markup ---------- */
  /* Colours are named as var() inside a style attribute, exactly as the flute
     charts do: var() is not understood in a presentation attribute, and a
     style attribute also survives the rule in theme.css that recolours
     VexFlow's engraving around these diagrams on notes.html. */
  function key(x, y, w, h, r, tone){
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
           '" rx="' + r + '" style="fill:var(--key-' + tone + ')"/>';
  }

  /* One run of whole octaves. `g` carries the geometry; `on` is the pitch to
     light up, or null. White keys are laid down first so the black ones sit on
     top of them, which is how a keyboard looks from above. */
  function keyboard(g, on){
    var lit = on ? Note.parse(on) : null;
    var out = '<g style="stroke:var(--key-stroke)" stroke-width="' + g.sw +
              '" stroke-linejoin="round">';

    function whiteX(oct, i){ return g.x + ((oct - g.from) * 7 + i) * g.ww; }

    var oct, i;
    for(oct = g.from; oct < g.from + g.octaves; oct++){
      for(i = 0; i < 7; i++){
        var letter = "cdefgab"[i];
        var isLit = lit && !lit.sharp && lit.oct === oct && lit.step === letter;
        out += key(whiteX(oct, i), g.y, g.ww, g.kh, g.ww * 0.16,
                   isLit ? "pressed" : "white");
      }
    }
    for(oct = g.from; oct < g.from + g.octaves; oct++){
      for(i = 0; i < BLACKS.length; i++){
        var w = BLACKS[i];
        var sharpLit = lit && lit.sharp && lit.oct === oct &&
                       WHITE[lit.step] === w;
        out += key(whiteX(oct, w) + g.ww - g.bw / 2, g.y, g.bw, g.bh,
                   g.bw * 0.22, sharpLit ? "pressed" : "black");
      }
    }
    return out + '</g>';
  }

  function label(x, y, size, text){
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' +
           size + '" font-family="inherit" style="fill:var(--key-label);stroke:none">' +
           text + '</text>';
  }

  /* ---------- the small chart, under a note on notes.html ---------- */
  var W = 38, H = 34;

  function geomFor(pitch){
    var p = Note.parse(pitch);
    return {from:p.oct, octaves:1, x:0.6, y:0.6, ww:(W - 1.2) / 7,
            kh:24, bw:3.2, bh:15, sw:0.6};
  }

  function diagram(pitch, sw){
    if(!has(pitch)){ return ""; }
    var g = geomFor(pitch);
    if(sw){ g.sw = sw; }
    /* the octave number, because one octave of keys looks like every other */
    return keyboard(g, pitch) +
           label(W / 2, H - 1.5, 9, Note.octaveShort(Note.parse(pitch).oct));
  }

  /* ---------- the wide chart, on the panel under game.html's lanes ----------
     Three octaves with the note's own in the middle, so there is enough
     keyboard either side of it to see where the hand goes.

     The panel blows this box up to several times its size, so type here is
     proportionally huge: one small label under the middle octave, rather than
     one under every C, is all it can carry without shouting. */
  var HW = 170, HH = 46;
  var HKH = 34;

  function wideGeom(pitch){
    var oct = Note.parse(pitch).oct;
    var from = Math.max(0, Math.min(6, oct - 1));
    var ww = (HW - 2) / 21;
    return {from:from, octaves:3, x:1, y:1, ww:ww,
            kh:HKH, bw:ww * 0.62, bh:21, sw:0.7};
  }

  function horizontal(pitch, sw){
    if(!has(pitch)){ return ""; }
    var g = wideGeom(pitch);
    if(sw){ g.sw = sw; }
    /* the middle octave is the note's own -- see wideGeom */
    return keyboard(g, pitch) +
           label(g.x + 10.5 * g.ww, HH - 1.5, 6,
                 Note.octaveShort(Note.parse(pitch).oct));
  }

  /* ---------- the big keyboard on index.html ----------
     Two octaves either side of middle C, drawn as real nodes rather than
     markup so the keys can be clicked. Same box as the flute drawing, so the
     two cards come out the same size. */
  var REF_FROM = 4, REF_OCT = 2;            /* c/4 .. b/5 */
  var REF_VIEWBOX = "0 0 420 170";
  var RX = 6, RY = 14, RWW = (420 - 12) / 14, RKH = 116, RBH = 72;
  var RBW = RWW * 0.62;

  function drawReference(svg, pitch, onPick){
    clear(svg);
    var lit = Note.parse(pitch);
    var STROKE = global.Theme.colourOf("key-stroke");
    var LABEL  = global.Theme.colourOf("key-label");

    function tone(name){ return global.Theme.colourOf("key-" + name); }
    function whiteX(oct, i){ return RX + ((oct - REF_FROM) * 7 + i) * RWW; }

    function add(node, id){
      node.setAttribute("stroke", STROKE);
      node.setAttribute("stroke-width", 2);
      node.setAttribute("stroke-linejoin", "round");
      if(onPick){
        node.style.cursor = "pointer";
        node.addEventListener("click", function(){ onPick(id); });
      }
      svg.appendChild(node);
      return node;
    }

    var oct, i;
    for(oct = REF_FROM; oct < REF_FROM + REF_OCT; oct++){
      for(i = 0; i < 7; i++){
        var letter = "cdefgab"[i];
        var id = letter + "/" + oct;
        var isLit = !lit.sharp && lit.oct === oct && lit.step === letter;
        add(el("rect",{
          x:whiteX(oct, i), y:RY, width:RWW, height:RKH, rx:4,
          fill: isLit ? tone("pressed") : tone("white")
        }), id);
      }
    }
    for(oct = REF_FROM; oct < REF_FROM + REF_OCT; oct++){
      for(i = 0; i < BLACKS.length; i++){
        var w = BLACKS[i];
        var sid = "cdefgab"[w] + "#/" + oct;
        var sharpLit = lit.sharp && lit.oct === oct && WHITE[lit.step] === w;
        add(el("rect",{
          x:whiteX(oct, w) + RWW - RBW / 2, y:RY, width:RBW, height:RBH, rx:3,
          fill: sharpLit ? tone("pressed") : tone("black")
        }), sid);
      }
    }

    /* the white keys named underneath, and the octave under each C */
    for(oct = REF_FROM; oct < REF_FROM + REF_OCT; oct++){
      for(i = 0; i < 7; i++){
        svg.appendChild(el("text",{
          x:whiteX(oct, i) + RWW / 2, y:RY + RKH + 18, "text-anchor":"middle",
          "font-size":12.5, fill:LABEL, "font-family":"inherit"
        }, Note.of("cdefgab"[i] + "/" + oct)));
      }
      svg.appendChild(el("text",{
        x:whiteX(oct, 0) + RWW / 2, y:RY + RKH + 33, "text-anchor":"middle",
        "font-size":11, fill:LABEL, "font-family":"inherit"
      }, Note.octaveShort(oct)));
    }
  }

  function has(pitch){
    var m = midiOf(pitch);
    return m !== null && m >= LOW && m <= HIGH;
  }

  global.Instruments.register({
    id: "piano",
    nameKey: "instrument.piano",
    range: {lo:LOW, hi:HIGH},
    has: has,

    /* Middle C is where the two hands and the two clefs meet; below it the
       ledger lines pile up fast, so the stave switches. */
    clefFor: function(pitch){
      var m = midiOf(pitch);
      return m !== null && m < 60 ? "bass" : "treble";
    },

    chart: {
      width: W,
      height: H,
      diagram: diagram,
      hWidth: HW,
      hHeight: HH,
      horizontal: horizontal,

      at: function(pitch, cx, top, k){
        var d = diagram(pitch);
        if(!d){ return ""; }
        k = k || 1;
        return '<g transform="translate(' + (cx - W * k / 2) + ' ' + top +
               ') scale(' + k + ')">' +
               '<rect x="0" y="0" width="' + W + '" height="' + H +
               '" rx="4" style="fill:var(--grip-bg);stroke:none"/>' + d + '</g>';
      }
    },

    reference: {
      viewBox: REF_VIEWBOX,
      notes: function(){
        var out = [];
        for(var oct = REF_FROM; oct < REF_FROM + REF_OCT; oct++){
          for(var i = 0; i < 7; i++){
            var letter = "cdefgab"[i];
            out.push(letter + "/" + oct);
            if(BLACKS.indexOf(i) >= 0){ out.push(letter + "#/" + oct); }
          }
        }
        return out;
      },
      draw: drawReference,
      legend: function(){
        return [
          {key:"piano.legend.press", fill:"var(--key-pressed)"},
          {key:"piano.legend.white", fill:"var(--key-white)"},
          {key:"piano.legend.black", fill:"var(--key-black)"}
        ];
      }
    },

    copy: {
      subKey:       "piano.sub",
      chartCardKey: "piano.chartCard",
      aboutKey:     "piano.about",
      hintKey:      "piano.hint",
      onKey:        "piano.on"
    }
  });
})(window);
