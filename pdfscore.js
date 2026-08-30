/* Turning an engraved PDF into a piece you can practise.
 *
 * The same shape as songimport.js and audioimport.js -- read -> analyze ->
 * convert -- so the dialog that asks which line to play, the octave shift, the
 * warning about notes the instrument cannot reach and the saving all work here
 * without a change.
 *
 * The division of labour is the same too. pdfread.js opens the file and says
 * what is drawn on the page and where: filled paths, strokes, glyphs, images,
 * each with a box in page coordinates. It knows nothing about music. This file
 * is the other half and knows nothing about PDF syntax: it looks at those boxes
 * and decides which of them are staff lines and which are noteheads, and where
 * a head sits on its staff.
 *
 * What it reads, and what it does not, stated plainly because the reader is
 * told the same thing before they press Add:
 *
 *   pitch      read, from the head's position on the staff
 *   order      read, left to right within a staff, staff by staff down the page
 *   clef       read, from where the clef glyph sits: a treble clef is drawn on
 *              the G line and a bass clef on the F line, whatever font it is
 *              in, so the baseline says which it is without naming a glyph
 *   accidental read when the file says what its glyphs mean -- a /ToUnicode
 *              map names them, and both conventions are understood. A key
 *              signature holds for its staff; one beside a head holds for that
 *              head and, for want of barlines, no further
 *   length     read where the page shows it: a stem with a flag or a beam is
 *              halved once per flag or beam, a dot beside the head adds half
 *              again, and a head with no stem is a whole note. A hollow head is
 *              not told from a filled one, so a half note arrives as a quarter
 *              -- which the bar it sits in usually catches, since a bar that
 *              does not add up is the sign that a length was guessed
 *
 * That is a fingering trainer's half of the problem: the pitches and their
 * order are what a player practises against, and an even beat is a usable
 * default for that. Rhythm is where this has to grow next, and the shape of
 * the growth is known -- a filled head against a hollow one, a stem, a beam,
 * a flag.
 *
 * Engravers draw the same page two ways, and both are here. A staff line is a
 * thin filled rectangle or a thin stroke; a notehead is a small filled curve or
 * a glyph of the music font. The second pair is what real files use -- Finale
 * wrote the first one we were given with stroked staff lines and heads out of
 * an embedded subset font -- and nothing in the file names those glyphs, so the
 * head is found by how it behaves: it is the glyph that appears far more often
 * than any other and at more heights and more places along the staff. A rest or
 * a clef appears at one height; a dot follows the notes but is rarer than they
 * are.
 *
 * A piano score is read from its treble staves only. The bass staff of a piano
 * system is not the melody, and reading both would interleave two parts into
 * one nonsense line -- so the clef decides, and the number of staves left out
 * is reported rather than hidden.
 *
 * A scan is refused rather than guessed at. There are no coordinates inside a
 * photograph, so nothing here can apply to it; saying so is more use than
 * importing an empty piece.
 */
