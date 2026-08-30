/* Checks that pdfread.js recovers what was drawn, against pages whose contents
 * are known exactly.
 *
 * The samples are written by tools/make_test_pdf.py, which places every staff
 * line and notehead at a coordinate it prints, so this can assert positions
 * rather than eyeball them: the five lines of each system, 8 pt apart, and 24
 * noteheads walking up half a step at a time. A reader that loses the transform
 * stack, or reports a curve's control points as its outline, fails here.
 *
The files exist to separate failures. sample-plain.pdf has no compression, so
 * a break in the object parser shows up without the inflate path being
 * involved; sample-engraved.pdf is the same page Flate-compressed;
 * sample-ascii85.pdf is that page again through the two-filter chain
 * Ghostscript emits, with the predictor in the second /DecodeParms slot, so a
 * reader that takes parameters positionally passes and one that grabs the first
 * entry fails. sample-scan.pdf is one image and has to be read as a scan;
 * sample-stamped.pdf is a scan with a watermark over it, which must not be
 * promoted to an engraving by counting marks first; sample-locked.pdf is
 * encrypted, and has to be refused as protected rather than fall over later on
 * bytes that are not deflate.
 *
 * What this does NOT check: anything about a real engraver's output. These
 * pages are the shape of an engraving, not one -- no music font, no subset
 * encoding, no forms, no object streams. Those paths are written and they parse
 * synthetic input, but only a file out of MuseScore or LilyPond proves them.
 * That is the gap a real sample closes, and until one arrives this check should
 * not be read as saying PDF import works.
 *
 *     node tools/check_pdfread.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var zlib = require("zlib");
var child = require("child_process");

var ROOT = path.join(__dirname, "..");
var SAMPLES = path.join(__dirname, "samples");

/* pdfread.js is a browser script sharing one global, like everything else the
   checks load -- see check_songs.js for the same sandbox. */
var sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "pdfread.js"), "utf8"), sandbox, {filename:"pdfread.js"});
var PdfRead = sandbox.PdfRead;

/* The browser hands PdfRead a DecompressionStream; node has zlib. Both are
   promised, so the reader never has to know which it got. */
function inflate(bytes){
  return new Promise(function(resolve, reject){
    zlib.inflate(Buffer.from(bytes), function(err, out){
      if(err){ reject(err); } else { resolve(new Uint8Array(out)); }
    });
  });
}

var problems = [];
function check(what, ok, detail){
  if(!ok){ problems.push(what + (detail ? ": " + detail : "")); }
}

function near(a, b, tol){ return Math.abs(a - b) <= tol; }

/* The samples are generated, not committed -- one command, no dependencies. */
function samples(){
  if(!fs.existsSync(path.join(SAMPLES, "sample-stamped.pdf"))){
    child.execFileSync("python3", [path.join(__dirname, "make_test_pdf.py")], {stdio:"ignore"});
  }
  return ["sample-plain.pdf", "sample-engraved.pdf", "sample-ascii85.pdf",
          "sample-scan.pdf", "sample-stamped.pdf"];
}

/* What make_test_pdf.py drew. Kept here as literals on purpose: reading them
   back out of the generator would let the two drift together, which is the
   failure check_audio.js documents in its own header. */
var STAFF_TOPS = [250, 170, 90];
var STEP = 8;
var NOTE_X = [70, 110, 150, 190, 230, 270, 310, 350];
var NOTEHEADS = 24;

