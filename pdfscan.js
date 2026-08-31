/* Reading music off a scanned page.
 *
 * pdfscore.js reads an engraving: a page whose staff lines and noteheads are
 * drawn objects with coordinates. A scan has none of that. It is one picture of
 * a piece of paper, so everything has to be found by looking at pixels -- which
 * is the same problem this repository already solved once by hand, when the
 * original score and the fingering charts were recovered from the PNGs inside a
 * drawio file. tools/README.md is that story; this is the same method, running
 * in the app instead of in a one-off script.
 *
 * The method, in order:
 *
 *   staff lines   rows carrying a black run across a good part of the page.
 *                 A chord grid over the vocal line is five short parallel
 *                 lines and would pass a looser test, which is why the run has
 *                 to be long rather than merely long-ish.
 *   staves        five lines at an even spacing. The spacing is the ruler for
 *                 everything after: a notehead is about one space.
 *   erasing       a staff line is removed only where the ink through it is as
 *                 thin as the line itself, so a note sitting on the line keeps
 *                 its head.
 *   heads         erode by one pixel on every side: a stem two or three wide
 *                 disappears, a head eighteen by thirteen only slims. What is
 *                 left standing is a head -- if it is the right size, the right
 *                 shape, and lands on a step of the staff.
 *   hollow heads  do not survive erosion, because they are a ring. They are
 *                 found as the ring instead: a closed patch of white inside
 *                 ink. That alone is not enough -- a page of song has far more
 *                 holes in its lyrics than notes on its staves -- so a hollow
 *                 head also has to have a stem beside it and sit on a step.
 *
 * What this does not do: rhythm. A scan gives no /ToUnicode map to name a flag
 * or a rest, and reading those from pixels is another problem again, so every
 * note comes in as a quarter and the dialog says so.
 */
