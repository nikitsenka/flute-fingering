/* Checks the tones the app actually asks for -- pitch and timing -- by running
 * it in a real browser and recording every note it schedules.
 *
 * check_pitch.js proves the table and the formula are right. It cannot prove
 * the app uses them: a wrong pitch passed to beep(), a note played twice, or a
 * tempo that does not follow the slider would all pass it. Nor does it look at
 * rhythm at all, and a trainer with the right notes at the wrong moments is
 * still wrong.
 *
 * So this wraps AudioContext.createOscillator in the page, records the
 * frequency and start time of every note the app schedules, and compares that
 * against the timeline read from songs.js -- the same source the app plays from.
 *
 * What this still does NOT check: that the machine emits any sound. The graph
 * can be perfect into a muted device. That needs a speaker and an ear, once.
 *
 * And it cannot catch a score that is musically wrong. Expectation and app are
 * read from the same songs.js, so corrupting a note there moves both sides
 * together and this stays green -- which is how the first attempt at a negative
 * test for it failed. To see this instrument fail, break the app: freq() off by
 * a semitone reports 100.00 cents on every note, and a clock running 20% fast
 * reports the piece running 1160 ms short over 14 beats.
 *
 *     node tools/check_audio.js
 *
 * Needs playwright and a browser, which the app itself does not -- this is a
 * developer check, not a build step. Without them it skips rather than fails,
 * so it can sit in the same run as the dependency-free checks.
 */
"use strict";

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");

var playwright;
try {
  playwright = require("playwright");
} catch (e) {
  /* -g rather than -D on purpose: this repo has no package.json, so there is
     nowhere for a dev dependency to be recorded, and require() here resolves
     against a global install or a parent node_modules. Whether the repo should
     gain a package.json is a bigger question than this one check. */
  console.log("skipped: playwright is not installed");
  console.log("  npm i -g playwright && npx playwright install chromium");
  process.exit(0);
}

/* ---------- what the app should play, read from the app's own data ---------- */

var sandbox = {window:{}, document:{documentElement:{}}};
sandbox.global = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js", "notenames.js", "durations.js", "score.js", "songs.js",
 "instruments.js", "instruments/flute.js", "instruments/piano.js"].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});

var Note = sandbox.window.Note;
var BEATS = sandbox.window.DURATIONS.beats;   /* code -> beats */
var SONG = sandbox.SONGS[0];
var BPM = 120;                       /* the top of the tempo slider: least waiting */
var SECONDS_PER_BEAT = 60 / BPM;
var CENT = 1200 / Math.log(2);

function freq(pitch){ return 440 * Math.pow(2, (Note.midi(pitch) - 69) / 12); }
function cents(a, b){ return CENT * Math.log(a / b); }

var expected = [];
var beat = 0;
SONG.score.measures.forEach(function(m){
  m.notes.forEach(function(n){
    if(n[0] !== "R"){ expected.push({pitch:n[0], beat:beat, hz:freq(n[0])}); }
    beat += BEATS[n[1]];
  });
});

/* ---------- serve the app, drive it, record what it schedules ---------- */

var TYPES = {".html":"text/html", ".js":"text/javascript", ".css":"text/css",
             ".svg":"image/svg+xml", ".png":"image/png"};

var server = http.createServer(function(req, res){
  var rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
  var file = path.join(ROOT, rel || "index.html");
  if(file.indexOf(ROOT) !== 0){ res.writeHead(403).end(); return; }
  fs.readFile(file, function(err, body){
    if(err){ res.writeHead(404).end(); return; }
    res.writeHead(200, {"Content-Type": TYPES[path.extname(file)] || "application/octet-stream"});
    res.end(body);
  });
});

/* Every note the page asks the audio hardware for, in the order it asks. */
function record(){
  window.__played = [];
  var AC = window.AudioContext || window.webkitAudioContext;
  var make = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function(){
    var osc = make.call(this);
    var ctx = this;
    var start = osc.start.bind(osc);
    osc.start = function(when){
      window.__played.push({hz: osc.frequency.value,
                            at: (when === undefined ? ctx.currentTime : when)});
      return start(when);
    };
    return osc;
  };
}

server.listen(0, "127.0.0.1", function(){
  var base = "http://127.0.0.1:" + server.address().port;
  run(base).then(function(code){
    server.close();
    process.exit(code);
  }).catch(function(err){
    server.close();
    console.error(String(err && err.message || err));
    process.exit(1);
  });
});