function checkEngraved(name, pg){
  var where = name + ": ";
  var cls = PdfRead.classify(pg);
  check(where + "classified", cls.kind === "engraved", "read as " + cls.kind + " (" + cls.why + ")");
  check(where + "page size", near(pg.width, 420, 0.5) && near(pg.height, 300, 0.5),
        pg.width + "x" + pg.height);

  /* staff lines: long, thin, axis-aligned rectangles */
  var lines = pg.fills.filter(function(f){
    return f.rect && !f.curves && f.w > 300 && f.h < 2;
  }).map(function(f){ return f.y; }).sort(function(a, b){ return b - a; });

  check(where + "staff lines", lines.length === 15, "found " + lines.length + ", expected 15");

  STAFF_TOPS.forEach(function(top, s){
    for(var i = 0; i < 5; i++){
      var want = top - i * STEP;
      var got = lines[s * 5 + i];
      check(where + "system " + (s + 1) + " line " + (i + 1),
            got !== undefined && near(got, want, 0.6), "y=" + got + ", expected " + want);
    }
  });

  /* noteheads: the filled paths built from curves */
  var heads = pg.fills.filter(function(f){ return f.curves; });
  check(where + "noteheads", heads.length === NOTEHEADS, "found " + heads.length + ", expected " + NOTEHEADS);

  /* a notehead's centre, not its bounding box, is what a pitch is read from */
  var centres = heads.map(function(f){ return {x:f.x + f.w / 2, y:f.y + f.h / 2}; })
                     .sort(function(a, b){ return b.y - a.y || a.x - b.x; });

  var expected = [];
  STAFF_TOPS.forEach(function(top){
    NOTE_X.forEach(function(x, i){ expected.push({x:x, y:top - 4 * STEP + i * (STEP / 2)}); });
  });
  expected.sort(function(a, b){ return b.y - a.y || a.x - b.x; });

  var worst = 0;
  for(var i = 0; i < Math.min(centres.length, expected.length); i++){
    worst = Math.max(worst, Math.abs(centres[i].x - expected[i].x), Math.abs(centres[i].y - expected[i].y));
  }
  /* the ellipse is drawn tilted, so its bounding box is a little wider than the
     head and its centre lands within a point of where the head was placed */
  check(where + "notehead centres", worst <= 1.2, "worst error " + worst.toFixed(2) + " pt");

  /* stems, barlines: thin vertical rectangles */
  var verticals = pg.fills.filter(function(f){ return f.rect && f.h > 20 && f.w < 2; });
  check(where + "stems and barlines", verticals.length === NOTEHEADS + 6,
        "found " + verticals.length + ", expected " + (NOTEHEADS + 6));

  /* text: two runs, one of them split by TJ kerning into two shows */
  var glyphs = pg.texts.reduce(function(n, t){ return n + t.length; }, 0);
  check(where + "glyphs", glyphs === 12, "found " + glyphs + ", expected 12");
  check(where + "text placed", pg.texts.length && near(pg.texts[0].x, 40, 0.5) && near(pg.texts[0].y, 280, 0.5),
        pg.texts.length ? pg.texts[0].x + "," + pg.texts[0].y : "no text");
  check(where + "text size", pg.texts.length && near(pg.texts[0].size, 13, 0.01),
        pg.texts.length ? String(pg.texts[0].size) : "no text");

  /* the font here is a plain one, and has to read as plain -- the interesting
     case is the opposite, and only a real file has it */
  var f = pg.fonts[0];
  check(where + "font read", !!f && f.family === "Helvetica", f ? f.family : "no font");
  check(where + "font not subset", !!f && !f.subset && !f.embedded, f ? JSON.stringify(f) : "no font");
}

function checkScan(name, pg){
  var where = name + ": ";
  var cls = PdfRead.classify(pg);
  check(where + "classified", cls.kind === "scan", "read as " + cls.kind + " (" + cls.why + ")");
  check(where + "one image", pg.images.length === 1, "found " + pg.images.length);
  var im = pg.images[0];
  check(where + "image covers the page", im && near(im.w, 420, 0.5) && near(im.h, 300, 0.5),
        im ? im.w + "x" + im.h : "none");
  check(where + "image resolution", im && im.pixels.w === 210 && im.pixels.h === 150,
        im ? im.pixels.w + "x" + im.pixels.h : "none");
  check(where + "nothing to read", pg.fills.length === 0 && pg.texts.length === 0,
        pg.fills.length + " fills, " + pg.texts.length + " texts");
}

/* A reader that accepts anything is no use either: rubbish has to be refused
   rather than parsed into an empty page. */
