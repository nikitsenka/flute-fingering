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
 *   length     NOT read -- every note comes in as a quarter
 *   clef       NOT read -- treble is assumed
 *   key        NOT read -- accidentals at the head are not looked for either
 *
 * That is a fingering trainer's half of the problem: the pitches and their
 * order are what a player practises against, and an even beat is a usable
 * default for that. Rhythm is where this has to grow next, and the shape of
 * the growth is known -- a filled head against a hollow one, a stem, a beam,
 * a flag -- which is why heads are found by geometry rather than by pattern
 * matching on one engraver's output.
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
    return page.fills.filter(function(f){
      return f.rect && f.h <= 2.5 && f.w >= page.width * 0.25;
    }).sort(function(a, b){ return b.y - a.y; });      /* top of the page first */
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
     Half a staff space is one step of the scale, counted from the bottom line.
     With a treble clef that line is E4; nothing here reads the clef, so that
     is an assumption and it is reported as one. */
  var LETTERS = ["c", "d", "e", "f", "g", "a", "b"];
  var BOTTOM_LINE = 4 * 7 + 2;                 /* e/4, counted in scale steps */

  function pitchAt(head, staff){
    var steps = Math.round((head.y - staff.bottom) / (staff.step / 2));
    var n = BOTTOM_LINE + steps;
    return LETTERS[((n % 7) + 7) % 7] + "/" + Math.floor(n / 7);
  }

  /* ---------- what is on the page ----------
     One PDF is one line: the staves are read top to bottom, page after page,
     as a single part. A piano score would be read as one long line that way,
     which is wrong -- so the count of staves goes into the report, where the
     reader can see that eight staves became one line before they play it. */
  function recognise(doc){
    var notes = [];
    var staffCount = 0;

    doc.pages.forEach(function(page){
      var list = staves(page);
      staffCount += list.length;
      heads(page, list).forEach(function(h){
        notes.push(pitchAt(h, list[h.staff]));
      });
    });

    return {notes:notes, staves:staffCount};
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
      /* what the page cannot tell us, carried so the dialog can say it before
         the reader presses Add rather than after */
      printed: {staves:seen.staves, clef:"treble", lengths:false}
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
                    "the clef was taken to be treble, and accidentals were not read"];
    if(doc.seen.staves > 1){
      problems.push(doc.seen.staves + " staves were read as one line, top to bottom");
    }

    var list = Object.keys(used).sort(function(a, b){
      return global.Note.midi(a) - global.Note.midi(b);
    });
    var missing = list.filter(function(p){ return !playableOn(p); });

    return {
      score: {key:options.key || "C", time:time, measures:measures, systems:[], crossSlurs:[]},
      report: {bars:measures.length, pitches:list, missing:missing, problems:problems,
               bpm:0, staves:doc.seen.staves}
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
