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
 *   length     NOT read -- every note comes in as a quarter
 *   key        NOT read -- accidentals beside a head are not looked for either
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

  function staffFor(y, list){
    var best = null, bestGap = Infinity;
    list.forEach(function(st, i){
      var gap = y > st.top ? y - st.top : (y < st.bottom ? st.bottom - y : 0);
      if(gap < bestGap){ bestGap = gap; best = i; }
    });
    if(best === null || bestGap > list[best].step * 3.5){ return null; }
    return best;
  }

  function glyphHeads(page, font, list){
    var codes = headCodes(page, font, list);
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

  function pitchAt(head, staff){
    var steps = Math.round((head.y - staff.bottom) / (staff.step / 2));
    var n = (staff.clef === "bass" ? BASS_BOTTOM : TREBLE_BOTTOM) + steps;
    return LETTERS[((n % 7) + 7) % 7] + "/" + Math.floor(n / 7);
  }

  /* ---------- what is on the page ----------
     Staves are read top to bottom, page after page, and joined into one line.
     Two things are dropped on the way and both are counted for the report: the
     bass staff of a piano system, which is not the melody and would interleave
     a second part into the line, and the lower notes of a chord, since a
     trainer plays one note at a time -- the same rule songimport.js applies to
     a chord in MusicXML. */
  function recognise(doc){
    var notes = [];
    var staffCount = 0, usedStaves = 0, skipped = 0, chords = 0, fromGlyphs = false;

    doc.pages.forEach(function(page){
      var list = staves(page);
      if(!list.length){ return; }
      staffCount += list.length;

      var font = musicFont(page);
      var glyphs = font ? page.texts.filter(function(t){ return t.font === font.key; }) : [];
      list.forEach(function(st){ st.clef = font ? clefOf(st, glyphs) : "treble"; });

      var found = font ? glyphHeads(page, font, list) : [];
      if(found.length){ fromGlyphs = true; } else { found = heads(page, list); }

      /* one part, so the treble staves are the piece; a page with no treble
         staff at all is read as it is rather than refused */
      var wanted = list.some(function(st){ return st.clef === "treble"; }) ? "treble" : null;
      usedStaves += wanted ? list.filter(function(st){ return st.clef === wanted; }).length
                           : list.length;

      var lastX = null, lastStaff = null;
      found.forEach(function(h){
        var st = list[h.staff];
        if(wanted && st.clef !== wanted){ skipped++; return; }

        /* heads stacked at one moment are a chord: keep the top note. They
           arrive sorted by x, so "the same moment" is a gap of nearly nothing,
           and the highest is whichever is further up the page. */
        if(lastStaff === h.staff && lastX !== null && Math.abs(h.x - lastX) < st.step * 0.6){
          chords++;
          var prev = notes[notes.length - 1];
          var here = pitchAt(h, st);
          if(global.Note.midi(here) > global.Note.midi(prev)){ notes[notes.length - 1] = here; }
          return;
        }
        notes.push(pitchAt(h, st));
        lastX = h.x;
        lastStaff = h.staff;
      });

    });

    return {notes:notes, staves:staffCount, used:usedStaves, skipped:skipped,
            chords:chords, glyphs:fromGlyphs};
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
      printed: {staves:seen.used, skipped:seen.skipped, lengths:false}
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
     Every note is a quarter, so the bars are however many quarters the
     signature holds and the last one is padded with a rest. When lengths are
     read this is the function that changes; nothing above it has to. */
  function convert(doc, line, options){
    options = options || {};
    var shift = options.octave || 0;

    if(!doc.seen){ doc.seen = recognise(doc); }
    var pitches = doc.seen.notes;
    if(!pitches.length){ throw fail("import.err.noNotes", "there are no notes on this page"); }

    var time = options.time || "4/4";
    var perBar = global.DURATIONS.perBar(time);
    var measures = [];
    var used = {};
    var filled = 0;

    function push(pitch, beats){
      if(!measures.length || filled >= perBar - 1e-9){
        measures.push({n:measures.length + 1, notes:[], beams:[], ties:[], slurs:[],
                       bar:null, repeat:null, sys:0});
        filled = 0;
      }
      measures[measures.length - 1].notes.push([pitch, "q"]);
      filled += beats;
      if(pitch !== "R"){ used[pitch] = true; }
    }

    pitches.forEach(function(pitch){
      var shifted = shiftPitch(pitch, shift);
      push(shifted, 1);
    });

    while(filled > 1e-9 && filled < perBar - 1e-9){
      measures[measures.length - 1].notes.push(["R", "q"]);
      filled += 1;
    }

    measures[measures.length - 1].bar = "double";

    var problems = ["lengths are not read from the page: every note came in as a quarter",
                    "sharps and flats beside a head were not read"];
    if(doc.seen.used > 1){
      problems.push(doc.seen.used + " staves were read as one line, top to bottom");
    }
    if(doc.seen.skipped){
      problems.push(doc.seen.skipped + " note(s) on staves in another clef were left out");
    }
    if(doc.seen.chords){
      problems.push(doc.seen.chords + " head(s) stacked into chords: only the top note was kept");
    }

    var list = Object.keys(used).sort(function(a, b){
      return global.Note.midi(a) - global.Note.midi(b);
    });
    var missing = list.filter(function(p){ return !playableOn(p); });

    return {
      score: {key:options.key || "C", time:time, measures:measures, systems:[], crossSlurs:[]},
      report: {bars:measures.length, pitches:list, missing:missing, problems:problems,
               bpm:0, staves:doc.seen.staves, skipped:doc.seen.skipped,
               chords:doc.seen.chords, glyphs:doc.seen.glyphs}
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
