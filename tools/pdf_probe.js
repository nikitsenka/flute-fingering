/* What is actually inside a PDF someone wants to import.
 *
 * Point it at a file and it says which of the two sorts it is -- an engraving
 * made of vectors, or a scan made of pixels -- and, for an engraving, whether
 * its glyphs can be named. That last question decides how the recognition has
 * to work: a music font that is embedded as a subset with no ToUnicode map
 * carries its noteheads under codes that mean nothing outside that one file, so
 * a head has to be identified by its shape instead. Some engravers skip the
 * font entirely and draw outlines, which looks the same from here: no glyphs,
 * many curves.
 *
 * This reports; it decides nothing. It exists so that a real file answers the
 * question instead of an argument about what such files usually contain.
 *
 *     node tools/pdf_probe.js path/to/score.pdf [more.pdf ...]
 *     node tools/pdf_probe.js --pages 3 score.pdf
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var zlib = require("zlib");

var ROOT = path.join(__dirname, "..");

var sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "pdfread.js"), "utf8"), sandbox, {filename:"pdfread.js"});
var PdfRead = sandbox.PdfRead;

function inflate(bytes){
  return new Promise(function(resolve, reject){
    zlib.inflate(Buffer.from(bytes), function(err, out){
      if(err){ reject(err); } else { resolve(new Uint8Array(out)); }
    });
  });
}

var args = process.argv.slice(2);
var maxPages = 2;
var files = [];
for(var i = 0; i < args.length; i++){
  if(args[i] === "--pages"){ maxPages = +args[++i] || 1; continue; }
  files.push(args[i]);
}

if(!files.length){
  console.log("usage: node tools/pdf_probe.js [--pages N] file.pdf ...");
  process.exit(2);
}

/* Staff lines are the one structure worth naming here, because their spacing is
 * the ruler every pitch is later measured against, and because five evenly
 * spaced long horizontals is the cheapest proof that a page holds music at all.
 * Grouping stops there -- what sits between the lines is the recogniser's job. */
function staffGroups(pg){
  var horizontals = pg.fills.filter(function(f){
    return !f.curves && f.h <= 3 && f.w > pg.width * 0.4;
  }).map(function(f){ return f.y + f.h / 2; });

  pg.strokes.forEach(function(s){
    if(s.h <= 3 && s.w > pg.width * 0.4){ horizontals.push(s.y + s.h / 2); }
  });

  horizontals.sort(function(a, b){ return b - a; });

  var groups = [], run = [];
  for(var i = 0; i < horizontals.length; i++){
    if(!run.length){ run = [horizontals[i]]; continue; }
    var gap = run[run.length - 1] - horizontals[i];
    var prevGap = run.length > 1 ? run[run.length - 2] - run[run.length - 1] : gap;
    /* one system: consecutive lines a constant distance apart */
    if(gap > 0.5 && gap < 40 && Math.abs(gap - prevGap) < Math.max(0.6, prevGap * 0.15)){
      run.push(horizontals[i]);
    } else {
      if(run.length >= 4){ groups.push(run); }
      run = [horizontals[i]];
    }
  }
  if(run.length >= 4){ groups.push(run); }
  return groups;
}

function fontLine(f){
  var bits = [f.family || "(unnamed)", f.subtype];
  if(f.subset){ bits.push("subset"); }
  bits.push(f.embedded ? "embedded" : "not embedded");
  bits.push(f.toUnicode ? "has ToUnicode" : "NO ToUnicode");
  if(f.differences){ bits.push(f.differences + " encoding differences"); }
  return bits.join(", ");
}

