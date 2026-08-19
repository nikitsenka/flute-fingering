/* The Boehm flute: its fingering chart, and the big key diagram on index.html.
 *
 * This file used to be fingering.js at the top level, before there was more
 * than one instrument. The key layout and the pressed/open pattern for every
 * pitch were decoded from the chart images that were embedded in
 * flute-zombie.drawio (no longer kept in the repo): each distinct chart was
 * matched to the note it sat under, then the filled (magenta) areas were
 * located and mapped onto the keys of a Boehm flute. See tools/README.md.
 *
 * Keys, head joint -> foot joint:
 *   thumbBb  thumb B-flat lever      (unused by this piece)
 *   thumbB   thumb B key
 *   lh1..3   left hand index/middle/ring
 *   gsharp   left pinky G-sharp key  (unused by this piece)
 *   rh1..3   right hand index/middle/ring
 *   trill1/2 the two trill keys      (unused by this piece)
 *   eb       right pinky E-flat key
 *   lowC     right pinky C key on the foot joint (only low C uses it)
 */
(function(global){
  "use strict";

  var el = global.Instruments.svgEl;
  var clear = global.Instruments.clear;

  /* Boehm flute, standard chart. The right pinky rests on the E-flat key for
     everything except D (which releases it) and low C (which moves it onto the
     foot joint C key instead).

     Note that F# is the right *ring* finger and F natural the right *index* --
     the keywork links them that way round, which is not the order the tone
     holes sit in. See the correction note in tools/README.md.

     B-flat is given as the "one and one" fingering (LH1 + RH1), which works in
     any key; the thumb B-flat lever is the usual alternative in flat keys and
     is the one key in the diagram that nothing here switches on. */
  var FINGERINGS = {
    "c/4":  ["thumbB", "lh1", "lh2", "lh3", "rh1", "rh2", "rh3", "lowC"],
    "d/4":  ["thumbB", "lh1", "lh2", "lh3", "rh1", "rh2", "rh3"],
    "d#/4": ["thumbB", "lh1", "lh2", "lh3", "rh1", "rh2", "rh3", "eb"],
    "e/4":  ["thumbB", "lh1", "lh2", "lh3", "rh1", "rh2", "eb"],
    "f/4":  ["thumbB", "lh1", "lh2", "lh3", "rh1", "eb"],
    "f#/4": ["thumbB", "lh1", "lh2", "lh3", "rh3", "eb"],
    "g/4":  ["thumbB", "lh1", "lh2", "lh3", "eb"],
    "g#/4": ["thumbB", "lh1", "lh2", "lh3", "gsharp", "eb"],
    "a/4":  ["thumbB", "lh1", "lh2", "eb"],
    "a#/4": ["thumbB", "lh1", "rh1", "eb"],
    "b/4":  ["thumbB", "lh1", "eb"],
    "c/5":  ["lh1", "eb"],
    "c#/5": ["eb"],
    "d/5":  ["thumbB", "lh2", "lh3", "rh1", "rh2", "rh3"],
    "d#/5": ["thumbB", "lh1", "lh2", "lh3", "rh1", "rh2", "rh3", "eb"],
    "e/5":  ["thumbB", "lh1", "lh2", "lh3", "rh1", "rh2", "eb"],
    "f/5":  ["thumbB", "lh1", "lh2", "lh3", "rh1", "eb"],
    "f#/5": ["thumbB", "lh1", "lh2", "lh3", "rh3", "eb"],
    "g/5":  ["thumbB", "lh1", "lh2", "lh3", "eb"],
    "g#/5": ["thumbB", "lh1", "lh2", "lh3", "gsharp", "eb"],
    "a/5":  ["thumbB", "lh1", "lh2", "eb"],
    "a#/5": ["thumbB", "lh1", "rh1", "eb"],
    "b/5":  ["thumbB", "lh1", "eb"]
  };

  var W = 24, H = 80;                 // diagram box, head joint at the top
  var CX = 15;                        // column of the six main keys

  /* The colours come from theme.css so the charts follow the light and dark
     palettes. They go in a style attribute rather than a fill attribute --
     var() is only understood in a declaration, not in a presentation
     attribute -- which also keeps them safe from the rule that recolours
     VexFlow's engraving around them on notes.html. */
  function paint(on){
    return ' style="fill:var(--grip-' + (on ? 'pressed' : 'open') + ')"';
  }

  function circle(cx, cy, r, on){
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + paint(on) + '/>';
  }

  function rrect(x, y, w, h, r, on){
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
           '" rx="' + r + '"' + paint(on) + '/>';
  }

  /* half disc, flat edge facing the key column */
  function halfDisc(x, y, r, on){
    return '<path d="M' + x + ' ' + y + ' A' + r + ' ' + r + ' 0 0 0 ' +
           x + ' ' + (y + 2 * r) + ' Z"' + paint(on) + '/>';
  }

  /* which keys a pitch holds down, as a lookup */
  function held(pitch){
    var keys = FINGERINGS[pitch];
    if(!keys){ return null; }
    var on = {};
    keys.forEach(function(k){ on[k] = true; });
    return on;
  }

  /* Markup for one diagram, drawn in its own 24x80 coordinate box.
     `sw` thins the outline for diagrams that will be blown up a long way. */
  function diagram(pitch, sw){
    var on = held(pitch);
    if(!on){ return ""; }

    return '<g style="stroke:var(--grip-stroke)" stroke-width="' + (sw || 0.9) +
      '" stroke-linejoin="round">' +
      /* thumb keys, off to the side */
      rrect(0.8, 4, 7.4, 6.4, 2, on.thumbBb) +
      halfDisc(8.2, 13, 4.2, on.thumbB) +
      /* left hand */
      circle(CX, 7.5, 3.1, on.lh1) +
      circle(CX, 16, 4.1, on.lh2) +
      circle(CX, 25, 4.1, on.lh3) +
      /* left pinky */
      rrect(0.8, 29.5, 7.4, 5, 2.5, on.gsharp) +
      /* right hand, with the two trill keys alongside */
      circle(CX, 39.5, 4.1, on.rh1) +
      circle(CX, 48.5, 4.1, on.rh2) +
      circle(CX, 57.5, 4.1, on.rh3) +
      rrect(20.3, 42, 3, 5, 1.5, on.trill1) +
      rrect(20.3, 51, 3, 5, 1.5, on.trill2) +
      /* right pinky */
      rrect(12.4, 62.5, 5.2, 9.4, 2.4, on.eb) +
      /* foot joint, with the low C key */
      rrect(12.4, 72.6, 5.2, 6, 2, on.lowC) +
      '<path d="M10 79.4h10" style="fill:none"/>' +
      '</g>';
  }

  /* ---------- the big drawing on index.html ----------
     The flute laid out left to right, with the six main holes labelled and the
     right little finger's E-flat key hanging off the end. Its colours are read
     back out of the cascade rather than named as var(): these are real DOM
     nodes with presentation attributes, not the markup the charts produce. */
  var REF_VIEWBOX = "0 0 420 170";

  /* Л1..П3 in Russian, L1..R3 in English, 左1..右3 in Japanese */
  function holeLabels(){
    var L = global.I18n.t("hand.left.short"), R = global.I18n.t("hand.right.short");
    return [L + "1", L + "2", L + "3", R + "1", R + "2", R + "3"];
  }

  function drawReference(svg, pitch){
    clear(svg);
    var T = global.I18n.t;
    var on = held(pitch) || {};
    var closed = [on.lh1, on.lh2, on.lh3, on.rh1, on.rh2, on.rh3, on.eb];

    var INK   = global.Theme.colourOf("ink");
    var LIGHT = global.Theme.colourOf("card");
    var SOFT  = global.Theme.colourOf("ink-soft");
    var BODY  = global.Theme.colourOf("flute-body");
    var HOLE_LABELS = holeLabels();

    var bodyY = 78, bodyH = 40;
    // корпус флейты
    svg.appendChild(el("rect",{
      x:14, y:bodyY, width:392, height:bodyH, rx:20,
      fill:BODY, stroke:INK, "stroke-width":3
    }));
    // головка (амбушюрное отверстие)
    svg.appendChild(el("ellipse",{
      cx:34, cy:bodyY + bodyH/2, rx:9, ry:6.5,
      fill:LIGHT, stroke:INK, "stroke-width":2.5
    }));
    svg.appendChild(el("text",{
      x:34, y:bodyY - 12, "text-anchor":"middle",
      "font-size":11, fill:SOFT, "font-family":"inherit"
    }, T("flute.svg.lips")));

    var cy = bodyY + bodyH/2;
    var xs = [78, 118, 158, 216, 256, 296];

    // подписи рук
    svg.appendChild(el("text",{
      x:118, y:bodyY - 22, "text-anchor":"middle",
      "font-size":12.5, fill:SOFT, "font-family":"inherit"
    }, T("flute.svg.left")));
    svg.appendChild(el("text",{
      x:256, y:bodyY - 22, "text-anchor":"middle",
      "font-size":12.5, fill:SOFT, "font-family":"inherit"
    }, T("flute.svg.right")));

    xs.forEach(function(x, i){
      svg.appendChild(el("circle",{
        cx:x, cy:cy, r:15,
        fill: closed[i] ? INK : LIGHT,
        stroke:INK, "stroke-width":3
      }));
      svg.appendChild(el("text",{
        x:x, y:cy + 38, "text-anchor":"middle",
        "font-size":12.5, fill:SOFT, "font-family":"inherit"
      }, HOLE_LABELS[i]));
    });

    // клапан мизинца (ми-бемоль) — меньше и сдвинут вниз-вправо
    var px = 352, py = cy + 16;
    svg.appendChild(el("line",{
      x1:340, y1:cy + 6, x2:px, y2:py - 9,
      stroke:INK, "stroke-width":2.5, "stroke-linecap":"round"
    }));
    svg.appendChild(el("circle",{
      cx:px, cy:py, r:10,
      fill: closed[6] ? INK : LIGHT,
      stroke:INK, "stroke-width":3
    }));
    svg.appendChild(el("text",{
      x:px + 4, y:py + 26, "text-anchor":"middle",
      "font-size":12, fill:SOFT, "font-family":"inherit"
    }, T("flute.svg.pinky")));
    svg.appendChild(el("text",{
      x:px + 4, y:py + 40, "text-anchor":"middle",
      "font-size":11, fill:SOFT, "font-family":"inherit"
    }, "(" + global.Note.step("e") + "♭)"));
  }

  global.Instruments.register({
    id: "flute",
    nameKey: "instrument.flute",
    range: {lo:60, hi:83},                    /* c/4 .. b/5 */
    has: function(pitch){ return !!FINGERINGS[pitch]; },
    clefFor: function(){ return "treble"; },  /* the flute never leaves it */

    chart: {
      width: W,
      height: H,
      diagram: diagram,

      /* the same diagram lying on its side, head joint to the left */
      hWidth: H,
      hHeight: W,
      horizontal: function(pitch, sw){
        var d = diagram(pitch, sw || 0.5);
        return d ? '<g transform="translate(0 ' + W + ') rotate(-90)">' + d + '</g>' : "";
      },

      /* one diagram placed inside a bigger SVG, optionally shrunk to fit a
         tight spot between two neighbouring notes */
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
        return Object.keys(FINGERINGS).sort(function(a, b){
          return global.Note.midi(a) - global.Note.midi(b);
        });
      },
      draw: drawReference,
      legend: function(){
        return [
          {key:"flute.legend.closed", fill:"var(--ink)"},
          {key:"flute.legend.open",   fill:"var(--card)"}
        ];
      }
    },

    copy: {
      subKey:       "flute.sub",
      chartCardKey: "flute.chartCard",
      aboutKey:     "flute.about",
      hintKey:      "flute.hint",
      onKey:        "flute.on"
    }
  });
})(window);