(function(global){
  "use strict";

  function fail(key, english){
    var e = new Error(english);
    e.i18n = key;
    return e;
  }

  /* ---------- the ink ----------
     A stencil mask paints where its sample is zero, and a scanner may store the
     page either way round; a page of music is mostly paper, so the rarer colour
     is the ink. That is a fact about music rather than about PDF, which is why
     the reader hands over the samples and the decision is made here. */
  function inkOf(image){
    var set = 0, i;
    for(i = 0; i < image.samples.length; i++){ set += image.samples[i]; }
    var inkIsSet = set * 2 < image.samples.length;

    var ink = new Uint8Array(image.samples.length);
    for(i = 0; i < ink.length; i++){
      ink[i] = ((image.samples[i] === 1) === inkIsSet) ? 1 : 0;
    }
    return ink;
  }

  /* ---------- staff lines ---------- */
  function staffRows(ink, w, h, share){
    var rows = [];
    for(var y = 0; y < h; y++){
      var run = 0, best = 0, at = y * w;
      for(var x = 0; x < w; x++){
        if(ink[at + x]){ run++; if(run > best){ best = run; } } else { run = 0; }
      }
      if(best >= w * share){ rows.push(y); }
    }
    return rows;
  }

  function staves(ink, w, h){
    var rows = staffRows(ink, w, h, 0.33);
    if(rows.length < 5){ return []; }

    /* a printed line is two or three pixels thick, so the rows come in clumps */
    var clumps = [], last = -9;
    rows.forEach(function(y){
      if(y - last > 3){ clumps.push([y]); } else { clumps[clumps.length - 1].push(y); }
      last = y;
    });

    var thick = Math.max(1, Math.round(clumps.reduce(function(n, c){ return n + c.length; }, 0) / clumps.length));
    var lines = clumps.map(function(c){ return c[c.length >> 1]; });

    var out = [];
    for(var i = 0; i + 4 < lines.length;){
      var five = lines.slice(i, i + 5), gaps = [];
      for(var k = 1; k < 5; k++){ gaps.push(five[k] - five[k - 1]); }
      var step = gaps.reduce(function(a, b){ return a + b; }, 0) / 4;
      var even = step > 3 && gaps.every(function(g){ return Math.abs(g - step) <= step * 0.3; });
      if(even){
        out.push({top:five[0], bottom:five[4], step:step, lines:five, thick:thick});
        i += 5;
      } else {
        i += 1;
      }
    }
    return out;
  }

  /* ---------- systems ----------
     Staves sit closer inside a system than between systems, so the gaps fall
     into two groups and the wide ones are the breaks. A page of one staff per
     system has no wide gaps at all, which reads as one system per staff. */
  function systems(list){
    if(!list.length){ return []; }
    var gaps = [];
    for(var i = 1; i < list.length; i++){ gaps.push(list[i].top - list[i - 1].bottom); }
    if(!gaps.length){ return [[list[0]]]; }

    /* Two kinds of page. On one the gaps come in two sizes -- tight inside a
       system, wide between them -- and the wide ones are the breaks. On the
       other every gap is the same, which means every staff stands alone: one
       part, one staff to a system. Telling them apart by the spread is the
       whole of it. */
    var lo = Math.min.apply(null, gaps), hi = Math.max.apply(null, gaps);
    var cut = hi > lo * 1.6 ? (lo + hi) / 2 : -1;

    var out = [[list[0]]];
    for(i = 1; i < list.length; i++){
      if(list[i].top - list[i - 1].bottom > cut){ out.push([]); }
      out[out.length - 1].push(list[i]);
    }
    return out;
  }

  /* ---------- erasing the lines ---------- */
  function withoutLines(ink, w, h, list){
    var clean = new Uint8Array(ink);
    list.forEach(function(st){
      st.lines.forEach(function(ly){
        for(var x = 0; x < w; x++){
          if(!ink[ly * w + x]){ continue; }
          var up = ly, down = ly;
          while(up > 0 && ink[(up - 1) * w + x]){ up--; }
          while(down < h - 1 && ink[(down + 1) * w + x]){ down++; }
          if(down - up + 1 <= st.thick + 2){
            for(var y = up; y <= down; y++){ clean[y * w + x] = 0; }
          }
        }
      });
    });
    return clean;
  }

  /* ---------- what is left when the thin things go ----------
     A stem is narrow across and long down; a notehead is the other way round.
     So a row of ink shorter than half a space is not part of a head, and
     dropping those severs every head from its stem, its beam and its flag --
     which erosion alone does not, since a stem three pixels wide survives
     losing one from each side. What remains is heads, beams and the odd thick
     mark, and the last two are told apart by size. */
  function cores(mask, w, h, step){
    var least = Math.max(3, Math.round(step * 0.5));
    var out = new Uint8Array(w * h);
    for(var y = 0; y < h; y++){
      var at = y * w, x = 0;
      while(x < w){
        if(!mask[at + x]){ x++; continue; }
        var from = x;
        while(x < w && mask[at + x]){ x++; }
        if(x - from >= least){
          for(var k = from; k < x; k++){ out[at + k] = 1; }
        }
      }
    }
    return out;
  }

  /* ---------- pieces of a mask ----------
     Four-connected, bounded, and told to stop rather than swallow the page: a
     beam joins half a bar together and there is no use following it. */
  function blobs(mask, w, h, y0, y1, limit){
    var seen = new Uint8Array(w * h);
    var out = [];
    for(var y = Math.max(1, y0); y <= Math.min(h - 2, y1); y++){
      for(var x = 1; x < w - 1; x++){
        var at = y * w + x;
        if(!mask[at] || seen[at]){ continue; }
        var queue = [at], head = 0, n = 0;
        var minX = x, maxX = x, minY = y, maxY = y;
        seen[at] = 1;
        while(head < queue.length && n < limit){
          var p = queue[head++], px = p % w, py = (p - px) / w;
          n++;
          if(px < minX){ minX = px; } if(px > maxX){ maxX = px; }
          if(py < minY){ minY = py; } if(py > maxY){ maxY = py; }
          if(px > 0 && mask[p - 1] && !seen[p - 1]){ seen[p - 1] = 1; queue.push(p - 1); }
          if(px < w - 1 && mask[p + 1] && !seen[p + 1]){ seen[p + 1] = 1; queue.push(p + 1); }
          if(py > 0 && mask[p - w] && !seen[p - w]){ seen[p - w] = 1; queue.push(p - w); }
          if(py < h - 1 && mask[p + w] && !seen[p + w]){ seen[p + w] = 1; queue.push(p + w); }
        }
        out.push({x:(minX + maxX) / 2, y:(minY + maxY) / 2, w:maxX - minX + 1, h:maxY - minY + 1,
                  n:n, full:n >= limit});
      }
    }
    return out;
  }

  /* Is there a stem on this head? A stem leaves the head at one side and runs
     two or three spaces up or down, so the test is: somewhere across the head's
     width, is there a column of ink that keeps going well past it? A rest has
     nothing of the kind, which is what tells the two apart -- they are the same
     size and sit in the same places. */
  function hasStem(ink, w, h, at, step){
    var reach = Math.round(step * 1.8);
    var from = Math.max(0, Math.round(at.x - step * 0.9));
    var to = Math.min(w - 1, Math.round(at.x + step * 0.9));
    var cy = Math.round(at.y);

    for(var x = from; x <= to; x++){
      var up = 0, down = 0, y;
      for(y = Math.round(cy - step * 0.55); y >= 0 && ink[y * w + x]; y--){ up++; }
      for(y = Math.round(cy + step * 0.55); y < h && ink[y * w + x]; y++){ down++; }
      if(up >= reach && narrow(ink, w, x, Math.round(cy - step * 1.6), step)){ return true; }
      if(down >= reach && narrow(ink, w, x, Math.round(cy + step * 1.6), step)){ return true; }
    }
    return false;
  }

  /* A stem stays thin all the way along. A rest is as tall as a stem is long
     and would pass a test that only measured height -- it is wide where a stem
     is narrow, and that is what separates them. */
  function narrow(ink, w, x, y, step){
    if(y < 0){ return false; }
    var at = y * w;
    if(!ink[at + x]){ return false; }
    var left = x, right = x;
    while(left > 0 && ink[at + left - 1]){ left--; }
    while(right < w - 1 && ink[at + right + 1]){ right++; }
    return (right - left + 1) <= step * 0.45;
  }

  function outside(staff, y){
    return y < staff.top - staff.step * 0.6 || y > staff.bottom + staff.step * 0.6;
  }

  /* Does it sit on a line or in a space, rather than between the two? */
  function onStep(staff, y){
    var half = staff.step / 2;
    var steps = (staff.bottom - y) / half;
    return Math.abs(steps - Math.round(steps)) < 0.3;
  }

  /* ---------- hollow heads ----------
     A half note is a ring, so erosion loses it. The ring is found the other way
     round -- as the white it encloses -- but a page of song has holes in every
     lyric, so a hole only counts with a stem beside it and a step under it. */
  function holes(ink, w, h, y0, y1){
    var white = new Uint8Array(w * h);
    for(var i = 0; i < white.length; i++){ white[i] = ink[i] ? 0 : 1; }
    /* flood the outside so what is left of the white is enclosed */
    var queue = [], seen = new Uint8Array(w * h);
    for(var x = 0; x < w; x++){
      [0, h - 1].forEach(function(y){
        var at = y * w + x;
        if(white[at] && !seen[at]){ seen[at] = 1; queue.push(at); }
      });
    }
    for(var y2 = 0; y2 < h; y2++){
      [0, w - 1].forEach(function(x2){
        var at = y2 * w + x2;
        if(white[at] && !seen[at]){ seen[at] = 1; queue.push(at); }
      });
    }
    var head = 0;
    while(head < queue.length){
      var p = queue[head++], px = p % w, py = (p - px) / w;
      if(px > 0 && white[p - 1] && !seen[p - 1]){ seen[p - 1] = 1; queue.push(p - 1); }
      if(px < w - 1 && white[p + 1] && !seen[p + 1]){ seen[p + 1] = 1; queue.push(p + 1); }
      if(py > 0 && white[p - w] && !seen[p - w]){ seen[p - w] = 1; queue.push(p - w); }
      if(py < h - 1 && white[p + w] && !seen[p + w]){ seen[p + w] = 1; queue.push(p + w); }
    }
    var inside = new Uint8Array(w * h);
    for(i = 0; i < inside.length; i++){ inside[i] = white[i] && !seen[i] ? 1 : 0; }
    return blobs(inside, w, h, y0, y1, 4000);
  }

  function read(image){
    var w = image.width, h = image.rows || image.height;
    var ink = inkOf(image);
    var list = staves(ink, w, h);
    if(!list.length){ return {staves:[], systems:[], notes:[]}; }

    var clean = withoutLines(ink, w, h, list);
    var solid = cores(clean, w, h, list[0].step);
    var groups = systems(list);

    /* the melody is the top staff of a system: the vocal line of a song, the
       right hand of a piano part. The rest is accompaniment and would
       interleave a second part into the line. */
    var wanted = groups.map(function(g){ return g[0]; });

    var notes = [];
    wanted.forEach(function(staff){
      var step = staff.step;
      /* three spaces past the staff is two ledger lines, which is as far as a
         melody goes; further down is where the words are */
      var y0 = Math.round(staff.top - step * 3.2);
      var y1 = Math.round(staff.bottom + step * 3.2);
      var here = [];

      blobs(solid, w, h, y0, y1, 3000).forEach(function(b){
        if(b.full){ return; }
        if(b.w < step * 0.6 || b.w > step * 1.9){ return; }
        if(b.h < step * 0.4 || b.h > step * 1.3){ return; }
        if(b.w < b.h){ return; }                       /* a head leans wide */
        if(!onStep(staff, b.y)){ return; }
        /* A rest is the same size as a head and lands on the staff like one;
           what it never has is a stem. Neither does a whole note, but a melody
           is not made of them, and a wrong note is worse than a missing one. */
        if(!hasStem(ink, w, h, b, step)){ return; }
        here.push({x:b.x, y:b.y, filled:true});
      });

      holes(ink, w, h, y0, y1).forEach(function(b){
        if(b.full){ return; }
        if(b.w < step * 0.3 || b.w > step * 1.2){ return; }
        if(b.h < step * 0.2 || b.h > step * 0.9){ return; }
        if(b.w < b.h){ return; }
        if(!onStep(staff, b.y)){ return; }
        if(!hasStem(ink, w, h, {x:b.x, y:b.y, w:step}, step)){ return; }
        here.push({x:b.x, y:b.y, filled:false});
      });

      here.sort(function(a, b){ return a.x - b.x; });

      /* one note to a moment: heads stacked at the same x are a chord and the
         top one is the melody */
      var kept = [];
      here.forEach(function(n){
        var last = kept[kept.length - 1];
        if(last && Math.abs(n.x - last.x) < step * 0.7){
          if(n.y < last.y){ kept[kept.length - 1] = n; }
          return;
        }
        kept.push(n);
      });

      kept.forEach(function(n){ notes.push({staff:staff, x:n.x, y:n.y, filled:n.filled}); });
    });

    return {staves:list, systems:groups, wanted:wanted, notes:notes};
  }

  var LETTERS = ["c", "d", "e", "f", "g", "a", "b"];
  var TREBLE_BOTTOM = 4 * 7 + 2;               /* e/4 on the bottom line */

  /* Nothing on a scan says which clef this is -- the glyph is a picture like
     everything else -- so the treble is assumed and reported. The staff a
     melody is on is a treble staff in every song and nearly every piano part. */
  function pitchOf(note){
    var steps = Math.round((note.staff.bottom - note.y) / (note.staff.step / 2));
    var n = TREBLE_BOTTOM + steps;
    return LETTERS[((n % 7) + 7) % 7] + "/" + Math.floor(n / 7);
  }

  global.PdfScan = {
    read: read,
    pitchOf: pitchOf,
    _staves: staves,
    _ink: inkOf
  };
})(typeof window !== "undefined" ? window : globalThis);