/* The watermark is 64 little squares; the page underneath is still a scan. */
function checkStamped(name, pg){
  var where = name + ": ";
  var cls = PdfRead.classify(pg);
  check(where + "still a scan", cls.kind === "scan", "read as " + cls.kind + " (" + cls.why + ")");
  check(where + "watermark read", pg.fills.length === 64, "found " + pg.fills.length + " marks, expected 64");
  check(where + "image found", pg.images.length === 1, "found " + pg.images.length);
  /* both content parts decoded, through two different filters, and joined */
  check(where + "both parts decoded", pg.images.length === 1 && pg.fills.length === 64,
        pg.images.length + " images, " + pg.fills.length + " marks");
}

/* A protected file has to be named as protected. Without that the structure
   parses, the page is found, and the first inflate fails on bytes that were
   never deflate -- a complaint about a stream, three steps from the cause. */
function checkLocked(){
  var bytes = new Uint8Array(fs.readFileSync(path.join(SAMPLES, "sample-locked.pdf")));
  return PdfRead.open(bytes, inflate).then(function(){
    problems.push("sample-locked.pdf: opened a protected file");
  }, function(err){
    check("sample-locked.pdf: named as protected", /protected/.test(err.message), "said \"" + err.message + "\"");
  });
}

function checkRubbish(){
  /* Refused is not enough: the reason reaches a player, and picking the wrong
     file is the commonest way to arrive here. A file with no PDF header at all
     used to be turned away several steps later as "nothing drawn on the page",
     which is a true sentence about a JPEG and no use to anyone. So the two
     cases that are plainly not PDFs name the answer they must give; a
     truncated one may fail anywhere, and only has to fail. */
  var junk = Buffer.alloc(400);
  for(var i = 0; i < junk.length; i++){ junk[i] = (i * 37) % 251; }

  var cases = [
    {name:"a text file",   bytes:Buffer.from("this is a text file, not a document at all\n"),
     want:"import.err.pdfNot"},
    {name:"random bytes",  bytes:junk, want:"import.err.pdfNot"},
    {name:"a header 1.5kB in", bytes:Buffer.concat([Buffer.alloc(1500), Buffer.from("%PDF-1.4\n")]),
     want:"import.err.pdfNot"},
    {name:"a truncated pdf", bytes:fs.readFileSync(path.join(SAMPLES, "sample-plain.pdf")).subarray(0, 40),
     want:null}
  ];

  var chain = Promise.resolve();
  cases.forEach(function(c){
    chain = chain.then(function(){
      return PdfRead.open(new Uint8Array(c.bytes), inflate).then(function(){
        problems.push("rubbish accepted: " + c.name);
      }, function(err){
        if(c.want && err.i18n !== c.want){
          problems.push(c.name + ": refused as " + (err.i18n || "an untranslated error") +
                        ", expected " + c.want + " (" + err.message + ")");
        }
      });
    });
  });
  return chain;
}

var chain = Promise.resolve();
samples().forEach(function(name){
  chain = chain.then(function(){
    var bytes = new Uint8Array(fs.readFileSync(path.join(SAMPLES, name)));
    return PdfRead.open(bytes, inflate).then(function(doc){
      check(name + ": pages", doc.pages.length === 1, "found " + doc.pages.length);
      return PdfRead.page(doc, 0).then(function(pg){
        if(name === "sample-scan.pdf"){ checkScan(name, pg); }
        else if(name === "sample-stamped.pdf"){ checkStamped(name, pg); }
        else { checkEngraved(name, pg); }
      });
    }, function(err){
      problems.push(name + ": " + err.message);
    });
  });
});

chain.then(checkLocked).then(checkRubbish).then(function(){
  if(problems.length){
    console.log("pdfread: " + problems.length + " problem(s)");
    problems.forEach(function(p){ console.log("  " + p); });
    process.exit(1);
  }
  console.log("pdfread: ok -- 6 samples: marks where they were drawn, scans and "
            + "watermarked scans read as scans, a protected file named as protected,\n"
            + "         and a file that is not a PDF said to be one rather than an empty page");
}, function(err){
  console.error(err && err.stack || err);
  process.exit(1);
});
