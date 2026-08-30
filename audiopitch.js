/* Turning a recording into note events: what was played, when, and how sure.
 *
 * The signal half of importing a piece from audio. Everything here is
 * arithmetic over a block of samples -- no DOM, no files, no translation --
 * so it runs the same in the page and in tools/check_audiopitch.js, which is
 * what lets it be tested on signals whose notes are known exactly.
 *
 * The musical half lives elsewhere: this reports herz and seconds, and
 * audioimport.js turns those into beats, durations from durations.js and bars
 * of DURATIONS.perBar. The line is deliberate -- quantising needs the score
 * model, and pitch detection must not know about it.
 *
 *   AudioPitch.notes(samples, sampleRate, opts) -> {notes, tempo, source, frames}
 *
 *     notes[]  {midi, cents, t, dur, conf}   t and dur in seconds
 *     tempo    {bpm, conf}
 *     source   {verdict, share, aperiodicity}   "mono" | "mixed" | "dense"
 *
 * Why YIN and not autocorrelation. A flute in its top octave is close to a
 * pure sine, and plain autocorrelation on a sine has near-equal peaks at one
 * period and at two, so it picks the wrong one and reports the note an octave
 * low. It does not report this as doubt -- it is confident and wrong, which is
 * the worst failure a trainer can have. YIN's cumulative mean normalised
 * difference plus an absolute threshold is the standard answer to exactly that
 * trap, so it is what this uses, and tools/check_audiopitch.js keeps a pure
 * sine in its samples to prove the trap stays shut.
 *
 * What this is honest about: it hears one voice. A monophonic tracker on a
 * mixed recording does not degrade gently -- it latches onto whichever source
 * is loudest, usually the bass, and jumps between them without ever lowering
 * its confidence. So `source` exists to say "this is not one instrument"
 * before anything downstream draws a stave from it.
 */
