/* Loading a MusicXML file straight in the browser.
 *
 * The same job as tools/import_musicxml.py, but client side, so a file can be
 * added from the page without a terminal. The file is read locally and never
 * leaves the machine.
 *
 * A .mxl is a zip; the zip is unpacked here by hand (central directory ->
 * local header -> DecompressionStream) rather than pulling in a library,
 * because this project vendors everything and loads no CDN.
 *
 * Arrangements usually carry several lines at once -- voice, piano left and
 * right hand, backing parts. analyze() lists every one of them with the facts
 * needed to tell them apart, and guesses which is the tune; the caller shows
 * that list and lets the player choose.
 */
(function(global){
  "use strict";

  var FIFTHS = {0:"C", 1:"G", 2:"D", 3:"A", 4:"E", 5:"B", 6:"F#", 7:"C#",
                "-1":"F", "-2":"Bb", "-3":"Eb", "-4":"Ab", "-5":"Db",
                "-6":"Gb", "-7":"Cb"};

  var SEMI = {c:0, d:2, e:4, f:5, g:7, a:9, b:11};
  var NAMES = ["c","c#","d","d#","e","f","f#","g","g#","a","a#","b"];

  /* Failures end up in front of the player, so they carry a translation key
     alongside an English message -- the key for the page to look up, the
     message so the error still reads sensibly in a console or a stack trace. */
  function fail(code, message){
    var e = new Error(message);
    e.i18n = code;
    return e;
  }

  function midi(pitch){
    var bits = pitch.split("/");
    return (+bits[1] + 1) * 12 + SEMI[bits[0][0]] + (bits[0].indexOf("#") > 0 ? 1 : 0);
  }

  /* "Playable" is a question about the instrument on screen, not about the
     file: the same line is 40% of a flute and all of a piano. Everything here
     that judges a line asks the current instrument. */
  function instrument(){
    return (global.Instruments && global.Instruments.current()) || null;
  }

  function playableOn(pitch){
    var inst = instrument();
    return !!(inst && inst.has(pitch));
  }

  /* ---------- zip ---------- */

  function u16(v, o){ return v.getUint16(o, true); }
  function u32(v, o){ return v.getUint32(o, true); }

  function zipEntries(buf){
    var view = new DataView(buf);
    var end = -1;
    /* the end-of-central-directory record is last, after an optional comment */
    for(var i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 65558; i--){
      if(u32(view, i) === 0x06054b50){ end = i; break; }
    }
    if(end < 0){ throw fail("import.err.notZip", "does not look like a zip archive (.mxl)"); }

    var count = u16(view, end + 10);
    var at = u32(view, end + 16);
    var out = [];
    for(var n = 0; n < count; n++){
      if(u32(view, at) !== 0x02014b50){ break; }
      var method = u16(view, at + 10);
      var packed = u32(view, at + 20);
      var nameLen = u16(view, at + 28);
      var extraLen = u16(view, at + 30);
      var commentLen = u16(view, at + 32);
      var local = u32(view, at + 42);
      var name = new TextDecoder().decode(
        new Uint8Array(buf, at + 46, nameLen));

      /* the local header repeats the name and may hold a different extra field */
      var dataAt = local + 30 + u16(view, local + 26) + u16(view, local + 28);
      out.push({name:name, method:method,
                bytes:new Uint8Array(buf, dataAt, packed)});
      at += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  function inflate(entry){
    if(entry.method === 0){ return Promise.resolve(entry.bytes); }
    if(entry.method !== 8){
      return Promise.reject(fail("import.err.compression", "unknown compression in the archive"));
    }
    var stream = new Blob([entry.bytes]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).arrayBuffer().then(function(b){
      return new Uint8Array(b);
    });
  }

  /* ---------- reading the file ---------- */

  function parseXml(text){
    var doc = new DOMParser().parseFromString(text, "application/xml");
    if(doc.querySelector("parsererror")){
      throw fail("import.err.notXml", "the file does not read as XML");
    }
    if(!doc.querySelector("score-partwise, score-timewise")){
      throw fail("import.err.notMusicXml", "this is not MusicXML");
    }
    return doc;
  }

  function read(file){
    return file.arrayBuffer().then(function(buf){
      var head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
      if(head[0] !== 0x50 || head[1] !== 0x4b){          /* "PK" */
        return parseXml(new TextDecoder().decode(new Uint8Array(buf)));
      }
      var entries = zipEntries(buf);
      var manifest = entries.filter(function(e){
        return /container\.xml$/i.test(e.name);
      })[0];
      var pick = function(){
        var scores = entries.filter(function(e){
          return /\.(musicxml|xml)$/i.test(e.name) && !/META-INF/i.test(e.name);
        });
        if(!scores.length){ throw fail("import.err.noScore", "there is no score inside the archive"); }
        return scores[0];
      };
      if(!manifest){ return inflate(pick()).then(decodeXml); }
      return inflate(manifest).then(function(bytes){
        var root = new DOMParser().parseFromString(
          new TextDecoder().decode(bytes), "application/xml");
        var node = root.querySelector("rootfile");
        var path = node && node.getAttribute("full-path");
        var wanted = entries.filter(function(e){ return e.name === path; })[0];
        return inflate(wanted || pick()).then(decodeXml);
      });
    });
  }

  function decodeXml(bytes){
    return parseXml(new TextDecoder().decode(bytes));
  }

  /* ---------- what lines does this file hold? ---------- */

  function pitchOf(note){
    var p = note.querySelector("pitch");
    if(!p){ return null; }
    var step = (text(p, "step") || "").toLowerCase();
    var octave = +(text(p, "octave") || 4);
    var alter = Math.round(+(text(p, "alter") || 0));
    if(!(step in SEMI)){ return null; }
    if(alter === 0){ return step + "/" + octave; }
    if(alter === 1){ return step + "#/" + octave; }
    if(alter === -1){                       /* respell flats upward: bb -> a# */
      var n = midi(step + "/" + octave) - 1;
      return NAMES[((n % 12) + 12) % 12] + "/" + (Math.floor(n / 12) - 1);
    }
    return null;                            /* double accidentals */
  }

  function text(node, tag){
    var el = node.querySelector(tag);
    return el ? el.textContent.trim() : null;
  }

  function partName(doc, id){
    var list = doc.querySelectorAll("part-list > score-part");
    for(var i = 0; i < list.length; i++){
      if(list[i].getAttribute("id") === id){
        return text(list[i], "part-name") || id;
      }
    }
    return id;
  }

  /* One entry per (part, staff, voice) that actually carries notes. */
  function analyze(doc){
    var lines = {};
    var parts = doc.querySelectorAll("part");

    for(var p = 0; p < parts.length; p++){
      var id = parts[p].getAttribute("id");
      var notes = parts[p].querySelectorAll("measure > note");
      for(var i = 0; i < notes.length; i++){
        var note = notes[i];
        if(note.querySelector("grace")){ continue; }
        var staff = text(note, "staff") || "1";
        var voice = text(note, "voice") || "1";
        var key = id + "|" + staff + "|" + voice;
        var line = lines[key] || (lines[key] = {
          part:id, partName:partName(doc, id), staff:staff, voice:voice,
          notes:0, rests:0, sum:0, lo:null, hi:null, playable:0, chords:0,
          used:{}
        });
        if(note.querySelector("chord")){ line.chords++; continue; }
        if(note.querySelector("rest")){ line.rests++; continue; }

        var pitch = pitchOf(note);
        if(!pitch){ continue; }
        var m = midi(pitch);
        line.notes++;
        line.sum += m;
        if(line.lo === null || m < line.lo){ line.lo = m; }
        if(line.hi === null || m > line.hi){ line.hi = m; }
        line.used[pitch] = (line.used[pitch] || 0) + 1;
        if(playableOn(pitch)){ line.playable++; }
      }
    }

    var out = [];
    for(var k in lines){
      if(lines[k].notes){ out.push(lines[k]); }
    }
    if(!out.length){ return out; }

    var most = Math.max.apply(null, out.map(function(l){ return l.notes; }));
    var top = Math.max.apply(null, out.map(function(l){ return l.sum / l.notes; }));
    out.forEach(function(l){
      l.share = l.playable / l.notes;
      l.average = l.sum / l.notes;
      /* a tune is the line that is mostly playable, has plenty of notes, and
         sits high -- an accompaniment is low and a bass line is lower still */
      l.rank = l.share * 2 + (l.notes / most) + (l.average / top);
      /* partName/staff/voice are already on the entry; the page spells the
         label out itself, in the reader's language */
    });
    out.sort(function(a, b){ return b.rank - a.rank; });
    return out;
  }

  /* ---------- one line -> a song ---------- */

  function convert(doc, line, options){
    options = options || {};
    var shift = options.octave || 0;
    var firstBar = options.firstBar || 1;

    var part = null;
    var parts = doc.querySelectorAll("part");
    for(var i = 0; i < parts.length; i++){
      if(parts[i].getAttribute("id") === line.part){ part = parts[i]; }
    }
    if(!part){ throw fail("import.err.noPart", "part not found"); }

    var divisions = 1, key = "C", time = "4/4", perBar = 4;
    var measures = [], problems = [], used = {};
    var bars = part.querySelectorAll("measure");

    for(var b = 0; b < bars.length; b++){
      var attrs = bars[b].querySelector("attributes");
      if(attrs){
        if(text(attrs, "divisions")){ divisions = +text(attrs, "divisions"); }
        var fifths = attrs.querySelector("key > fifths");
        if(fifths){ key = FIFTHS[+fifths.textContent] || "C"; }
        var sig = attrs.querySelector("time");
        if(sig){
          var top = +(text(sig, "beats") || 4);
          var bottom = +(text(sig, "beat-type") || 4);
          time = top + "/" + bottom;
          perBar = top * 4 / bottom;
        }
      }

      var number = firstBar + b;
      var notes = [], total = 0;
      var kids = bars[b].querySelectorAll("note");

      for(var n = 0; n < kids.length; n++){
        var note = kids[n];
        if(note.querySelector("grace")){ continue; }
        if((text(note, "staff") || "1") !== line.staff){ continue; }
        if((text(note, "voice") || "1") !== line.voice){ continue; }

        if(note.querySelector("chord")){
          /* monophonic game: keep the top note of a chord */
          var extra = pitchOf(note);
          var prev = notes[notes.length - 1];
          if(extra && prev && prev[0] !== "R" && midi(extra) > midi(prev[0])){
            prev[0] = shiftPitch(extra, shift);
          }
          continue;
        }

        var beats = divisions ? (+(text(note, "duration") || 0)) / divisions : 0;
        var code = global.DURATIONS.codeFor(beats);
        if(!code){
          problems.push("bar " + number + ": duration " +
                        Math.round(beats * 1000) / 1000 + " does not fit the grid");
          code = "q";
          beats = 1;
        }

        if(note.querySelector("rest")){
          notes.push(["R", code]);
        } else {
          var pitch = pitchOf(note);
          if(!pitch){
            problems.push("bar " + number + ": unsupported accidental");
            notes.push(["R", code]);
          } else {
            pitch = shiftPitch(pitch, shift);
            used[pitch] = true;
            notes.push([pitch, code]);
          }
        }
        total += beats;
      }

      if(!notes.length){ continue; }
      if(Math.abs(total - perBar) > 1e-6){
        problems.push("bar " + number + ": " + (Math.round(total * 100) / 100) +
                      " beats instead of " + perBar);
      }
      measures.push({n:number, notes:notes, beams:[], ties:[], slurs:[],
                     bar:null, repeat:null, sys:0});
    }

    if(!measures.length){ throw fail("import.err.noNotes", "there are no notes in this line"); }
    measures[measures.length - 1].bar = "double";

    var pitches = Object.keys(used).sort(function(a, b){ return midi(a) - midi(b); });
    var missing = pitches.filter(function(p){ return !playableOn(p); });

    return {
      score: {key:key, time:time, measures:measures, systems:[], crossSlurs:[]},
      report: {bars:measures.length, pitches:pitches, missing:missing,
               problems:problems}
    };
  }

  function shiftPitch(pitch, octaves){
    if(!octaves){ return pitch; }
    var bits = pitch.split("/");
    return bits[0] + "/" + (+bits[1] + octaves);
  }

  /* How far the line would have to move to sit inside the instrument's range --
     the shift that leaves the largest share of it playable. A piano swallows
     nearly anything, so this usually answers 0 for one; a flute rarely does. */
  function suggestOctave(line){
    var inst = instrument();
    var LOWEST  = inst ? inst.range.lo : 60;
    var HIGHEST = inst ? inst.range.hi : 83;
    var best = 0, bestScore = -1;
    for(var shift = -2; shift <= 2; shift++){
      var lo = line.lo + shift * 12, hi = line.hi + shift * 12;
      var inside = Math.max(0, Math.min(hi, HIGHEST) - Math.max(lo, LOWEST) + 1);
      var score = inside / (hi - lo + 1);
      if(score > bestScore){ bestScore = score; best = shift; }
    }
    return best;
  }

  /* What share of a line has a fingering once it is moved by `octaves`.
     analyze() can only answer for the octave the file was written in, but the
     reader picks a shift afterwards and the answer moves with it: a line that
     is unplayable as written may be entirely playable an octave down, and a
     line that reads fine can be shifted into a register the instrument does
     not have. Counting by note rather than by distinct pitch, so one stray
     note in a hundred does not read the same as half the tune. */
  function playableShare(line, octaves){
    if(!line || !line.notes){ return 0; }
    var ok = 0;
    for(var pitch in line.used){
      if(playableOn(shiftPitch(pitch, octaves || 0))){ ok += line.used[pitch]; }
    }
    return ok / line.notes;
  }

  global.SongImport = {
    read: read,
    analyze: analyze,
    convert: convert,
    suggestOctave: suggestOctave,
    playableShare: playableShare
  };
})(window);
