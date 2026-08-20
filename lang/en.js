/* English -- the reference locale.
 *
 * Every other file in this folder carries exactly these keys; tools/check_i18n.js
 * enforces that, including the {placeholders} inside each value.
 *
 * The blocks named after an instrument (flute.*, piano.*) are the wording each
 * one supplies through its `copy` and `reference` entries in instruments/. A
 * new instrument means a new block here and in every other locale.
 */
window.I18N_STRINGS = window.I18N_STRINGS || {};
window.I18N_STRINGS.en = {
  "lang.pick": "Language",
  "theme.pick": "Theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.studio": "Studio",

  /* ---------- instruments ---------- */
  "instrument.pick": "Instrument",
  "instrument.flute": "Flute",
  "instrument.piano": "Piano",

  /* ---------- page titles ---------- */
  "app.index.title": "{instrument} — where the notes are",
  "app.notes.plain": "{instrument} sheet music",
  "app.notes.title": "{song} — {instrument} sheet music",
  "app.game.plain": "{instrument} trainer",
  "app.game.title": "{song} — {instrument} trainer",

  /* ---------- note names ---------- */
  "note.c": "C",
  "note.d": "D",
  "note.e": "E",
  "note.f": "F",
  "note.g": "G",
  "note.a": "A",
  "note.b": "B",

  /* "scientific" counts octaves as they are written (C4, C5);
     "register" uses the Russian schoolbook names. */
  "octave.system": "scientific",
  "octave.short": "oct. {n}",
  "octave.long": "octave {n}",
  "octave.small.short": "sm.",
  "octave.small.long": "small octave",
  "octave.great.short": "gr.",
  "octave.great.long": "great octave",
  "octave.contra.short": "contra",
  "octave.contra.long": "contra octave",

  "key.major": "{note} major",
  "key.minor": "{note} minor",

  "hand.left.short": "L",
  "hand.right.short": "R",

  /* ---------- built-in pieces ---------- */
  "song.gamma": "{key} scale",

  /* ---------- the flute ---------- */
  "flute.on": "the flute",
  "flute.sub": "Boehm flute, C foot joint, closed keys",
  "flute.chartCard": "Fingering",
  "flute.legend.closed": "closed",
  "flute.legend.open": "open",
  "flute.hint": "{L}1, {L}2, {L}3 — the index, middle and ring fingers of the left hand.<br>" +
                "{R}1, {R}2, {R}3 — the right hand; the little finger works the E flat key (D♯).<br>" +
                "The right little finger rests on its key nearly all the time.",
  "flute.about": "The notes and the fingerings are drawn in code (VexFlow + SVG) — no more pictures, " +
                 "it all reflows to the width of the screen.<br>" +
                 "A filled key is held down, an empty one is open; top to bottom: thumb, " +
                 "left hand, right hand, little finger (E flat).",
  "flute.svg.lips": "lips",
  "flute.svg.left": "left hand",
  "flute.svg.right": "right hand",
  "flute.svg.pinky": "little finger",

  /* ---------- the piano ---------- */
  "piano.on": "the piano",
  "piano.sub": "Two octaves up from middle C — click a key to see which note it is",
  "piano.chartCard": "Keyboard",
  "piano.legend.press": "press this one",
  "piano.legend.white": "white key",
  "piano.legend.black": "black key",
  "piano.hint": "The leftmost C here is middle C — the note that sits just under the treble " +
                "staff and just over the bass one.<br>" +
                "The chart shows no finger numbers on purpose: which finger plays a note " +
                "depends on the notes around it, not on the note itself.",
  "piano.about": "The notes and the keyboards are drawn in code (VexFlow + SVG), so it all " +
                 "reflows to the width of the screen.<br>" +
                 "Each little keyboard is one octave with the key to press filled in; " +
                 "the number underneath says which octave it is.",

  /* ---------- index.html ---------- */
  "index.pick": "Pick a note",
  "index.staff": "The note on the staff",
  "index.staff.aria": "The note on the staff",

  /* ---------- notes.html ---------- */
  "notes.bars": {one: "{n} bar", other: "{n} bars"},
  "notes.zoomIn.aria": "Bigger",
  "notes.zoomOut.aria": "Smaller",
  "notes.denser": "Tighter lines",
  "notes.trainer": "Trainer: notes fall from the top",

  /* ---------- game.html ---------- */
  "game.sub": "Notes fall from the top. The lane they land on is the one to play.",
  "game.play": "▶ Play",
  "game.pause": "❚❚ Pause",
  "game.restart": "↺ Restart",
  "game.piece": "piece",
  "game.add": "＋ From file",
  "game.add.title": "Load MusicXML (.mxl)",
  "game.tempo": "tempo",
  "game.sound": "🔊 Sound",
  "game.setup": "⚙ Setup",
  "game.bar": "bar",
  "game.staffCard": "on the staff",
  "game.drop": "✕ Remove",
  "game.drop.title": "Remove the loaded piece",
  "game.done": "Done! ↺ to play it again",
  "game.failed": "Didn't work: {why}",
  "game.added.missing": {one: "Added, but {n} note has no fingering: {notes}",
                         other: "Added, but {n} notes have no fingering: {notes}"},
  "game.added.problems": {one: "Added, but {n} bar looks off",
                          other: "Added, but {n} bars look off"},
  "game.footer": "Space — start and pause, <b>R</b> — back to the beginning.",
  "game.sheetLink": "Every note with its chart",
  "game.untitled": "My piece",

  /* ---------- the import dialog ---------- */
  "import.which": "Which line are we playing?",
  "import.hint": "There are several parts in the file. Pick the main melody.",
  "import.name": "name",
  "import.octave": "octave",
  "import.asis": "as is",
  "import.cancel": "Cancel",
  "import.confirm": "Add",
  "import.staff": " · staff {n}",
  "import.voice": " · voice {n}",
  "import.facts": {one: "{n} note · {lo}–{hi} · {pct}% playable on {instrument}",
                   other: "{n} notes · {lo}–{hi} · {pct}% playable on {instrument}"},
  "import.best": " — looks like the main melody",
  "import.range": "Range after the shift: {lo}–{hi}.",
  "import.playableAfter": "{pct}% of the notes play on {instrument}.",
  "import.outOfRange": "Some of the notes fall outside the instrument's range — they will " +
                       "still fall down the lanes, but the chart panel stays empty for them.",
  "import.chords": {one: "This line has a chord ({n}) — only the top note is kept.",
                    other: "This line has chords ({n}) — only the top note is kept."},

  "import.err.notZip": "does not look like a zip archive (.mxl)",
  "import.err.compression": "unknown compression in the archive",
  "import.err.notXml": "the file does not read as XML",
  "import.err.notMusicXml": "this is not MusicXML",
  "import.err.noScore": "there is no score inside the archive",
  "import.err.noPart": "part not found",
  "import.err.noNotes": "there are no notes in this line",
  "import.err.empty": "no notes were found in the file"
};