(function(global){
  "use strict";

  /* Frames are ~46 ms of audio every ~6 ms. The length has to hold two or
     three periods of the lowest note we look for; the hop is what decides how
     precisely a note's start can be placed, and 6 ms is finer than any player
     is consistent to. */
  var FRAME_MS = 46;
  var HOP_MS = 6;

  var F_MIN = 60;        /* Hz -- below a bass guitar's low E, and well below any flute */
  var F_MAX = 2300;      /* Hz -- above the flute's top C, which is about 2093 */

  /* YIN's absolute threshold. Lower is stricter: fewer notes found, fewer
     wrong. 0.15 is the value the paper suggests and it behaves on clean
     monophonic material. */
  var YIN_THRESHOLD = 0.15;

  /* A frame counts as a note only if it is periodic enough and loud enough.
     Both of these are guesses until they have been run against real playing --
     see the note on tuning at the bottom of this file. */
  var VOICED_APERIODICITY = 0.45;

  /* Quiet is measured twice, and a frame has to clear both. Relative, because
     a phone at arm's length and a close mic differ by tens of dB and neither is
     wrong; absolute as well, because a recording that is nothing but hiss has a
     loudest part too, and judging it only against itself would find notes in
     it. */
  var SILENCE_FLOOR_DB = -50;
  var SILENCE_ABSOLUTE = 0.002;

  var MIN_NOTE_MS = 60;      /* shorter than this is a detection artefact, not a note */
  var SPLIT_SEMITONES = 0.7; /* a pitch move this big starts a new note */
  var ONSET_RISE_DB = 6;     /* a loudness jump this big restarts a note at the same pitch */

  /* ---------- small helpers ---------- */

  function hzToMidi(hz){ return 69 + 12 * Math.log(hz / 440) / Math.LN2; }

  function median(list){
    if(!list.length){ return 0; }
    var s = list.slice().sort(function(a, b){ return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function db(x){ return 20 * Math.log(Math.max(x, 1e-12)) / Math.LN10; }

  /* ---------- getting the rate down ----------
     YIN costs frame length times the longest period it searches, per frame, and
     at 44.1 kHz that is millions of multiplies a second -- minutes of waiting
     for a song. Nothing about pitch needs that bandwidth: 11 kHz still leaves
     five and a half kHz of headroom over the highest note we look for. So the
     signal is decimated first, and everything downstream works at the lower
     rate.

     Decimating without filtering would fold high partials back down into the
     pitch range and invent periodicity that is not there, so this runs two
     moving averages of the decimation length first. Two, not one: a single
     box car leaks badly between its nulls, and cascading a second one is a
     triangular window, which does not, and costs one more pass. */
  function decimate(samples, rate){
    var factor = Math.max(1, Math.floor(rate / 11025));
    if(factor === 1){ return {samples: samples, rate: rate}; }

    var smooth = boxcar(boxcar(samples, factor), factor);
    var n = Math.floor(smooth.length / factor);
    var out = new Float32Array(n);
    for(var i = 0; i < n; i++){ out[i] = smooth[i * factor]; }
    return {samples: out, rate: rate / factor};
  }

  function boxcar(x, width){
    var out = new Float32Array(x.length);
    var sum = 0;
    for(var i = 0; i < x.length; i++){
      sum += x[i];
      if(i >= width){ sum -= x[i - width]; }
      out[i] = sum / Math.min(i + 1, width);
    }
    return out;
  }

  /* ---------- YIN, one frame ----------
     Returns the period in samples and how aperiodic the frame is at that
     period -- 0 is a perfect repeat, 1 is noise. The caller reads that second
     number as doubt, which is the whole reason to prefer this to a bare
     autocorrelation peak. */
  function yinFrame(buf, start, W, tauMin, tauMax){
    var d = new Float64Array(tauMax + 1);
    var tau, j;

    for(tau = tauMin; tau <= tauMax; tau++){
      var sum = 0;
      for(j = 0; j < W; j++){
        var diff = buf[start + j] - buf[start + j + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }

    /* cumulative mean normalised difference: this is the step that stops a
       sine from looking just as good at twice its period */
    var cmnd = new Float64Array(tauMax + 1);
    var running = 0;
    cmnd[0] = 1;
    for(tau = tauMin; tau <= tauMax; tau++){
      running += d[tau];
      cmnd[tau] = running === 0 ? 1 : d[tau] * (tau - tauMin + 1) / running;
    }

    /* the absolute threshold: take the FIRST dip below it, not the deepest.
       Taking the deepest is exactly how an octave error gets in, because the
       dip at twice the period is often marginally deeper. */
    var best = -1;
    for(tau = tauMin; tau <= tauMax; tau++){
      if(cmnd[tau] < YIN_THRESHOLD){
        while(tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]){ tau++; }
        best = tau;
        break;
      }
    }
    if(best < 0){
      /* nothing crossed the threshold. Report the best candidate anyway with
         its own poor score attached, and let the voicing test throw it out. */
      var lo = tauMin;
      for(tau = tauMin; tau <= tauMax; tau++){ if(cmnd[tau] < cmnd[lo]){ lo = tau; } }
      best = lo;
    }

    /* a period is rarely a whole number of samples; fit a parabola through the
       dip and its neighbours so the pitch is not quantised to the sample rate */
    var refined = best;
    if(best > tauMin && best < tauMax){
      var a = cmnd[best - 1], b = cmnd[best], c = cmnd[best + 1];
      var denom = 2 * (2 * b - a - c);
      if(denom !== 0){ refined = best + (c - a) / denom; }
    }

    return {period: refined, aperiodicity: Math.min(1, cmnd[best])};
  }

  /* ---------- how much energy sits on the period that was found ----------
     A period alone does not prove one instrument, and this is the mistake that
     is easy to make: three notes of a chord add up to a waveform that repeats
     very tidily, on a period well below any of them. YIN finds that period,
     reports almost no aperiodicity, and is entirely wrong about what is
     playing -- the confident nonsense a monophonic tracker is prone to.

     What separates the two cases is where the energy actually is. A real note
     puts most of it on its own fundamental or the harmonic just above; a chord
     read as a subharmonic puts none on the first few harmonics at all and all
     of it higher up. So the lowest harmonic that carries real weight is the
     tell: one or two for a note, three or more for something composite.

     One Goertzel evaluation per harmonic is enough -- a whole spectrum would
     be waste when eight bins answer the question. */
  function goertzel(buf, start, W, freq, rate){
    var w = 2 * Math.PI * freq / rate;
    var coeff = 2 * Math.cos(w);
    var s0 = 0, s1 = 0, s2 = 0;
    for(var i = 0; i < W; i++){
      s0 = buf[start + i] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2)) / W;
  }

  var HARMONICS = 8;
  var HARMONIC_SHARE = 0.15;   /* of the strongest harmonic, to count as present */

  function lowestHarmonic(buf, start, W, f0, rate){
    if(!(f0 > 0)){ return 0; }
    var mags = [];
    var peak = 0;
    for(var k = 1; k <= HARMONICS; k++){
      var f = f0 * k;
      if(f >= rate / 2){ break; }
      var m = goertzel(buf, start, W, f, rate);
      mags.push(m);
      if(m > peak){ peak = m; }
    }
    if(peak <= 0){ return 0; }
    for(var i = 0; i < mags.length; i++){
      if(mags[i] >= peak * HARMONIC_SHARE){ return i + 1; }
    }
    return 0;
  }

  /* ---------- every frame of the recording ---------- */
  function analyseFrames(samples, rate){
    var W = Math.max(64, Math.round(rate * FRAME_MS / 1000));
    var hop = Math.max(1, Math.round(rate * HOP_MS / 1000));
    var tauMin = Math.max(2, Math.floor(rate / F_MAX));
    var tauMax = Math.min(W - 1, Math.ceil(rate / F_MIN));

    var frames = [];
    /* a frame reads W samples starting at `start` and another W a period
       later, so the last one has to fit both */
    var last = samples.length - (W + tauMax);
    for(var start = 0; start <= last; start += hop){
      var rms = 0;
      for(var j = 0; j < W; j++){ rms += samples[start + j] * samples[start + j]; }
      rms = Math.sqrt(rms / W);

      var y = yinFrame(samples, start, W, tauMin, tauMax);
      var hz = y.period > 0 ? rate / y.period : 0;
      frames.push({
        /* the middle of the window, not its edge. A frame is a measurement
           over 46 ms; dating it from where the window opens reports every note
           as starting up to a frame early, because the frame that first hears
           the new note opened before the note began. */
        t: (start + W / 2) / rate,
        rms: rms,
        db: db(rms),
        hz: hz,
        midi: (hz >= F_MIN && hz <= F_MAX) ? hzToMidi(hz) : 0,
        aperiodicity: y.aperiodicity,
        lowest: lowestHarmonic(samples, start, W, hz, rate),
        voiced: false
      });
    }
    return {frames: frames, hop: hop / rate};
  }

  function markVoiced(frames){
    var loudest = -Infinity;
    frames.forEach(function(f){ if(f.db > loudest){ loudest = f.db; } });
    var floor = Math.max(loudest + SILENCE_FLOOR_DB, db(SILENCE_ABSOLUTE));

    frames.forEach(function(f){
      f.voiced = f.midi > 0 && f.aperiodicity < VOICED_APERIODICITY && f.db > floor;
    });
  }

  /* Several channels are one performance recorded twice; averaging them is
     both the cheapest downmix and a small gain in signal to noise. Callers
     that already hold one channel can pass it straight to notes(). */
  function mono(channels){
    if(!channels || !channels.length){ return new Float32Array(0); }
    if(channels.length === 1){ return channels[0]; }
    var n = channels[0].length;
    var out = new Float32Array(n);
    for(var i = 0; i < n; i++){
      var sum = 0;
      for(var c = 0; c < channels.length; c++){ sum += channels[c][i] || 0; }
      out[i] = sum / channels.length;
    }
    return out;
  }

  /* One frame of nonsense in the middle of a held note -- a breath, a bow
     change, a single octave slip -- should not split it in two. A median over
     a few frames removes those without moving a real note boundary, because a
     real boundary lasts far longer than the window. */
  function smoothPitch(frames, span){
    var midis = frames.map(function(f){ return f.midi; });
    for(var i = 0; i < frames.length; i++){
      if(!frames[i].voiced){ continue; }
      var window = [];
      for(var k = i - span; k <= i + span; k++){
        if(k >= 0 && k < frames.length && frames[k].voiced){ window.push(midis[k]); }
      }
      if(window.length){ frames[i].midi = median(window); }
    }
  }

  /* ---------- frames into notes ----------
     Three things end a note: the sound stops, the pitch moves, or the same
     pitch is struck again. The third is the one that is easy to forget and
     impossible to hear past -- two crotchets on one note look like one minim
     unless the attack is noticed. */
  function segment(frames, hopSeconds){
    var notes = [];
    var run = null;

    function close(endIndex){
      if(!run){ return; }
      var dur = frames[endIndex - 1].t + hopSeconds - run.t;
      if(dur * 1000 >= MIN_NOTE_MS && run.midis.length){
        var m = median(run.midis);
        var nearest = Math.round(m);
        var meanAper = run.aper.reduce(function(a, b){ return a + b; }, 0) / run.aper.length;
        notes.push({
          midi: nearest,
          cents: Math.round((m - nearest) * 100),
          t: run.t,
          dur: dur,
          conf: Math.max(0, Math.min(1, 1 - meanAper / VOICED_APERIODICITY))
        });
      }
      run = null;
    }

    for(var i = 0; i < frames.length; i++){
      var f = frames[i];
      if(!f.voiced){ close(i); continue; }

      if(run){
        var moved = Math.abs(f.midi - median(run.midis)) > SPLIT_SEMITONES;
        var struck = f.db - run.peakDb > ONSET_RISE_DB;
        if(moved || struck){ close(i); }
      }
      if(!run){ run = {t: f.t, midis: [], aper: [], peakDb: -Infinity}; }
      run.midis.push(f.midi);
      run.aper.push(f.aperiodicity);
      /* the peak is tracked from the run's own frames so a slow swell does not
         read as a new attack, but a struck note does */
      if(f.db > run.peakDb){ run.peakDb = f.db; }
    }
    close(frames.length);
    return notes;
  }

  /* ---------- how sharp or flat, said precisely ----------
     Everything above runs on a decimated signal, which is right for finding
     which note is playing and wrong for saying how well it is tuned: near the
     top of a flute's range a period is only seven samples at 11 kHz, so a
     parabola through the dip lands the pitch within about a quarter of a
     semitone and no closer. That is twenty-five cents, and the intonation
     reading a player deserves is finer than that.

     So `cents` is measured again on the untouched recording. Which note it is
     has already been settled, and that turns a search into a measurement:
     sweep a narrow band around the pitch already found and take the peak. Only
     the cents are allowed to move -- if this disagreed about the note itself,
     that disagreement would be a bug, and quietly preferring the newer answer
     would hide it. */
  function refineCents(samples, rate, note){
    var guess = 440 * Math.pow(2, (note.midi + note.cents / 100 - 69) / 12);
    /* past the attack, and no longer than the resolution needs */
    var from = Math.round((note.t + note.dur * 0.2) * rate);
    var len = Math.min(Math.round(note.dur * 0.6 * rate), Math.round(0.2 * rate));
    if(from < 0 || len < rate / guess * 4 || from + len >= samples.length){ return note; }

    var STEPS = 16, SPAN = 0.04;     /* +/- 4%, comfortably wider than half a semitone */
    var mags = [];
    for(var i = -STEPS; i <= STEPS; i++){
      mags.push(goertzel(samples, from, len, guess * (1 + SPAN * i / STEPS), rate));
    }

    var peak = 0;
    for(var k = 1; k < mags.length; k++){ if(mags[k] > mags[peak]){ peak = k; } }
    /* a peak hard against the edge means the real one lies outside the band,
       so the band was aimed at the wrong thing -- leave the note as it was */
    if(peak === 0 || peak === mags.length - 1){ return note; }

    var a = mags[peak - 1], b = mags[peak], c = mags[peak + 1];
    var denom = 2 * (2 * b - a - c);
    var offset = denom !== 0 ? (a - c) / denom : 0;
    var refined = guess * (1 + SPAN * (peak - STEPS + offset) / STEPS);

    var midi = hzToMidi(refined);
    if(Math.round(midi) !== note.midi){ return note; }
    note.cents = Math.round((midi - note.midi) * 100);
    return note;
  }

  /* ---------- tempo ----------
     Only note starts are used, which is all a melody gives: there is no drum
     to lock to. For each candidate beat length, the onsets are compared with
     the best-fitting grid of that length, and the one they sit on most tidily
     wins. The score comes back as `conf` because on a rubato phrase there is
     no honest answer and the caller should be told so rather than handed a
     number that looks certain. */
  function estimateTempo(notes){
    if(notes.length < 4){ return {bpm: 0, conf: 0}; }

    var onsets = notes.map(function(n){ return n.t; });
    var best = {bpm: 0, conf: 0};

    /* Where the grid starts is not searched, it is solved. Each onset is put
       on a circle whose full turn is one beat, and the length of the summed
       vector says how tightly they cluster -- one if they all fall on the same
       point of the beat, near zero if they are scattered. The angle of that
       sum is the best phase, so trying offsets by hand only adds a rounding
       error, which is what read a strict 120 as 119. */
    for(var bpm = 40; bpm <= 208; bpm += 1){
      var beat = 60 / bpm;
      var re = 0, im = 0;
      for(var i = 0; i < onsets.length; i++){
        var turn = 2 * Math.PI * onsets[i] / beat;
        re += Math.cos(turn);
        im += Math.sin(turn);
      }
      var score = Math.sqrt(re * re + im * im) / onsets.length;
      if(score > best.conf){ best = {bpm: bpm, conf: score}; }
    }

    /* Half and double are equally good fits by construction, so a melody in 60
       scores the same at 120. Prefer the reading nearest a walking pace, which
       is where most teaching material sits. */
    while(best.bpm > 150){ best.bpm /= 2; }
    while(best.bpm && best.bpm < 45){ best.bpm *= 2; }
    best.bpm = Math.round(best.bpm);
    best.conf = Math.round(best.conf * 100) / 100;
    return best;
  }

  /* ---------- is this one instrument at all ----------
     The question that has to be answered before any of the above is believed.
     On one clean line most frames are periodic and YIN is sure of them; on a
     mix the aperiodicity stays high because no single period explains the
     waveform, and the frames that do pass are the loudest source rather than
     the tune. */
  function judgeSource(frames){
    if(!frames.length){ return {verdict: "dense", share: 0, aperiodicity: 1, composite: 1}; }

    var voiced = frames.filter(function(f){ return f.voiced; });
    var share = voiced.length / frames.length;
    var mean = voiced.length
      ? voiced.reduce(function(a, f){ return a + f.aperiodicity; }, 0) / voiced.length
      : 1;

    /* Three independent ways of not being one instrument, and a recording only
       has to fail one of them.

       Aperiodicity catches a wash of sound with no period at all. The harmonic
       test catches a chord whose notes happen to sum to a tidy period none of
       them is playing. Between-the-teeth catches a second voice sitting over a
       first, which is the case both of the others are blind to, because there
       the fundamental is real and the period is real -- only the melody is
       missing from the answer.

       What none of them catch, and this is a limit rather than a gap: a voice
       doubled exactly at the octave. Its partials fall on the lower voice's
       harmonics precisely, so no measurement of one spectrum can separate the
       two. The consolation is that the reading is then wrong by an octave and
       not in its notes, which is the one error the page already has a control
       for. */
    var composite = voiced.length
      ? voiced.filter(function(f){ return f.lowest >= 3 || f.lowest === 0; }).length / voiced.length
      : 1;

    var verdict;
    if(share >= 0.45 && mean <= 0.30 && composite <= 0.25){ verdict = "mono"; }
    else if(share < 0.20 || mean > 0.40 || composite > 0.60){ verdict = "dense"; }
    else { verdict = "mixed"; }

    return {verdict: verdict, share: Math.round(share * 100) / 100,
            aperiodicity: Math.round(mean * 100) / 100,
            composite: Math.round(composite * 100) / 100};
  }

  /* ---------- the one entry point ---------- */
  function notes(samples, sampleRate, opts){
    opts = opts || {};
    if(!samples || !samples.length || !(sampleRate > 0)){
      return {notes: [], tempo: {bpm: 0, conf: 0},
              source: {verdict: "dense", share: 0, aperiodicity: 1}, frames: 0};
    }

    var low = decimate(samples, sampleRate);
    var analysed = analyseFrames(low.samples, low.rate);
    var frames = analysed.frames;

    markVoiced(frames);
    smoothPitch(frames, opts.smooth === undefined ? 2 : opts.smooth);
    markVoiced(frames);          /* the median may have moved a pitch out of range */

    var found = segment(frames, analysed.hop);
    found.forEach(function(n){ refineCents(samples, sampleRate, n); });

    return {
      notes: found,
      tempo: estimateTempo(found),
      source: judgeSource(frames),
      frames: frames.length
    };
  }

  /* The thresholds above -- what counts as voiced, as silence, as a new attack
     -- are reasoned defaults checked against synthetic signals, which is not
     the same as checked against playing. A real flute has breath noise before
     the tone, a real room has reverb that fills the gaps between notes, and a
     phone recording has both plus its own automatic gain. Expect to move these
     once there is a recording to move them against, and change them here
     rather than at the call site. */
  global.AudioPitch = {
    notes: notes,
    mono: mono,
    /* the pieces, so a check can fail one of them by name rather than
       inferring which stage went wrong from the notes that came out */
    _decimate: decimate,
    _analyseFrames: analyseFrames,
    _segment: segment,
    _estimateTempo: estimateTempo,
    _judgeSource: judgeSource,
    _hzToMidi: hzToMidi
  };
})(typeof window !== "undefined" ? window : this);
