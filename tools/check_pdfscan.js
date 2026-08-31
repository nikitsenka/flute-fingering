/* Checks that pdfscan.js reads notes off a picture of a page.
 *
 * The page is drawn here rather than scanned: a bitmap with five staff lines
 * three times over and eight noteheads walking up each staff, half a space at a
 * time -- the same scale the engraved samples draw, so a misread reports a
 * different scale rather than a slightly worse number. Filled heads and hollow
 * ones both, since they are found by opposite means: a filled head survives
 * erosion, a hollow one is a ring and has to be found as the white it encloses.
 *
 * Drawn with the awkward parts left in on purpose. Every head sits on a staff
 * line or in a space, so the line-erasing has to spare it; every head has a
 * stem, because a hollow head with no stem is not counted; and a line of
 * lyrics runs under each staff, which is what the real page has and what makes
 * hole-filling alone useless -- the holes in "a" and "o" outnumber the notes.
 *
 * What this cannot show is that a real scan reads; that was measured against a
 * real one, whose four vocal staves came back with their notes on them and the
 * piano staves left alone.
 *
 *     node tools/check_pdfscan.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");

var sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "pdfscan.js"), "utf8"), sandbox, {filename:"pdfscan.js"});
var PdfScan = sandbox.PdfScan;

var problems = [];
function ok(what, cond, saw){
  console.log("  " + (cond ? "ok  " : "BAD ") + what + (saw === undefined ? "" : "   " + saw));
  if(!cond){ problems.push(what + (saw === undefined ? "" : ": " + saw)); }
}

/* ---------- a page, drawn ---------- */
var W = 1200, H = 1500;
var STEP = 18;                       /* pixels between staff lines, as at 300dpi */
var TOPS = [200, 700, 1200];         /* top line of each staff */
var NOTE_X = [150, 270, 390, 510, 630, 750, 870, 990];

var page = new Uint8Array(W * H);    /* 1 = ink */

function dot(x, y){
  x = Math.round(x); y = Math.round(y);
  if(x >= 0 && y >= 0 && x < W && y < H){ page[y * W + x] = 1; }
}

function bar(x0, y0, x1, y1){
  for(var y = y0; y <= y1; y++){ for(var x = x0; x <= x1; x++){ dot(x, y); } }
}

/* a notehead: an ellipse a space tall and a little wider, filled or a ring */
function head(cx, cy, filled){
  var rx = STEP * 0.62, ry = STEP * 0.46;
  for(var y = -ry - 1; y <= ry + 1; y++){
    for(var x = -rx - 1; x <= rx + 1; x++){
      var d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if(d <= 1){
        if(filled || d > 0.35){ dot(cx + x, cy + y); }
      }
    }
  }
}

function stem(cx, cy){ bar(Math.round(cx + STEP * 0.55), Math.round(cy - STEP * 3), Math.round(cx + STEP * 0.55) + 2, Math.round(cy)); }

/* Letters under the staff: rings and blobs of about the size of a notehead,
   which is what a lyric looks like to a recogniser -- the hole in an "o" is a
   hollow head to anything that only fills holes. Drawn where words go, four
   spaces below the staff, and with no stems, which is what tells them apart. */
function word(x, y){
  for(var i = 0; i < 6; i++){
    var cx = x + i * 24;
    var rx = STEP * 0.4, ry = STEP * 0.4;
    for(var dy = -ry; dy <= ry; dy++){
      for(var dx = -rx; dx <= rx; dx++){
        var d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if(d <= 1 && (i % 2 === 0 || d > 0.4)){ dot(cx + dx, y + dy); }
      }
    }
  }
}

TOPS.forEach(function(top, s){
  for(var i = 0; i < 5; i++){ bar(60, top + i * STEP, W - 60, top + i * STEP + 1); }
  NOTE_X.forEach(function(x, n){
    var y = top + 4 * STEP - n * (STEP / 2);
    head(x, y, n % 3 !== 1);        /* every third note hollow */
    stem(x, y);
  });
  word(120, top + 8 * STEP);       /* the lyric line, where words go */
});

var SCALE = ["e/4", "f/4", "g/4", "a/4", "b/4", "c/5", "d/5", "e/5"];

var got = PdfScan.read({width:W, height:H, rows:H, samples:page, mask:false});

console.log("a drawn page: three staves, eight notes each, lyrics underneath");
ok("three staves found", got.staves.length === 3, got.staves.length + " staves");
ok("each staff its own system", got.systems.length === 3, got.systems.length + " systems");
ok("the spacing was measured", got.staves.length > 0 && Math.abs(got.staves[0].step - STEP) < 1.5,
   got.staves.length ? got.staves[0].step.toFixed(1) + " px" : "no staff");

var perStaff = got.wanted.map(function(st){
  return got.notes.filter(function(n){ return n.staff === st; });
});

ok("eight notes on every staff", perStaff.every(function(n){ return n.length === 8; }),
   perStaff.map(function(n){ return n.length; }).join(", "));

var first = perStaff[0] || [];
ok("the scale that was drawn",
   first.map(function(n){ return PdfScan.pitchOf(n); }).join(" ") === SCALE.join(" "),
   first.map(function(n){ return PdfScan.pitchOf(n); }).join(" "));

ok("the hollow ones were found too", first.filter(function(n){ return !n.filled; }).length > 0,
   first.filter(function(n){ return !n.filled; }).length + " hollow");

ok("the lyrics were not read as notes",
   got.notes.every(function(n){ return n.y < n.staff.bottom + STEP * 4.5; }),
   "notes below the staves: " + got.notes.filter(function(n){ return n.y > n.staff.bottom + STEP * 4.5; }).length);

console.log("");
if(problems.length){
  problems.forEach(function(p){ console.log("  ! " + p); });
  console.log("\n" + problems.length + " problem(s)");
  process.exit(1);
}
console.log("pdfscan: ok -- a drawn page of staves, filled and hollow heads and a\n" +
            "         line of lyrics reads back as the scale it was drawn from");
