/* Checks that an engraved PDF turns into the notes that are drawn in it.
 *
 * check_pdfread.js proves the file is read: which marks are on the page, and
 * whether the page is an engraving or a scan. It says nothing about music. This
 * runs the layer above -- pdfscore.js -- the whole way to a piece, and compares
 * what came out against what the sample was drawn to contain.
 *
 * The samples are the ones make_test_pdf.py writes, and their shape is the
 * point: three staves, eight noteheads each, walking up from the bottom line by
 * half a staff space at a time. On a treble staff that is E4 F4 G4 A4 B4 C5 D5
 * E5, three times over -- a scale, so a misread is obvious rather than subtle.
 * A recogniser that loses a head, finds one twice, or is off by a step reports
 * a different scale here, not a slightly worse number.
 *
 * What this cannot show: that a real engraving reads. MuseScore and LilyPond
 * draw a page in ways nothing here has met -- heads as font glyphs rather than
 * curves, staff lines as strokes rather than rectangles, several parts down the
 * page. Until a real file is tried, this says the recogniser works on the shape
 * it was told about, which is not the same claim.
 *
 *     node tools/check_pdfscore.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var zlib = require("zlib");
var child = require("child_process");

var ROOT = path.join(__dirname, "..");
var SAMPLES = path.join(__dirname, "samples");

/* the browser scripts share one global, as in every other check here */
var sandbox = {document:{documentElement:{}}};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js", "notenames.js", "durations.js", "instruments.js",
 "instruments/flute.js", "instruments/piano.js", "pdfread.js", "pdfscore.js"
].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});
var PdfScore = sandbox.PdfScore;

function inflate(bytes){
  return new Promise(function(resolve, reject){
    zlib.inflate(Buffer.from(bytes), function(err, out){
      if(err){ reject(err); } else { resolve(new Uint8Array(out)); }
    });
  });
}

/* generated, not committed -- one command, no dependencies */
function samples(){
  if(!fs.existsSync(path.join(SAMPLES, "sample-engraved.pdf"))){
    child.execFileSync("python3", [path.join(__dirname, "make_test_pdf.py")], {stdio:"ignore"});
  }
  return fs.readdirSync(SAMPLES).filter(function(n){ return /\.pdf$/.test(n); });
}

var SCALE = ["e/4", "f/4", "g/4", "a/4", "b/4", "c/5", "d/5", "e/5"];
var EXPECTED = SCALE.concat(SCALE).concat(SCALE);      /* three staves of it */

var problems = [];
function ok(what, cond, saw){
  console.log("  " + (cond ? "ok  " : "BAD ") + what + (saw === undefined ? "" : "   " + saw));
  if(!cond){ problems.push(what + (saw === undefined ? "" : ": " + saw)); }
}

function bytesOf(name){ return new Uint8Array(fs.readFileSync(path.join(SAMPLES, name))); }

/* every sample that holds the engraved page, however it is compressed: the
   recogniser must not care which filter the file used */
var ENGRAVED = ["sample-engraved.pdf", "sample-plain.pdf", "sample-ascii85.pdf"];

function readsAsScale(name){
  return PdfScore.bytes(bytesOf(name), inflate).then(function(doc){
    var lines = PdfScore.analyze(doc);
    var line = lines[0];
    var got = doc.seen.notes;

    console.log(name);
    ok("three staves found", doc.seen.staves === 3, doc.seen.staves + " staves");
    ok("every notehead found", got.length === EXPECTED.length, got.length + " heads");
    ok("the scale that was drawn", got.join(" ") === EXPECTED.join(" "),
       got.slice(0, 8).join(" ") + (got.length > 8 ? " ..." : ""));
    ok("the line knows its range", line && line.lo === 64 && line.hi === 76,
       line ? line.lo + ".." + line.hi : "no line");
    ok("all of it plays on the flute", line && line.share === 1,
       line ? Math.round(line.share * 100) + "%" : "no line");

    var made = PdfScore.convert(doc, line, {octave:0});
    var beats = made.score.measures.reduce(function(n, m){
      return n + m.notes.reduce(function(k, note){
        return k + sandbox.DURATIONS.beats[note[1]];
      }, 0);
    }, 0);
    var bars = made.score.measures.length;
    ok("six full bars of four", bars === 6 && beats === 24, bars + " bars, " + beats + " beats");
    ok("it says the lengths were not read",
       made.report.problems.some(function(p){ return /lengths are not read/.test(p); }));
    ok("it says three staves became one line",
       made.report.problems.some(function(p){ return /3 staves were read as one line/.test(p); }));
    ok("nothing is out of the flute's reach", made.report.missing.length === 0,
       made.report.missing.join(" "));

    /* the octave selector has to move the whole piece, not just the report */
    var down = PdfScore.convert(doc, line, {octave:-1});
    ok("the octave shift moves the notes", down.score.measures[0].notes[0][0] === "e/3",
       down.score.measures[0].notes[0][0]);
  });
}

function refuses(name, why){
  return PdfScore.bytes(bytesOf(name), inflate).then(function(){
    ok(name + " is refused (" + why + ")", false, "it was accepted");
  }, function(err){
    ok(name + " is refused (" + why + ")", true, String(err.i18n || err.message));
  });
}

var here = samples();
var run = Promise.resolve();
ENGRAVED.forEach(function(name){
  if(here.indexOf(name) < 0){ problems.push("missing sample " + name); return; }
  run = run.then(function(){ return readsAsScale(name); });
});

console.log("");
run.then(function(){
  return refuses("sample-scan.pdf", "a photograph has no coordinates in it");
}).then(function(){
  return refuses("sample-locked.pdf", "the file is protected");
}).then(function(){
  console.log("");
  if(problems.length){
    problems.forEach(function(p){ console.log("  ! " + p); });
    console.log("\n" + problems.length + " problem(s)");
    process.exit(1);
  }
  console.log("pdfscore: ok -- the drawn scale reads back as a scale, three staves,\n" +
              "          in every compression the samples use; a scan and a protected\n" +
              "          file are refused rather than guessed at");
}).catch(function(err){
  console.error(String(err && err.stack || err));
  process.exit(1);
});
