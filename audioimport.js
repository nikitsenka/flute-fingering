/* Turning a recording into a piece you can practise.
 *
 * The same shape as songimport.js -- read -> analyze -> convert -- so the
 * dialog that asks which line to play, the octave shift, the warning about
 * notes the instrument cannot reach and the saving all work here without a
 * change. A format is a module; the page around it does not know what it read.
 *
 * The division of labour is the point of this file. audiopitch.js listens: it
 * turns samples into note events measured in hertz and seconds, and knows
 * nothing about music. Everything here is the other half -- beats, bars, note
 * lengths, key -- and knows nothing about signals. The line between them is
 * where physics stops and notation starts, and it sits at
 *
 *     AudioPitch.notes(samples, rate, opts)
 *       -> {notes:[{midi, cents, t, dur, conf}], tempo:{bpm, conf},
 *           source:{verdict, share}}
 *
 * with t and dur in seconds. Everything after that is this file's problem.
 *
 * The hard part is not the pitches, it is the rhythm -- the same wall the PDF
 * importer meets from the other side. Nobody plays exactly on the beat, so a
 * note that lasts 0.94 of a beat has to become a quarter, and one that lasts
 * 1.6 has to become something the notation can spell. Everything approximate
 * that happens here is written into the report rather than smoothed over, so
 * the player sees what was assumed and can fix it on the way in.
 */
