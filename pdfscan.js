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
      var run = 0, best = 0, from = 0, bestFrom = 0, at = y * w;
      for(var x = 0; x < w; x++){
        if(ink[at + x]){
          if(!run){ from = x; }
          run++;
          if(run > best){ best = run; bestFrom = from; }
        } else { run = 0; }
      }
      /* where the line runs, as well as that it does: the clef sits at its
         left end and the notes start after it */
      if(best >= w * share){ rows.push({y:y, x0:bestFrom, x1:bestFrom + best}); }
    }
    return rows;
  }

  function staves(ink, w, h){
    var rows = staffRows(ink, w, h, 0.33);
    if(rows.length < 5){ return []; }

    /* a printed line is two or three pixels thick, so the rows come in clumps */
    var clumps = [], last = -9;
    rows.forEach(function(r){
      if(r.y - last > 3){ clumps.push([r]); } else { clumps[clumps.length - 1].push(r); }
      last = r.y;
    });

    var thick = Math.max(1, Math.round(clumps.reduce(function(n, c){ return n + c.length; }, 0) / clumps.length));
    var lines = clumps.map(function(c){ return c[c.length >> 1].y; });
    var lefts = clumps.map(function(c){ return c[c.length >> 1].x0; });
    var rights = clumps.map(function(c){ return c[c.length >> 1].x1; });

    var out = [];
    for(var i = 0; i + 4 < lines.length;){
      var five = lines.slice(i, i + 5), gaps = [];
      for(var k = 1; k < 5; k++){ gaps.push(five[k] - five[k - 1]); }
      var step = gaps.reduce(function(a, b){ return a + b; }, 0) / 4;
      var even = step > 3 && gaps.every(function(g){ return Math.abs(g - step) <= step * 0.3; });
      if(even){
        out.push({top:five[0], bottom:five[4], step:step, lines:five, thick:thick,
                  x0:Math.min.apply(null, lefts.slice(i, i + 5)),
                  x1:Math.max.apply(null, rights.slice(i, i + 5))});
        i += 5;
      } else {
        i += 1;
      }
    }
    return out;
  }

  /* ---------- the clef ----------
     A clef is drawn taller than the staff -- the treble runs a couple of spaces
     above and below it -- and it stands at the left end where no note ever
     starts. Nothing here reads which clef it is; what matters is where it
     stops, because its loop is a hollow head to any test that only looks at
     shape, and it is the reason a half note cannot be found by widening one.
     Whatever key signature follows is inside the same stretch. */
  function clefEnd(ink, w, h, staff){
    var reach = staff.step * 5;
    var from = Math.round(staff.top - staff.step * 2.5);
    var to = Math.round(staff.bottom + staff.step * 2.5);
    var last = staff.x0;

    /* The clef is the first tall thing on the staff and it is one thing: a run
       of columns whose ink reaches well past the staff, ending at the first
       real gap. Measuring the reach rather than an unbroken run is what finds
       it -- a clef is a curve, and any one column of it is mostly gaps -- but
       without the stop it would run on to the first slur and swallow the notes
       under it. */
    var started = false, quiet = 0;
    for(var x = staff.x0; x < Math.min(w, staff.x0 + staff.step * 9); x++){
      var first = -1, lastInk = -1;
      for(var y = Math.max(0, from); y <= Math.min(h - 1, to); y++){
        if(ink[y * w + x]){ if(first < 0){ first = y; } lastInk = y; }
      }
      var tall = first >= 0 && lastInk - first >= reach;
      if(tall){ last = x; started = true; quiet = 0; }
      else if(started && ++quiet > staff.step * 0.5){ break; }
    }
    return last;
  }

  /* ---------- chord grids ----------
     A guitar diagram is the one other thing on a page of songs made of
     parallel lines: four to six of them, short, in a little box over the vocal
     staff. They are not staves -- their lines are far too short -- but the
     shapes inside them are notehead-sized, so anything found in one has to be
     thrown away. Nothing new has to be looked for: the same row scan that
     finds staff lines finds these, at a shorter reach. */
  function grids(ink, w, h, step){
    var rows = [];
    for(var y = 0; y < h; y++){
      var run = 0, best = 0, from = 0, bestFrom = 0, at = y * w;
      for(var x = 0; x < w; x++){
        if(ink[at + x]){
          if(!run){ from = x; }
          run++;
          if(run > best){ best = run; bestFrom = from; }
        } else { run = 0; }
      }
      if(best >= step * 1.5 && best < w * 0.33){ rows.push({y:y, x0:bestFrom, x1:bestFrom + best}); }
    }

    var boxes = [], group = null;
    rows.forEach(function(r){
      if(group && r.y - group.y1 <= step * 1.2 &&
         r.x0 < group.x1 + step && r.x1 > group.x0 - step){
        group.y1 = r.y;
        group.lines++;
        group.x0 = Math.min(group.x0, r.x0);
        group.x1 = Math.max(group.x1, r.x1);
        return;
      }
      if(group && group.lines >= 3){ boxes.push(group); }
      group = {x0:r.x0, x1:r.x1, y0:r.y, y1:r.y, lines:1};
    });
    if(group && group.lines >= 3){ boxes.push(group); }

    /* a grid is small and roughly square; a run of short lines the width of the
       page is something else and is left alone */
    boxes = boxes.filter(function(b){
      return (b.x1 - b.x0) < w * 0.25 && (b.y1 - b.y0) < step * 6;
    });

    /* The line found first is usually the nut, the thick one across the top;
       the frets under it are thinner and shorter and were not long enough to be
       noticed on their own. So each box is grown downwards while the rows below
       it still carry ink across most of its width -- which is what a fret does
       and what the empty paper beside a staff does not. */
    boxes.forEach(function(b){
      var wide = (b.x1 - b.x0) * 0.4;
      var quiet = 0;
      for(var y = b.y1 + 1; y < h && quiet < step * 0.8; y++){
        var n = 0;
        for(var x = b.x0; x <= b.x1; x++){ if(ink[y * w + x]){ n++; } }
        if(n >= wide){ b.y1 = y; quiet = 0; } else { quiet++; }
      }
    });

    return boxes;
  }

  function inside(boxes, x, y, step){
    return boxes.some(function(b){
      return x > b.x0 - step && x < b.x1 + step && y > b.y0 - step && y < b.y1 + step;
    });
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
    var wide = new Uint8Array(w * h);
    for(var y = 0; y < h; y++){
      var at = y * w, x = 0;
      while(x < w){
        if(!mask[at + x]){ x++; continue; }
        var from = x;
        while(x < w && mask[at + x]){ x++; }
        if(x - from >= least){
          for(var k = from; k < x; k++){ wide[at + k] = 1; }
        }
      }
    }

    /* And the mirror of that. A tie or a slur is wide -- it survives the test
       above -- but it is only two or three pixels deep, where a head is most of
       a space. Dropping the shallow ones unglues a head from the tie it is
       joined to; without this a head and its tie are one long blob, too wide to
       be a head, and the note is lost rather than found. */
    var deep = Math.max(3, Math.round(step * 0.4));
    var out = new Uint8Array(w * h);
    for(var x2 = 0; x2 < w; x2++){
      var y2 = 0;
      while(y2 < h){
        if(!wide[y2 * w + x2]){ y2++; continue; }
        var top = y2;
        while(y2 < h && wide[y2 * w + x2]){ y2++; }
        if(y2 - top >= deep){
          for(var k2 = top; k2 < y2; k2++){ out[k2 * w + x2] = 1; }
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
    var boxes = grids(ink, w, h, list[0].step);

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
      var after = clefEnd(ink, w, h, staff) + step * 0.8;

      blobs(solid, w, h, y0, y1, 3000).forEach(function(b){
        if(b.full){ return; }
        /* A rest is a filled rectangle and fills its box; a head is an ellipse
           and leaves the corners empty. The two are the same size and sit in
           the same places, so this is the difference. It only means anything
           once the ties are gone, which is what the second pass above is for. */
        if(b.n / (b.w * b.h) > 0.93){ return; }
        if(b.w < step * 0.6 || b.w > step * 1.9){ return; }
        if(b.h < step * 0.4 || b.h > step * 1.3){ return; }
        /* a head leans wide -- and a mark as tall as it is broad is something
           else: the corner of a rest, a letter, the dot of a chord grid */
        if(b.w < b.h * 1.1){ return; }
        if(!onStep(staff, b.y)){ return; }
        /* A rest is the same size as a head and lands on the staff like one;
           what it never has is a stem. Neither does a whole note, but a melody
           is not made of them, and a wrong note is worse than a missing one. */
        if(!hasStem(ink, w, h, b, step)){ return; }
        if(inside(boxes, b.x, b.y, step)){ return; }
        if(b.x < after){ return; }
        here.push({x:b.x, y:b.y, filled:true, w:b.w, h:b.h, fill:b.n / (b.w * b.h)});
      });

      /* Holes are looked for after the staff lines are gone. With them still
         in, a space between two lines closed off by a barline at one end and a
         rest at the other is an enclosed patch of white, exactly like the
         inside of a half note -- that is where the false one in the first
         system came from. A notehead's ring is not a staff line and survives
         the erasing, so nothing real is lost. */
      holes(clean, w, h, y0, y1).forEach(function(b){
        if(b.full){ return; }
        /* The hole in a half note is nearly the size of the head around it --
           sixteen pixels across a space of eighteen on the page this was built
           against. The window was tight while the treble clef's loop was still
           in play, since that is the same shape; now the clef is skipped, the
           window can be the size the note actually is. */
        if(b.w < step * 0.3 || b.w > step * 1.35){ return; }
        if(b.h < step * 0.2 || b.h > step * 1.05){ return; }
        /* the hole in a half note is an ellipse lying down, half again as wide
           as it is tall; a square hole is a gap between two other things */
        if(b.w < b.h * 1.2){ return; }
        if(!onStep(staff, b.y)){ return; }
        if(!hasStem(ink, w, h, {x:b.x, y:b.y, w:step}, step)){ return; }
        if(inside(boxes, b.x, b.y, step)){ return; }
        if(b.x < after){ return; }
        here.push({x:b.x, y:b.y, filled:false, w:b.w, h:b.h, fill:b.n / (b.w * b.h)});
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

      kept.forEach(function(n){
        notes.push({staff:staff, x:n.x, y:n.y, filled:n.filled, w:n.w, h:n.h, fill:n.fill});
      });
    });

    return {staves:list, systems:groups, wanted:wanted, notes:notes, grids:boxes};
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