async function run(base){
  var browser = await playwright.chromium.launch({
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
    ignoreDefaultArgs: ["--mute-audio"]
  });
  var ctx = await browser.newContext({viewport:{width:1280, height:900}});
  await ctx.addInitScript(record);

  var page = await ctx.newPage();
  var pageErrors = [];
  page.on("pageerror", function(e){ pageErrors.push(e.message); });

  await page.goto(base + "/game.html");
  await page.waitForSelector("#play");
  await page.selectOption("#song", SONG.id).catch(function(){});
  /* Read the toggle rather than assuming it starts off. If that default ever
     flips, clicking blind would turn sound off and the run would fail with
     "scheduled 0 notes" -- true, and pointing at the wrong thing. */
  if(await page.getAttribute("#sound", "aria-pressed") === "false"){
    await page.click("#sound");
  }
  await page.fill("#bpm", String(BPM));
  await page.evaluate(function(){
    document.getElementById("bpm").dispatchEvent(new Event("input", {bubbles:true}));
  });
  await page.click("#play");

  /* the piece plus a beat of slack; give up rather than hang if it stalls */
  var deadline = Date.now() + (beat + 1) * SECONDS_PER_BEAT * 1000 + 4000;
  var played = [];
  while(Date.now() < deadline){
    played = await page.evaluate(function(){ return window.__played; });
    if(played.length >= expected.length){ break; }
    await page.waitForTimeout(150);
  }
  await browser.close();

  return report(played, pageErrors);
}

function report(played, pageErrors){
  var problems = [];

  if(played.length !== expected.length){
    problems.push(SONG.id + ": scheduled " + played.length + " notes, the score has " +
                  expected.length);
  }

  var worstPitch = 0, worstTiming = 0;
  played.slice(0, expected.length).forEach(function(note, i){
    var want = expected[i];
    var off = cents(note.hz, want.hz);
    if(Math.abs(off) > 1){
      problems.push(want.pitch + " (note " + (i + 1) + "): played " + note.hz.toFixed(2) +
                    " Hz, expected " + want.hz.toFixed(2) + " (" + off.toFixed(2) + " cents)");
    }
    worstPitch = Math.max(worstPitch, Math.abs(off));

    if(i > 0){
      var gap = note.at - played[i - 1].at;
      var wantGap = (want.beat - expected[i - 1].beat) * SECONDS_PER_BEAT;
      var driftMs = (gap - wantGap) * 1000;
      /* Notes are scheduled as they cross the line, so each onset carries up to
         a frame of jitter -- measured 2-12ms here, and more on a loaded
         machine. 35ms is loose enough not to flake on that and still a
         fourteenth of a beat at this tempo. Drift that matters musically
         accumulates, and the total below is what catches it. */
      if(Math.abs(driftMs) > 35){
        problems.push(want.pitch + " (note " + (i + 1) + "): came " + driftMs.toFixed(0) +
                      " ms " + (driftMs > 0 ? "late" : "early"));
      }
      worstTiming = Math.max(worstTiming, Math.abs(driftMs));
    }
  });

  /* The one that says whether the app keeps tempo: per-note jitter cancels out,
     a tempo that is wrong does not. Half a beat apart over a whole piece is
     already a note landing on the wrong beat. */
  var totalMs = 0;
  if(played.length >= 2 && expected.length >= 2){
    var lastPlayed = Math.min(played.length, expected.length) - 1;
    var heard = played[lastPlayed].at - played[0].at;
    var wanted = (expected[lastPlayed].beat - expected[0].beat) * SECONDS_PER_BEAT;
    totalMs = (heard - wanted) * 1000;
    if(Math.abs(totalMs) > SECONDS_PER_BEAT * 500){
      problems.push("tempo: the piece ran " + totalMs.toFixed(0) + " ms " +
                    (totalMs > 0 ? "long" : "short") + " over " +
                    (expected[lastPlayed].beat - expected[0].beat) + " beats");
    }
  }

  pageErrors.forEach(function(e){ problems.push("page error: " + e); });

  console.log("piece     " + SONG.id + "   " + expected.length + " notes at " + BPM + " bpm");
  console.log("pitch     worst " + worstPitch.toFixed(3) + " cents off");
  console.log("timing    worst " + worstTiming.toFixed(1) + " ms off between notes");
  console.log("tempo     " + totalMs.toFixed(1) + " ms drift over the whole piece");
  console.log("");

  if(problems.length){
    console.log(problems.length + " problem(s):");
    problems.forEach(function(p){ console.log("  " + p); });
    return 1;
  }
  console.log("every note on pitch and on time");
  return 0;
}