(function(global){
  "use strict";

  /* Errors reach the player, so they carry a translation key and an English
     message, exactly as songimport.js does. */
  function fail(code, message){
    var e = new Error(message);
    e.i18n = code;
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
     The browser owns every codec worth having, so a recording is decoded by
     the same AudioContext the app already builds for playback. Nothing is
     uploaded: decodeAudioData works on the bytes in the page. */

  function read(file){
    return file.arrayBuffer().then(function(buf){
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if(!Ctx){ throw fail("import.err.noAudio", "this browser cannot decode audio"); }
      var ctx = new Ctx();
      return new Promise(function(resolve, reject){
        /* the callback form, because Safari has never returned the promise one */
        ctx.decodeAudioData(buf, resolve, function(){
          reject(fail("import.err.notAudio", "this file does not decode as audio"));
        });
      }).then(function(buffer){
        var channels = [];
        for(var c = 0; c < buffer.numberOfChannels; c++){ channels.push(buffer.getChannelData(c)); }
        if(ctx.close){ ctx.close(); }
        return {
          kind: "audio",
          samples: channels.length === 1 ? channels[0] : global.AudioPitch.mono(channels),
          rate: buffer.sampleRate,
          seconds: buffer.duration,
          heard: null
        };
      });
    });
  }

  /* ---------- octave slips, seen from the music's side ----------
     A single-pitch tracker fails in one particular way: it settles on a
     subharmonic and reports a note an octave low, without any loss of
     confidence -- the signal side cannot catch this, because the test for "is
     this one voice" assumes the fundamental it found is the right one, and this
     is precisely the case where it is not. Audiopitch went looking for a
     spectral tell and found that the slipped comb swallows its own evidence.

     From here it is visible, though, because here we know what instrument the
     notes are for. Two facts do the work:

       spread   The notes span more semitones than the instrument physically
                has. No octave shift can fix that, so either the recording is
                not for this instrument at all, or some notes landed in the
                wrong octave. This needs no threshold -- the instrument's own
                range is the measure.

       jumpy    Melodies step and hold; slips leap an octave and come back. The
                share of neighbouring pairs exactly twelve semitones apart is
                the tell, and unlike the spread it needs a number. 0.15 is set
                from measurement, not taste: on three real recordings a clean
                solo flute and a studio loop both scored 0, and a noisy clip
                whose notes were plainly wrong scored 0.25. Three recordings is
                not many, which is why this only ever produces a warning.

     A third idea -- a note sitting an octave from both neighbours while they
     agree -- was measured too and never fired, not even on the bad clip, so it
     is not here. */

  var JUMPY = 0.15;

  function trouble(midis){
    var inst = instrument();
    if(!inst || midis.length < 3){ return {verdict:"clear"}; }

    var lo = Math.min.apply(null, midis), hi = Math.max.apply(null, midis);
    var spread = hi - lo;
    var span = inst.range.hi - inst.range.lo;

    var jumps = 0;
    for(var i = 1; i < midis.length; i++){
      if(Math.abs(midis[i] - midis[i - 1]) === 12){ jumps++; }
    }
    var share = midis.length > 1 ? jumps / (midis.length - 1) : 0;

    /* And the case neither of those sees. When the tracker follows a lower part
       all the way through -- a bass under the tune -- the result is not ragged
       at all: it is a clean, narrow, consistent line, with no slips to count.
       What gives it away is where it sits. A whole line below the instrument's
       lowest note is either music written for a lower one, which the octave
       control is exactly right for, or the wrong voice, which it cannot fix.
       Both readings are live, so the warning offers both rather than guessing. */
    var below = hi < inst.range.lo;

    return {
      verdict: spread > span ? "wide"
             : (jumps >= 2 && share >= JUMPY) ? "jumpy"
             : below ? "below" : "clear",
      spread: spread,
      span: span,
      jumps: jumps,
      jumpShare: share
    };
  }

  /* ---------- what was heard ----------
     One recording is one line, so the picker has a single row -- but it is the
     same row shape songimport.js produces, because game.html reads these fields
     to write its label, to suggest an octave and to say how much of the line
     the instrument can play. */

  function analyze(audio){
    if(!audio.heard){
      if(!global.AudioPitch){ throw fail("import.err.noPitch", "the listener is not loaded"); }
      audio.heard = global.AudioPitch.notes(audio.samples, audio.rate);
    }
    var heard = audio.heard;
    var notes = heard.notes || [];
    if(!notes.length){ return []; }

    var line = {
      part: "audio", partName: null, staff: "1", voice: "1",
      notes: 0, rests: 0, sum: 0, lo: null, hi: null, playable: 0, chords: 0,
      used: {},
      /* what the listener thought of the recording, carried through so the page
         can warn before it shows anyone a page of nonsense */
      tempo: heard.tempo || {bpm:null, conf:0},
      source: heard.source || {verdict:"mono", share:1},
      seconds: audio.seconds
    };

    notes.forEach(function(n){
      var pitch = global.Note.keyOfMidi(n.midi);
      var m = Math.round(n.midi);
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
    line.trouble = trouble(notes.map(function(n){ return Math.round(n.midi); }));

    /* The listener's own verdict cannot see an octave slip -- it is measured
       from the fundamental it found, which is the thing that slipped -- so on
       exactly the case this catches it still says "one voice". Two verdicts
       that disagree is a trap for whoever reads the wrong one, so the line
       carries a single consolidated answer and keeps the listener's own under
       `heard`, where it is a measurement rather than a conclusion. */
    if(line.trouble.verdict !== "clear" && line.source.verdict === "mono"){
      line.source = {verdict:"suspect", share:line.source.share, heard:line.source.verdict};
    }
    return [line];
  }

  /* ---------- beats ----------
     A recording carries no beat, only seconds. Either the listener guessed a
     tempo or the player states one; either way the guess is written into the
     report, because a tempo that is out by a factor of two turns every quarter
     into an eighth and the piece still adds up -- it just reads wrong. */

  var GRID = 0.25;              /* a sixteenth: the shortest DURATIONS knows */

  function snap(value){ return Math.round(value / GRID) * GRID; }

  /* Beats to note codes. A length the grid can spell exactly becomes one note;
     anything else is built from the longest codes that fit, which is what a tie
     would be on paper. The score model the game plays has no ties, so those
     come out as repeated notes -- audible as a re-articulation, and reported so
     nobody has to wonder why. */
  function spell(beats){
    var out = [];
    var left = Math.round(beats / GRID) * GRID;
    var list = global.DURATIONS.list;
    var guard = 0;
    while(left > 1e-9 && guard++ < 64){
      var placed = null;
      for(var i = 0; i < list.length; i++){
        /* triplets cannot be built up from a straight grid, so they are only
           used when they land exactly -- otherwise a third of a beat would eat
           every quarter that is a hair short */
        if(list[i].triplet){ continue; }
        if(list[i].beats <= left + 1e-9){ placed = list[i]; break; }
      }
      if(!placed){ break; }
      out.push(placed.code);
      left -= placed.beats;
    }
    return out;
  }

  function shiftPitch(pitch, octaves){
    if(!octaves){ return pitch; }
    var bits = pitch.split("/");
    return bits[0] + "/" + (+bits[1] + octaves);
  }

  /* ---------- one recording -> a song ---------- */

  function convert(audio, line, options){
    options = options || {};
    var shift = options.octave || 0;

    var heard = audio.heard;
    if(!heard || !heard.notes || !heard.notes.length){
      throw fail("import.err.noNotes", "there are no notes in this recording");
    }

    var bpm = options.bpm || (heard.tempo && heard.tempo.bpm) || 0;
    if(!(bpm > 0)){ bpm = 60; }
    var beat = 60 / bpm;

    var time = options.time || "4/4";
    var perBar = global.DURATIONS.perBar(time);

    var problems = [];
    if(!options.bpm && (!heard.tempo || !(heard.tempo.conf > 0.5))){
      /* Not "half or double": on a real recording whose own tempo was known,
         the guess came out at three quarters of it -- the estimator had settled
         on a dotted subdivision. The wording says what it can honestly say,
         which is that the number is a guess and worth a look. */
      problems.push("the tempo was guessed at " + Math.round(bpm) +
                    " and may be wrong; check it before playing");
    }

    var slips = line && line.trouble;
    if(slips && slips.verdict === "wide"){
      problems.push("the notes span " + slips.spread + " semitones, more than the instrument " +
                    "has (" + slips.span + ") -- some of them were probably heard an octave out");
    } else if(slips && slips.verdict === "jumpy"){
      problems.push(slips.jumps + " pairs of neighbouring notes are exactly an octave apart, " +
                    "which is more often a slip in the listening than a leap in the music");
    } else if(slips && slips.verdict === "below"){
      problems.push("every note came out below the instrument's range: either the recording " +
                    "is of a lower instrument, or a lower part was followed instead of the melody");
    }
    if(heard.source && heard.source.verdict && heard.source.verdict !== "mono"){
      problems.push("this recording sounds like more than one instrument (" +
                    heard.source.verdict + "), so the notes below are rough");
    }

    /* Events onto the grid. A note's length is the distance to the next attack,
       not the length the player held it -- everyone releases a note before
       playing the next one, and that gap is articulation, not silence.

       Which leaves the question of when a gap IS a rest, and from onsets alone
       it cannot always be answered: two detached eighths and an eighth followed
       by an eighth rest are the same two attacks with the same silence between
       them. So the rule is deliberately conservative -- a whole beat of nothing
       is unmistakable and becomes a rest, anything shorter is read as the
       player letting go. A piece full of staccato therefore comes in as plain
       notes, which is right far more often than a page speckled with rests. */
    var MIN_REST = 1;

    var events = [];
    var first = snap(heard.notes[0].t / beat);
    heard.notes.forEach(function(n, i){
      var startB = snap(n.t / beat) - first;
      var next = heard.notes[i + 1];
      var heldB = snap(n.dur / beat);
      var toNextB = next ? snap(next.t / beat) - first - startB : heldB;
      var lengthB = toNextB;

      var restB = 0;
      if(next && toNextB - heldB >= MIN_REST){
        lengthB = heldB;
        restB = toNextB - heldB;
      }
      if(lengthB < GRID){ lengthB = GRID; }

      var pitch = shiftPitch(global.Note.keyOfMidi(n.midi), shift);
      events.push({pitch:pitch, beats:lengthB, conf:n.conf, cents:n.cents});
      if(restB > 0){ events.push({pitch:"R", beats:restB}); }
    });

    /* The last note has no next attack to measure against, only how long it was
       held -- and a recording usually ends with the player releasing early. Let
       it run to the end of its bar rather than leaving a sliver of rest behind
       a piece: music ends on a whole bar, and a final note held is what anyone
       would have written. */
    var last = events[events.length - 1];
    if(last && last.pitch !== "R"){
      var total = 0;
      events.forEach(function(e){ total += e.beats; });
      var over = total % perBar;
      if(over > 1e-9){ last.beats += perBar - over; }
    }

    /* Bars. A note that runs past a barline is cut at it and continued in the
       next bar, which is what a tie is; without ties in the model the two
       halves sound as two notes, so it goes in the report. */
    var measures = [];
    var current = {n:1, notes:[], beams:[], ties:[], slurs:[], bar:null, repeat:null, sys:0};
    var filled = 0;
    var used = {}, split = 0, offGrid = 0, shaky = 0;

    function push(pitch, beats){
      while(beats > 1e-9){
        var room = perBar - filled;
        var take = Math.min(room, beats);
        spell(take).forEach(function(code){
          current.notes.push([pitch, code]);
          filled += global.DURATIONS.beats[code];
        });
        if(pitch !== "R"){ used[pitch] = true; }
        beats -= take;
        if(filled >= perBar - 1e-9){
          measures.push(current);
          current = {n:measures.length + 1, notes:[], beams:[], ties:[], slurs:[],
                     bar:null, repeat:null, sys:0};
          filled = 0;
          if(beats > 1e-9 && pitch !== "R"){ split++; }
        }
      }
    }

    events.forEach(function(e){
      if(e.pitch !== "R"){
        if(Math.abs(e.cents || 0) > 35){ offGrid++; }
        if(e.conf !== undefined && e.conf < 0.7){ shaky++; }
      }
      push(e.pitch, e.beats);
    });

    /* whatever is left of the last bar is a rest, so every bar is full */
    if(filled > 1e-9){
      push("R", perBar - filled);
    }

    if(!measures.length){ throw fail("import.err.noNotes", "there are no notes in this recording"); }
    measures[measures.length - 1].bar = "double";

    if(split){
      problems.push(split + " note(s) ran across a barline and were split in two, " +
                    "so they will sound as two notes rather than one held one");
    }
    if(offGrid){
      problems.push(offGrid + " note(s) were more than a third of a semitone off pitch " +
                    "and were rounded to the nearest one");
    }
    if(shaky){
      problems.push(shaky + " note(s) were heard with low confidence");
    }

    var pitches = Object.keys(used).sort(function(a, b){
      return global.Note.midi(a) - global.Note.midi(b);
    });
    var missing = pitches.filter(function(p){ return !playableOn(p); });

    return {
      score: {key:options.key || "C", time:time, measures:measures, systems:[], crossSlurs:[]},
      report: {bars:measures.length, pitches:pitches, missing:missing, problems:problems,
               bpm:Math.round(bpm), guessedTempo:!options.bpm}
    };
  }

  global.AudioImport = {
    read: read,
    analyze: analyze,
    convert: convert,
    /* exposed for the check, and because the PDF importer will want the same
       spelling of a beat count once its durations are read */
    spell: spell
  };
})(window);