function verdict(pg, cls, groups, glyphsByFont){
  var lines = [];
  if(cls.kind === "scan"){
    lines.push("SCAN -- the music is pixels. Nothing here can be read by geometry; this needs");
    lines.push("OMR, which is a different project. The importer should say so plainly and stop.");
    if(cls.marks){
      lines.push("(The " + cls.marks + " vector mark(s) over it are a stamp or a watermark, not music.)");
    }
    return lines;
  }
  if(cls.kind !== "engraved"){
    lines.push(cls.kind.toUpperCase() + " -- " + cls.why + ".");
    return lines;
  }

  lines.push("ENGRAVED -- " + cls.why + ".");
  if(groups.length){
    var spacing = groups.map(function(g){ return (g[0] - g[g.length - 1]) / (g.length - 1); });
    var avg = spacing.reduce(function(a, b){ return a + b; }, 0) / spacing.length;
    lines.push(groups.length + " staff-like group(s), " + avg.toFixed(2) + " pt between lines.");
  } else {
    lines.push("No group of evenly spaced long horizontals -- either not music, or the");
    lines.push("staff lines are drawn some way this reader does not see yet.");
  }

  var musicFonts = Object.keys(glyphsByFont).filter(function(k){ return glyphsByFont[k] > 20; });
  if(!musicFonts.length){
    lines.push("Almost no glyphs: the noteheads are outlines, not text. Recognition has to");
    lines.push("go by shape -- which is the harder branch, and worth knowing now.");
  }
  return lines;
}

function probe(file){
  var bytes;
  try {
    bytes = new Uint8Array(fs.readFileSync(file));
  } catch(e){
    console.log(file + ": cannot read -- " + e.message);
    return Promise.resolve();
  }

  console.log("");
  console.log("=== " + file + "  (" + (bytes.length / 1024).toFixed(1) + " KB)");

  return PdfRead.open(bytes, inflate).then(function(doc){
    console.log("pages: " + doc.pages.length + (doc.pages.length > maxPages ? " (reading the first " + maxPages + ")" : ""));
    var chain = Promise.resolve();
    var n = Math.min(doc.pages.length, maxPages);
    for(var p = 0; p < n; p++){
      (function(p){
        chain = chain.then(function(){
          return PdfRead.page(doc, p).then(function(pg){
            var cls = PdfRead.classify(pg);
            var groups = staffGroups(pg);
            var glyphsByFont = {};
            pg.texts.forEach(function(t){
              var key = t.font || "(none)";
              glyphsByFont[key] = (glyphsByFont[key] || 0) + t.length;
            });

            console.log("");
            console.log("-- page " + (p + 1) + ": " + pg.width.toFixed(0) + " x " + pg.height.toFixed(0) + " pt"
                        + (pg.rotate ? ", rotated " + pg.rotate + "°" : ""));
            console.log("   marks: " + pg.fills.length + " filled, " + pg.strokes.length + " stroked, "
                        + pg.fills.filter(function(f){ return f.curves; }).length + " of them curved");
            console.log("   images: " + pg.images.length + (cls.imageShare ? " covering " + Math.round(cls.imageShare * 100) + "% of the page" : ""));
            console.log("   glyphs: " + cls.glyphs + (Object.keys(glyphsByFont).length
                        ? " (" + Object.keys(glyphsByFont).map(function(k){ return k + ": " + glyphsByFont[k]; }).join(", ") + ")" : ""));
            if(pg.truncated){ console.log("   NOTE: this page draws more than the reader kept"); }

            if(pg.fonts.length){
              console.log("   fonts:");
              pg.fonts.forEach(function(f){ console.log("     " + f.key + " = " + fontLine(f)); });
            } else {
              console.log("   fonts: none on this page");
            }

            groups.slice(0, 4).forEach(function(g, i){
              console.log("   staff " + (i + 1) + ": " + g.length + " lines, y "
                          + g[0].toFixed(1) + " down to " + g[g.length - 1].toFixed(1));
            });
            if(groups.length > 4){ console.log("   ... and " + (groups.length - 4) + " more staff-like groups"); }

            console.log("");
            verdict(pg, cls, groups, glyphsByFont).forEach(function(l){ console.log("   " + l); });
          });
        });
      })(p);
    }
    return chain;
  }, function(err){
    console.log("could not open: " + err.message);
  });
}

var chain = Promise.resolve();
files.forEach(function(f){ chain = chain.then(function(){ return probe(f); }); });
chain.then(function(){ console.log(""); }, function(err){
  console.error(err && err.stack || err);
  process.exit(1);
});