(function(global){
  "use strict";

  /* Errors reach the player, so they carry a translation key and an English
     fallback, exactly as the other two importers do. */
  function fail(key, english){
    var e = new Error(english);
    e.i18n = key;
    return e;
  }

  function instrument(){
    return (global.Instruments && global.Instruments.current()) || null;
  }

  function playableOn(pitch){
    var inst = instrument();
    return !!(inst && inst.has(pitch));
  }

  /* ---------- reading the file ----------
     Streams inside a PDF are deflated, and the two callers differ: the page has
     DecompressionStream, node has zlib. pdfread.js takes the inflater as an
     argument for that reason, so this only has to say which one it is. */
  function browserInflate(bytes){
    if(!global.DecompressionStream){
      throw fail("import.err.pdfInflate", "this browser cannot unpack a compressed PDF");
    }
    var stream = new global.Response(bytes).body
      .pipeThrough(new global.DecompressionStream("deflate"));
    return new global.Response(stream).arrayBuffer().then(function(buf){
      return new Uint8Array(buf);
    });
  }

  /* No page of music is one page long by accident, but a book is not what
     anyone imports into a trainer either, and every page costs a full parse.
     Eight is past any exercise and short of a volume. */
  var MAX_PAGES = 8;

  function readBytes(bytes, inflate){
    return global.PdfRead.open(bytes, inflate || browserInflate).then(function(doc){
      var count = Math.min(doc.pages.length, MAX_PAGES);
      var pages = [];

      function next(i){
        if(i >= count){ return pages; }
        return global.PdfRead.page(doc, i).then(function(pg){
          pages.push(pg);
          return next(i + 1);
        });
      }

      return Promise.resolve(next(0)).then(function(){
        if(!pages.length){ throw fail("import.err.pdfEmpty", "this PDF has no pages"); }

        /* The first page decides what sort of file this is. A scan carries one
           image and no geometry, and no amount of work here recovers notes
           from it -- that is image recognition, a different program. */
        var kind = global.PdfRead.classify(pages[0]);
        if(kind.kind === "scan"){
          throw fail("import.err.pdfScan", "this PDF is a scan: " + kind.why);
        }
        if(kind.kind === "empty" || kind.kind === "sparse"){
          throw fail("import.err.pdfEmpty", "there is not enough on this page: " + kind.why);
        }
        return {kind:"pdf", pages:pages, verdict:kind, seen:null};
      });
    });
  }

  function read(file){
    return file.arrayBuffer().then(function(buf){
      return readBytes(new Uint8Array(buf), null);
    });
  }

  /* ---------- staff lines ----------
     An engraver emits a staff line as a filled rectangle a fraction of a point
     thick and most of the width of the page, so that is what is looked for
     rather than anything cleverer. Five of them at an even spacing are a
     staff; a run that is not five -- a bracket, a rule under a title, a table
     -- is left alone rather than made to fit. */
  function staffLines(page){
    var wide = page.width * 0.25;
    var out = page.fills.filter(function(f){
      return f.rect && f.h <= 2.5 && f.w >= wide;
    }).concat(page.strokes.filter(function(f){
      return f.h <= 0.5 && f.w >= wide;
    }));

    out.sort(function(a, b){ return b.y - a.y; });     /* top of the page first */

    /* a line drawn twice, or a stroke redrawn as a fill, is still one line */
    return out.filter(function(f, i){
      return i === 0 || Math.abs(centre(out[i - 1]) - centre(f)) > 0.5;
    });
  }

  function staves(page){
    var lines = staffLines(page);
    var out = [];
    var i = 0;

    while(i + 4 < lines.length){
      var five = lines.slice(i, i + 5);
      var gaps = [];
      for(var k = 1; k < 5; k++){
        gaps.push(centre(five[k - 1]) - centre(five[k]));
      }
      var step = gaps.reduce(function(a, b){ return a + b; }, 0) / gaps.length;
      var even = step > 1 && gaps.every(function(g){ return Math.abs(g - step) <= step * 0.25; });

      if(even){
        out.push({
          top: centre(five[0]),
          bottom: centre(five[4]),
          step: step,
          x0: Math.min.apply(null, five.map(function(f){ return f.x; })),
          x1: Math.max.apply(null, five.map(function(f){ return f.x + f.w; }))
        });
        i += 5;
      } else {
        i += 1;                 /* not a staff -- step past this line, not past five */
      }
    }
    return out;
  }

  function centre(f){ return f.y + f.h / 2; }

  /* ---------- which clef ----------
     A clef is drawn from the line it names: the treble curls round the G line,
     two half-spaces up from the bottom, and the bass sits its dots either side
     of the F line, six up. That is true of every music font, so the leftmost
     glyph on the staff answers the question by where it sits, and nothing has
     to know what the glyph is called -- which matters, because a subset font
     carries its noteheads under codes that mean nothing outside that file. */
  var TREBLE_BOTTOM = 4 * 7 + 2;               /* e/4 on the bottom line */
  var BASS_BOTTOM = 2 * 7 + 4;                 /* g/2 */

  function clefOf(staff, glyphs){
    var here = glyphs.filter(function(g){
      return g.y <= staff.top + staff.step * 3 && g.y >= staff.bottom - staff.step * 3;
    }).sort(function(a, b){ return a.x - b.x; });
    if(!here.length){ return "treble"; }

    var half = (here[0].y - staff.bottom) / (staff.step / 2);
    if(Math.abs(half - 6) < 1){ return "bass"; }
    if(Math.abs(half - 2) < 1){ return "treble"; }
    return "treble";                           /* unreadable: say so upstream */
  }

  /* ---------- the music font ----------
     The one an engraver embeds as a subset, and the one carrying most of the
     glyphs on the page. A page whose only font is the label under the title has
     none of this, which is how the drawn-by-hand samples fall through to the
     geometry below. */
  function musicFont(page){
    var counts = {};
    page.texts.forEach(function(t){ counts[t.font] = (counts[t.font] || 0) + t.length; });

    var best = null;
    (page.fonts || []).forEach(function(f){
      if(!f.embedded || !f.subset){ return; }
      var n = counts[f.key] || 0;
      if(n >= 20 && (!best || n > counts[best.key])){ best = f; }
    });
    return best;
  }

  function codeOf(text){
    var n = 0;
    for(var i = 0; i < text.codes.length; i++){ n = (n << 8) | text.codes.charCodeAt(i); }
    return n;
  }

  /* ---------- the notehead among the glyphs ----------
     Nothing in the file says which glyph is a notehead, so it is found by how
     it behaves. Heads are the commonest thing on a page of music, they appear
     at many heights because that is what a melody is, and they are spread along
     the staff. A clef or a time signature sits at one height and one place; a
     rest at one height; an augmentation dot moves with the notes but there are
     fewer of them. A second head shape -- hollow against filled -- is taken too
     when it is nearly as common as the first, and only then. */
  function headCodes(page, font, list){
    var seen = {};

    page.texts.forEach(function(t){
      if(t.font !== font.key){ return; }
      var st = staffFor(t.y, list);
      if(st === null){ return; }
      var code = codeOf(t);
      var s = seen[code] || (seen[code] = {n:0, heights:{}, xs:{}});
      s.n++;
      s.heights[Math.round((t.y - list[st].bottom) / (list[st].step / 2))] = true;
      s.xs[Math.round(t.x)] = true;
    });

    var ranked = Object.keys(seen).map(function(code){
      var s = seen[code];
      return {code:+code, n:s.n, heights:Object.keys(s.heights).length, xs:Object.keys(s.xs).length};
    }).sort(function(a, b){ return b.n - a.n; });

    var first = ranked[0];
    if(!first || first.n < 8 || first.heights < 4 || first.xs < 4){ return []; }

    return ranked.filter(function(r){
      return r === first || (r.n >= first.n * 0.5 && r.n >= 6 && r.heights >= 4);
    }).map(function(r){ return r.code; });
  }

  /* ---------- stems, beams, flags, dots ----------
     What tells the lengths apart is structure, not the name of a glyph. A
     notehead always has a stem beside it; a rest never does and sits at the
     same height every time, because a rest has no pitch. A flag is drawn at
     the far end of a stem and moves with it. A dot sits just to the right of a
     head, at the head's own height. A beam is a filled bar across the ends of
     several stems.

     None of that needs to know which font this is, which is the point: the
     accidentals could be read because a /ToUnicode map names a flat as the
     letter b, but nothing names a quarter rest, and guessing from a memory of
     one publisher's layout is how a reader becomes wrong on the next file. */
  function stemsOf(page, staff){
    return page.strokes.filter(function(t){
      return t.w <= staff.step * 0.3 && t.h > staff.step * 0.8;
    });
  }

  function hasStem(stems, t, staff){
    return stems.some(function(v){
      return Math.abs(v.x - t.x) < staff.step * 2 &&
             Math.abs((v.y + v.h / 2) - t.y) < staff.step * 5;
    });
  }

  /* A beam is wider than it is tall, filled, straight, and about a third of a
     space thick; a bar of music is none of those things and a barline is
     taller than it is wide. */
  function beamsOf(page, staff){
    return page.fills.filter(function(f){
      return !f.curves && f.h >= staff.step * 0.15 && f.h <= staff.step * 1.2 &&
             f.w >= staff.step && f.w <= staff.step * 40;
    });
  }

  function beamsOver(beams, x, staff){
    var n = 0;
    beams.forEach(function(b){
      if(x >= b.x - staff.step * 0.6 && x <= b.x + b.w + staff.step * 0.6){ n++; }
    });
    return n;
  }

  function staffFor(y, list){
    var best = null, bestGap = Infinity;
    list.forEach(function(st, i){
      var gap = y > st.top ? y - st.top : (y < st.bottom ? st.bottom - y : 0);
      if(gap < bestGap){ bestGap = gap; best = i; }
    });
    if(best === null || bestGap > list[best].step * 3.5){ return null; }
    return best;
  }

  /* ---------- sharps, flats and naturals ----------
     A subset font names nothing, but a PDF that carries a /ToUnicode map says
     what each code was meant to be, and engravers write one. Two conventions
     appear: SMuFL fonts map into the musical block at U+E000, and the older
     Finale and Sibelius fonts map into the private-use area at U+F000 plus the
     ASCII code the glyph used to sit at -- so a flat is U+F062, the letter b.
     Both are read here, and a file with no map simply has no accidentals read,
     which is where this started. */
  var SMUFL = {0xE260:"flat", 0xE261:"natural", 0xE262:"sharp"};
  var LEGACY = {0x62:"flat", 0x6E:"natural", 0x23:"sharp"};
  var SEMITONES = {flat:-1, natural:0, sharp:1};

  function meaning(font, code){
    var u = font.map ? font.map[code] : 0;
    if(!u){ return null; }
    if(SMUFL[u]){ return SMUFL[u]; }
    if(u >= 0xF000 && u <= 0xF0FF){ u -= 0xF000; }
    return LEGACY[u] || null;
  }

  function accidentals(page, font, list){
    var out = [];
    page.texts.forEach(function(t){
      var what = meaning(font, codeOf(t));
      if(!what){ return; }
      var st = staffFor(t.y, list);
      if(st === null){ return; }
      out.push({staff:st, x:t.x, y:t.y, what:what});
    });
    return out;
  }

  /* Which letter a height on the staff is, ignoring the octave: what a key
     signature alters. */
  function letterAt(y, staff){
    var steps = Math.round((y - staff.bottom) / (staff.step / 2));
    var n = (staff.clef === "bass" ? BASS_BOTTOM : TREBLE_BOTTOM) + steps;
    return ((n % 7) + 7) % 7;
  }

  /* Which codes are rests and which are flags, told apart by the stem: every
     flag has one because it is drawn on one, and no rest ever does. A rest also
     sits at the same height whenever it appears -- it has no pitch to follow. */
  function vocabulary(page, font, list, heads, headCodes){
    var stems = list.length ? stemsOf(page, list[0]) : [];
    var seen = {};

    page.texts.forEach(function(t){
      if(t.font !== font.key){ return; }
      var si = staffFor(t.y, list);
      if(si === null){ return; }
      var st = list[si];
      var code = codeOf(t);
      var v = seen[code] || (seen[code] = {n:0, stemmed:0, heights:{}, afterHead:0});
      v.n++;
      if(hasStem(stems, t, st)){ v.stemmed++; }
      v.heights[Math.round((t.y - st.bottom) / (st.step / 2))] = true;
      /* a dot is the thing that keeps turning up just right of a head, level
         with it -- the one mark that follows another rather than the staff */
      if(heads.some(function(h){
        return h.staff === si && Math.abs(h.y - t.y) < st.step * 0.35 &&
               t.x - h.x > 0 && t.x - h.x < st.step * 2.2;
      })){ v.afterHead++; }
    });

    var rests = [], flags = [], dot = null, dotScore = 0;
    Object.keys(seen).forEach(function(code){
      /* a notehead is stemmed and wanders up and down like a flag does, so it
         has to be taken out by name or every chord reads as a pile of flags */
      if(headCodes.indexOf(+code) >= 0){ return; }
      var v = seen[code], heights = Object.keys(v.heights).length;
      if(v.n >= 2 && v.stemmed / v.n < 0.2 && heights <= 3){ rests.push(+code); }
      else if(v.n >= 2 && v.stemmed / v.n > 0.8 && heights >= 3 && v.afterHead / v.n < 0.5){
        flags.push(+code);
      }
      if(v.afterHead > dotScore && v.afterHead >= v.n * 0.6){ dotScore = v.afterHead; dot = +code; }
    });

    return {rests:rests, flags:flags, dot:dot, stems:stems};
  }

  function glyphHeads(page, font, list, codes){
    if(!codes.length){ return []; }

    var out = [];
    page.texts.forEach(function(t){
      if(t.font !== font.key || codes.indexOf(codeOf(t)) < 0){ return; }
      var st = staffFor(t.y, list);
      if(st === null){ return; }
      out.push({staff:st, x:t.x, y:t.y});
    });
    return out.sort(function(a, b){ return a.staff - b.staff || a.x - b.x; });
  }

  /* ---------- noteheads ----------
     A head is drawn as curves, roughly one staff space tall and a little wider
     than tall because it leans. Everything else on the page that is made of
     curves -- a clef, a rest, a slur, a dynamic -- is either much bigger or
     much smaller than that, so the size window does most of the work. The rest
     is done by asking which staff it belongs to: a mark further than a couple
     of ledger lines from any staff is not a note on one. */
  function heads(page, list){
    if(!list.length){ return []; }
    var step = list[0].step;
    var out = [];

    page.fills.forEach(function(f){
      if(!f.curves){ return; }
      if(f.h < step * 0.55 || f.h > step * 1.6){ return; }
      if(f.w < step * 0.6 || f.w > step * 2.4){ return; }

      var cy = f.y + f.h / 2;
      var cx = f.x + f.w / 2;
      var best = null, bestGap = Infinity;

      list.forEach(function(st, i){
        /* inside the staff costs nothing; above or below is measured, so the
           nearer staff wins a head that sits between two of them */
        var gap = cy > st.top ? cy - st.top : (cy < st.bottom ? st.bottom - cy : 0);
        if(gap < bestGap){ bestGap = gap; best = i; }
      });

      if(best === null || bestGap > step * 3.5){ return; }
      if(cx < list[best].x0 - step || cx > list[best].x1 + step){ return; }
      out.push({staff:best, x:cx, y:cy});
    });

    return out.sort(function(a, b){
      return a.staff - b.staff || a.x - b.x;
    });
  }

  /* ---------- where a head sits, as a pitch ----------
     Half a staff space is one step of the scale, counted from the bottom line,
     and which note that line is depends on the clef read above. */
  var LETTERS = ["c", "d", "e", "f", "g", "a", "b"];

  function pitchAt(head, staff, shift){
    var steps = Math.round((head.y - staff.bottom) / (staff.step / 2));
    var n = (staff.clef === "bass" ? BASS_BOTTOM : TREBLE_BOTTOM) + steps;
    var plain = LETTERS[((n % 7) + 7) % 7] + "/" + Math.floor(n / 7);
    if(!shift){ return plain; }
    /* the scores spell everything with sharps, so a flat comes back as the
       sharp of the note below -- the same pitch, the app's spelling */
    return global.Note.keyOfMidi(global.Note.midi(plain) + shift);
  }

  /* ---------- barlines ----------
     A barline runs the height of the staff, and on a piano system it runs
     through both staves at once, which is why looking for one exactly as tall
     as a single staff finds nothing. Fills as well as strokes: engravers draw
     them either way. */
  function barlinesOf(page, staff, heads){
    var tol = staff.step * 0.5;
    var high = staff.top - staff.bottom;
    var out = [];

    page.strokes.concat(page.fills).forEach(function(t){
      if(t.w > staff.step * 0.9){ return; }
      /* it has to reach both outer lines, not merely overlap the staff: a stem
         is about as long as a staff is high and would pass a looser test */
      if(t.y > staff.bottom + tol || t.y + t.h < staff.top - tol){ return; }
      if(t.h < high * 0.95){ return; }
      if(t.x < staff.x0 - staff.step || t.x > staff.x1 + staff.step){ return; }

      /* and a stem stands at a notehead, where a barline never does */
      var x = t.x + t.w / 2;
      if(heads.some(function(h){ return Math.abs(h.x - x) < staff.step * 1.5; })){ return; }

      out.push(x);
    });

    out.sort(function(a, b){ return a - b; });
    return out.filter(function(x, i){ return i === 0 || x - out[i - 1] > staff.step; });
  }

  /* the lengths a written note can have here, longest first */
  var LENGTHS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

  function snap(beats){
    return LENGTHS.reduce(function(best, l){
      return Math.abs(l - beats) < Math.abs(best - beats) ? l : best;
    }, 4);
  }

  /* ---------- what is on the page ----------
     Staves are read top to bottom, page after page, and joined into one line.
     Two things are dropped on the way and both are counted for the report: the
     bass staff of a piano system, which is not the melody and would interleave
     a second part into the line, and the lower notes of a chord, since a
     trainer plays one note at a time -- the same rule songimport.js applies to
     a chord in MusicXML. */
  function recognise(doc){
    var events = [];
    var staffCount = 0, usedStaves = 0, skipped = 0, chords = 0, fromGlyphs = false;
    var accidentalsRead = 0, timed = false, barCount = 0;

    doc.pages.forEach(function(page){
      var list = staves(page);
      if(!list.length){ return; }
      staffCount += list.length;

      var font = musicFont(page);
      var glyphs = font ? page.texts.filter(function(t){ return t.font === font.key; }) : [];
      list.forEach(function(st){ st.clef = font ? clefOf(st, glyphs) : "treble"; });

      var codes = font ? headCodes(page, font, list) : [];
      var found = font ? glyphHeads(page, font, list, codes) : [];
      if(found.length){ fromGlyphs = true; } else { found = heads(page, list); }

      /* Accidentals, if the font said which glyph is which. Two kinds, and the
         difference is where they sit: before the first note of a staff they are
         the key signature and hold for the whole staff, one letter at a time,
         every octave; beside a head they belong to that head.

         A real accidental also holds to the end of its bar, which needs
         barlines this does not read yet -- so a repeated note after one comes
         back plain. That is a smaller error than ignoring accidentals
         altogether, which is where this started. */
      var marks = font ? accidentals(page, font, list) : [];
      accidentalsRead += marks.length;
      var keys = {};

      list.forEach(function(st, i){
        var first = null;
        found.forEach(function(h){ if(h.staff === i && (first === null || h.x < first)){ first = h.x; } });
        keys[i] = {};
        marks.forEach(function(a){
          if(a.staff !== i || first === null || a.x >= first - st.step){ return; }
          keys[i][letterAt(a.y, st)] = SEMITONES[a.what];
        });
      });

      /* one part, so the treble staves are the piece; a page with no treble
         staff at all is read as it is rather than refused */
      var wanted = list.some(function(st){ return st.clef === "treble"; }) ? "treble" : null;
      usedStaves += wanted ? list.filter(function(st){ return st.clef === wanted; }).length
                           : list.length;

      var vocab = font ? vocabulary(page, font, list, found, codes)
                       : {rests:[], flags:[], dot:null, stems:[]};
      var beams = list.length ? beamsOf(page, list[0]) : [];

      /* a beam belongs to the staff it is drawn over; the bass staff of a piano
         system carries its own, at the same places along the page */
      function beamsNear(st){
        return beams.filter(function(b){
          return b.y > st.bottom - st.step * 6 && b.y < st.top + st.step * 6;
        });
      }

      list.forEach(function(st, si){
        var mine = found.filter(function(h){ return h.staff === si; });
        if(wanted && st.clef !== wanted){ skipped += mine.length; return; }

        var here = mine.map(function(h){
          var len = lengthOf(h, st, glyphs, vocab, beamsNear(st), font);
          return {staff:si, x:h.x, y:h.y, rest:false, beats:len.beats, guessed:len.guessed};
        });

        if(font){
          glyphs.forEach(function(t){
            if(vocab.rests.indexOf(codeOf(t)) < 0){ return; }
            if(staffFor(t.y, list) !== si){ return; }
            here.push({staff:si, x:t.x, y:t.y, rest:true, beats:null});
          });
        }

        here.sort(function(a, b){ return a.x - b.x; });

        /* heads stacked at one moment are a chord: keep the top note */
        var flat = [];
        here.forEach(function(e){
          var last = flat[flat.length - 1];
          if(last && Math.abs(e.x - last.x) < st.step * 0.6 && !e.rest && !last.rest){
            chords++;
            if(e.y > last.y){ last.y = e.y; last.beats = e.beats; last.guessed = e.guessed; }
            return;
          }
          flat.push(e);
        });

        flat.forEach(function(e){
          e.pitch = e.rest ? "R" : pitchAt(e, st, shiftFor(e, st, marks, keys[si]));
        });

        var edges = barlinesOf(page, st, mine);
        var bars = intoBars(flat, edges);
        if(bars.timed){ timed = true; }
        barCount += bars.list.length;
        bars.list.forEach(function(bar){ events.push(bar); });
      });
    });

    return {events:events, notes:pitchesOf(events), staves:staffCount, used:usedStaves,
            skipped:skipped, chords:chords, glyphs:fromGlyphs, accidentals:accidentalsRead,
            timed:timed, bars:barCount};
  }

  function pitchesOf(bars){
    var out = [];
    bars.forEach(function(bar){
      bar.forEach(function(e){ if(e[0] !== "R"){ out.push(e[0]); } });
    });
    return out;
  }

  /* ---------- how long a note is ----------
     A stem with nothing on it is a quarter. Every beam across it, or every flag
     hanging off it, halves that; a dot beside the head adds half again. A head
     with no stem at all is a whole note. What is not read is the difference
     between a filled head and a hollow one, so a half note arrives as a
     quarter unless its own glyph is a different code -- which is why the bar
     that does not add up is padded rather than trusted. */
  function lengthOf(head, staff, glyphs, vocab, beams, font){
    if(!font){ return 1; }

    /* the stem this head stands on: a flag hangs at its far end, which can be
       three or four spaces away, so the search follows the stem rather than
       guessing a distance from the head */
    var stem = null;
    vocab.stems.forEach(function(v){
      if(Math.abs(v.x - head.x) > staff.step * 2){ return; }
      if(head.y < v.y - staff.step || head.y > v.y + v.h + staff.step){ return; }
      if(!stem || v.h > stem.h){ stem = v; }
    });
    if(!stem){ return 4; }                       /* no stem at all: a whole note */

    var flags = 0, dotted = false;
    glyphs.forEach(function(t){
      var code = codeOf(t);
      if(vocab.flags.indexOf(code) >= 0 && Math.abs(t.x - stem.x) < staff.step * 1.5 &&
         t.y > stem.y - staff.step && t.y < stem.y + stem.h + staff.step){ flags++; }
      if(vocab.dot !== null && code === vocab.dot &&
         Math.abs(t.y - head.y) < staff.step * 0.35 &&
         t.x - head.x > 0 && t.x - head.x < staff.step * 2.2){ dotted = true; }
    });

    var halvings = Math.max(flags, beamsOver(beams, head.x, staff));
    var beats = 1 / Math.pow(2, Math.min(halvings, 4));
    if(dotted){ beats *= 1.5; }
    /* a plain stem with nothing on it is only a guess at a quarter -- it is
       also what a half note looks like from here, and what an eighth looks like
       when its beam was missed. The bar it sits in gets to correct it. */
    return {beats:beats, guessed:!halvings && !dotted};
  }

  /* ---------- into bars ----------
     The barlines say where a bar ends; the rule that a bar holds four beats
     says how long the rests in it are, since nothing on the page names a rest's
     length. Whatever a bar is short by is shared among its rests -- and if the
     bars do not come out near four beats, the reading of the lengths was wrong
     and the whole line falls back to a note a beat, which is at least honest. */
  function intoBars(flat, edges){
    var perBar = 4;
    if(!edges.length || flat.length < 2){ return {list:evenBars(flat, perBar), timed:false}; }

    var bars = [];
    var cuts = edges.slice();
    var bar = [];
    var next = 0;

    flat.forEach(function(e){
      while(next < cuts.length && e.x > cuts[next]){
        if(bar.length){ bars.push(bar); bar = []; }
        next++;
      }
      bar.push(e);
    });
    if(bar.length){ bars.push(bar); }

    var good = 0;
    bars.forEach(function(b){
      var notes = b.filter(function(e){ return !e.rest; });
      var rests = b.filter(function(e){ return e.rest; });
      var known = function(){
        return notes.reduce(function(n, e){ return n + e.beats; }, 0);
      };

      /* Every rest has to be worth something, so the notes have to leave room
         for it -- a sixteenth each is the least a rest can be. */
      var room = perBar - rests.length * 0.25;

      /* Too much music for the bar means a length was read too long. The plain
         stems are the guesses and go first, longest one at a time; if the bar
         still will not fit, the flagged and beamed ones are halved too, because
         a bar of four and a quarter beats is not a rhythm at all -- the game
         counts bars by dividing beats by the bar length, and one bar too long
         puts every bar after it out of step with the music. */
      for(var pass = 0; pass < 24 && known() > room + 1e-9; pass++){
        var worst = null;
        notes.forEach(function(e){
          if(e.guessed && e.beats > 0.25 && (!worst || e.beats > worst.beats)){ worst = e; }
        });
        if(!worst){
          notes.forEach(function(e){
            if(e.beats > 0.25 && (!worst || e.beats > worst.beats)){ worst = e; }
          });
        }
        if(!worst){ break; }
        worst.beats /= 2;
      }

      /* whatever is left belongs to the rests, in equal shares that a notation
         can spell; any dust from that goes on the last of them */
      if(rests.length){
        var left = Math.max(perBar - known(), rests.length * 0.25);
        var each = snap(left / rests.length);
        rests.forEach(function(e){ e.beats = each; });
        var over = known() + each * rests.length - perBar;
        var last = rests[rests.length - 1];
        if(over > 1e-9 && last.beats - over >= 0.25){ last.beats = snap(last.beats - over); }
      }

      var sum = known() + rests.reduce(function(n, e){ return n + e.beats; }, 0);
      if(Math.abs(sum - perBar) < 1e-6){ good++; }
    });

    /* more than half the bars adding up is the sign that the lengths were read
       rather than invented; anything less and this is not rhythm, it is noise */
    if(good < bars.length * 0.5){ return {list:evenBars(flat, perBar), timed:false}; }

    /* A bar that still does not add up is not shipped as it is: it goes back to
       a note a beat, which is wrong in one bar rather than wrong from that bar
       onwards. convert() finishes anything still short with a rest. */
    bars = bars.map(function(b){
      var sum = b.reduce(function(n, e){ return n + e.beats; }, 0);
      if(Math.abs(sum - perBar) < 1e-6 || b.length > perBar){ return b; }
      return b.map(function(e){ return {pitch:e.pitch, beats:1, rest:e.rest}; });
    });

    return {list:bars.map(function(b){
      return b.map(function(e){ return [e.pitch, spell(e.beats)]; });
    }), timed:true};
  }

  function evenBars(flat, perBar){
    var out = [], bar = [], filled = 0;
    flat.forEach(function(e){
      if(filled >= perBar - 1e-9){ out.push(bar); bar = []; filled = 0; }
      bar.push([e.pitch, "q"]);
      filled += 1;
    });
    if(bar.length){ out.push(bar); }
    return out;
  }

  /* beats -> the code durations.js knows, longest that fits */
  function spell(beats){
    var list = global.DURATIONS.list, best = list[list.length - 1];
    for(var i = 0; i < list.length; i++){
      if(Math.abs(list[i].beats - beats) < 1e-6){ return list[i].code; }
    }
    for(var j = 0; j < list.length; j++){
      if(Math.abs(list[j].beats - beats) < Math.abs(best.beats - beats)){ best = list[j]; }
    }
    return best.code;
  }

  /* An accidental beside this head beats the key signature, which is what the
     signature is for; nothing at all leaves the note as written. */
  function shiftFor(head, staff, marks, key){
    var best = null, bestGap = Infinity;
    marks.forEach(function(a){
      if(a.staff !== head.staff){ return; }
      if(Math.abs(a.y - head.y) > staff.step * 0.6){ return; }
      var gap = head.x - a.x;
      if(gap <= 0 || gap > staff.step * 3.5){ return; }
      if(gap < bestGap){ bestGap = gap; best = a; }
    });
    if(best){ return SEMITONES[best.what]; }

    var letter = letterAt(head.y, staff);
    return key && key[letter] !== undefined ? key[letter] : 0;
  }

  function analyze(doc){
    if(!doc.seen){ doc.seen = recognise(doc); }
    var seen = doc.seen;
    if(!seen.staves){ throw fail("import.err.pdfNoStaves", "no staff lines were found on the page"); }
    if(!seen.notes.length){ return []; }

    var line = {
      part: "pdf", partName: null, staff: "1", voice: "1",
      notes: 0, rests: 0, sum: 0, lo: null, hi: null, playable: 0, chords: 0,
      used: {},
      /* what the page could not tell us, carried so the dialog can say it
         before the reader presses Add rather than after */
      printed: {staves:seen.used, skipped:seen.skipped, lengths:seen.timed,
                accidentals:seen.accidentals}
    };

    seen.notes.forEach(function(pitch){
      var m = global.Note.midi(pitch);
      line.notes++;
      line.sum += m;
      if(line.lo === null || m < line.lo){ line.lo = m; }
      if(line.hi === null || m > line.hi){ line.hi = m; }
      line.used[pitch] = (line.used[pitch] || 0) + 1;
      if(playableOn(pitch)){ line.playable++; }
    });

    /* the picker already knows how to say this one: it is the same fact
       songimport.js reports when a MusicXML part has chords in it */
    line.chords = seen.chords;
    line.share = line.playable / line.notes;
    line.average = line.sum / line.notes;
    line.rank = 1;
    return [line];
  }

  /* ---------- into a piece ----------
     The bars come out of the recogniser already, so this only has to shift the
     octave, pad a bar that does not add up, and say what it had to assume. */
  function convert(doc, line, options){
    options = options || {};
    var shift = options.octave || 0;

    if(!doc.seen){ doc.seen = recognise(doc); }
    var read = doc.seen.events;
    if(!read.length){ throw fail("import.err.noNotes", "there are no notes on this page"); }

    var time = options.time || "4/4";
    var perBar = global.DURATIONS.perBar(time);
    var beats = global.DURATIONS.beats;
    var measures = [], used = {}, padded = 0;

    read.forEach(function(bar, i){
      var notes = [], sum = 0;
      bar.forEach(function(e){
        var pitch = shiftPitch(e[0], shift);
        notes.push([pitch, e[1]]);
        sum += beats[e[1]] || 0;
        if(pitch !== "R"){ used[pitch] = true; }
      });

      /* a bar the page did not fill -- a length this cannot read yet, or a
         voice that is not the melody -- is finished with a rest rather than
         left short, since every bar the game plays has to be a whole one */
      while(sum < perBar - 1e-9){
        var want = Math.min(perBar - sum, 4);
        var code = spell(want);
        notes.push(["R", code]);
        sum += beats[code];
        padded++;
      }

      measures.push({n:i + 1, notes:notes, beams:[], ties:[], slurs:[],
                     bar:null, repeat:null, sys:0});
    });

    if(!measures.length){ throw fail("import.err.noNotes", "there are no notes on this page"); }
    measures[measures.length - 1].bar = "double";

    var problems = [];
    problems.push(doc.seen.timed
      ? "lengths were read from the stems and beams; a half note is not told from " +
        "a quarter, so a bar that came up short was finished with a rest"
      : "lengths are not read from the page: every note came in as a quarter");
    problems.push(doc.seen.accidentals
      ? doc.seen.accidentals + " sharp(s), flat(s) and natural(s) were read; one does not " +
        "carry to the rest of its bar, since barlines mark the bars but not the reach " +
        "of an accidental here"
      : "sharps and flats beside a head were not read");
    if(doc.seen.used > 1){
      problems.push(doc.seen.used + " staves were read as one line, top to bottom");
    }
    if(doc.seen.skipped){
      problems.push(doc.seen.skipped + " note(s) on staves in another clef were left out");
    }
    if(doc.seen.chords){
      problems.push(doc.seen.chords + " head(s) stacked into chords: only the top note was kept");
    }
    if(padded){
      problems.push(padded + " bar(s) were finished with a rest to make up the beats");
    }

    var list = Object.keys(used).sort(function(a, b){
      return global.Note.midi(a) - global.Note.midi(b);
    });
    var missing = list.filter(function(p){ return !playableOn(p); });

    return {
      score: {key:options.key || "C", time:time, measures:measures, systems:[], crossSlurs:[]},
      report: {bars:measures.length, pitches:list, missing:missing, problems:problems,
               bpm:0, staves:doc.seen.staves, skipped:doc.seen.skipped,
               chords:doc.seen.chords, glyphs:doc.seen.glyphs, timed:doc.seen.timed}
    };
  }

  function shiftPitch(pitch, shift){
    if(!shift || pitch === "R"){ return pitch; }
    return global.Note.keyOfMidi(global.Note.midi(pitch) + shift * 12);
  }

  global.PdfScore = {
    read: read,
    analyze: analyze,
    convert: convert,
    /* the checks drive these directly: node has bytes and zlib, not a File */
    bytes: readBytes,
    _staves: staves,
    _heads: heads
  };
})(window);
