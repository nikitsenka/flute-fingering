/* Deutsch. Note note.b: German writes H for B natural. */
window.I18N_STRINGS = window.I18N_STRINGS || {};
window.I18N_STRINGS.de = {
  "lang.pick": "Sprache",
  "theme.pick": "Design",
  "theme.light": "Hell",
  "theme.dark": "Dunkel",
  "theme.studio": "Studio",

  "instrument.pick": "Instrument",
  "instrument.flute": "Flöte",
  "instrument.piano": "Klavier",

  "app.index.title": "{instrument} — wo die Töne liegen",
  "app.notes.plain": "Noten für {instrument}",
  "app.notes.title": "{song} — Noten für {instrument}",
  "app.game.plain": "Trainer · {instrument}",
  "app.game.title": "{song} — Trainer · {instrument}",

  "note.c": "C",
  "note.d": "D",
  "note.e": "E",
  "note.f": "F",
  "note.g": "G",
  "note.a": "A",
  "note.b": "H",

  "octave.system": "scientific",
  "octave.short": "Okt. {n}",
  "octave.long": "Oktave {n}",
  "octave.small.short": "kl.",
  "octave.small.long": "kleine Oktave",
  "octave.great.short": "gr.",
  "octave.great.long": "große Oktave",
  "octave.contra.short": "Kontra",
  "octave.contra.long": "Kontraoktave",

  "key.major": "{note}-Dur",
  "key.minor": "{note}-Moll",

  "hand.left.short": "L",
  "hand.right.short": "R",

  "song.gamma": "{key}-Tonleiter",

  /* ---------- Flöte ---------- */
  "flute.on": "auf der Flöte",
  "flute.sub": "Böhmflöte, C-Fuß, geschlossene Klappen",
  "flute.chartCard": "Griffe",
  "flute.legend.closed": "geschlossen",
  "flute.legend.open": "offen",
  "flute.hint": "{L}1, {L}2, {L}3 — Zeige-, Mittel- und Ringfinger der linken Hand.<br>" +
                "{R}1, {R}2, {R}3 — die rechte Hand; der kleine Finger bedient die Es-Klappe (Dis).<br>" +
                "Der kleine Finger rechts liegt fast immer auf seiner Klappe.",
  "flute.about": "Noten und Griffe sind mit Code gezeichnet (VexFlow + SVG) — keine Bilder mehr, " +
                 "alles richtet sich nach der Bildschirmbreite.<br>" +
                 "Eine gefüllte Klappe ist gedrückt, eine leere offen; von oben nach unten: Daumen, " +
                 "linke Hand, rechte Hand, kleiner Finger (Es).",
  "flute.svg.lips": "Lippen",
  "flute.svg.left": "linke Hand",
  "flute.svg.right": "rechte Hand",
  "flute.svg.pinky": "kleiner Finger",

  /* ---------- Klavier ---------- */
  "piano.on": "auf dem Klavier",
  "piano.sub": "Zwei Oktaven ab dem eingestrichenen C — klick eine Taste an",
  "piano.chartCard": "Tastatur",
  "piano.legend.press": "diese drücken",
  "piano.legend.white": "weiße Taste",
  "piano.legend.black": "schwarze Taste",
  "piano.hint": "Das linke C hier ist das eingestrichene C — der Ton direkt unter dem " +
                "Violinsystem und direkt über dem Basssystem.<br>" +
                "Fingersätze stehen absichtlich nicht dabei: welcher Finger einen Ton " +
                "spielt, entscheiden die Töne daneben, nicht der Ton selbst.",
  "piano.about": "Noten und Tastaturen sind mit Code gezeichnet (VexFlow + SVG), alles " +
                 "richtet sich also nach der Bildschirmbreite.<br>" +
                 "Jede kleine Tastatur ist eine Oktave mit der zu drückenden Taste gefüllt; " +
                 "die Zahl darunter sagt, welche Oktave es ist.",

  "index.pick": "Wähle eine Note",
  "index.staff": "Die Note im Notensystem",
  "index.staff.aria": "Die Note im Notensystem",

  "notes.bars": {one: "{n} Takt", other: "{n} Takte"},
  "notes.zoomIn.aria": "Größer",
  "notes.zoomOut.aria": "Kleiner",
  "notes.denser": "Engere Zeilen",
  "notes.trainer": "Trainer: die Noten fallen von oben",

  "game.sub": "Die Noten fallen von oben. Die Spur, auf der sie ankommen — die spielst du jetzt.",
  "game.play": "▶ Spielen",
  "game.pause": "❚❚ Pause",
  "game.restart": "↺ Von vorn",
  "game.piece": "Stück",
  "game.add": "＋ Aus Datei",
  "game.add.title": "MusicXML (.mxl) oder eine Aufnahme laden",
  "game.formats": "liest {list}",
  "game.listening": "Die Aufnahme wird abgehört…",
  "game.reading": "Die Seite wird gelesen…",
  "game.tempo": "Tempo",
  "game.sound": "🔊 Ton",
  "game.setup": "⚙ Einstellungen",
  "game.bar": "Takt",
  "game.staffCard": "im Notensystem",
  "game.drop": "✕ Entfernen",
  "game.drop.title": "Das geladene Stück entfernen",
  "game.restore": "↺ Zurückholen",
  "game.restore.title": "Entfernte Stücke zurückholen",
  "game.done": "Fertig! ↺ für noch einmal",
  "game.failed": "Hat nicht geklappt: {why}",
  "game.added.missing": {one: "Hinzugefügt, aber für {n} Note gibt es keine Griffe: {notes}",
                         other: "Hinzugefügt, aber für {n} Noten gibt es keine Griffe: {notes}"},
  "game.added.problems": {one: "Hinzugefügt, aber {n} Takt ist fraglich",
                          other: "Hinzugefügt, aber {n} Takte sind fraglich"},
  "game.footer": "Leertaste — Start und Pause, <b>R</b> — von vorn.",
  "game.sheetLink": "Alle Noten mit Schema",
  "game.untitled": "Mein Stück",

  "import.which": "Welche Stimme spielen wir?",
  "import.hint": "Die Datei enthält mehrere Stimmen. Wähle die Hauptmelodie.",
  "import.name": "Name",
  "import.octave": "Oktave",
  "import.asis": "unverändert",
  "import.cancel": "Abbrechen",
  "import.confirm": "Hinzufügen",
  "import.staff": " · System {n}",
  "import.voice": " · Stimme {n}",
  "import.facts": {one: "{n} Note · {lo}–{hi} · {pct}% {instrument} spielbar",
                   other: "{n} Noten · {lo}–{hi} · {pct}% {instrument} spielbar"},
  "import.best": " — sieht nach der Hauptmelodie aus",
  "import.range": "Umfang nach der Verschiebung: {lo}–{hi}.",
  "import.playableAfter": "{pct}% der Noten lassen sich {instrument} spielen.",
  "import.outOfRange": "Ein Teil der Noten liegt außerhalb des Tonumfangs — sie fallen trotzdem, " +
                       "aber das Schemafenster bleibt bei ihnen leer.",
  "import.chords": {one: "In dieser Stimme steht ein Akkord ({n}) — nur die oberste Note bleibt.",
                    other: "In dieser Stimme stehen Akkorde ({n}) — nur die oberste Note bleibt."},

  "import.err.notZip": "sieht nicht nach einem Zip-Archiv (.mxl) aus",
  "import.err.compression": "unbekannte Komprimierung im Archiv",
  "import.err.notXml": "die Datei lässt sich nicht als XML lesen",
  "import.err.notMusicXml": "das ist kein MusicXML",
  "import.err.noScore": "im Archiv ist keine Partitur",
  "import.err.noPart": "Stimme nicht gefunden",
  "import.err.noNotes": "in dieser Stimme stehen keine Noten",
  "import.err.empty": "in der Datei wurden keine Noten gefunden",

  /* ---------- importing a recording ---------- */
  "import.recording": "Aufnahme",
  "import.audio.hint": "In der Aufnahme wurde eine Stimme gehört. Prüfe das Tempo und korrigiere nach dem Hinzufügen, was falsch herauskam.",
  "import.audio.tempo": "Gehörtes Tempo: etwa {bpm} Schläge pro Minute.",
  "import.audio.mixed": "In dieser Aufnahme spielt mehr als ein Instrument, die Noten stimmen also nur ungefähr.",
  "import.audio.wide": "Die Noten umspannen {spread} Halbtöne, das Instrument nur {span}. Entweder wurden einige eine Oktave daneben gehört, oder es wurde eine tiefere Stimme statt der Melodie verfolgt — dagegen hilft der Oktavregler nicht.",
  "import.audio.jumpy": "Benachbarte Noten springen immer wieder genau eine Oktave. Das ist meist ein Hörfehler — mitunter ein Abrutschen auf eine andere Stimme — und kein Sprung in der Musik.",
  "import.audio.below": "Alle Noten liegen unter dem Umfang des Instruments. Entweder ist die Aufnahme von einem tieferen Instrument — dann hilft die Oktave — oder es wurde eine tiefere Stimme statt der Melodie verfolgt, und dagegen hilft sie nicht.",
  "import.err.noAudio": "dieser Browser kann kein Audio dekodieren",
  "import.err.notAudio": "die Datei lässt sich nicht als Audio lesen",
  "import.err.noPitch": "die Tonerkennung ist nicht geladen",
  "import.printed": "Noten",
  "import.pdf.hint": "Die Noten wurden von der Seite gelesen. Notenlängen werden noch nicht gelesen — prüfen Sie sie nach dem Hinzufügen.",
  "import.pdf.lengths": "Notenlängen werden nicht von der Seite gelesen: jede Note kommt als Viertel an.",
  "import.pdf.accidentals": "Vorzeichen neben einer Note werden nicht gelesen; eine alterierte Note kommt als die einfache an.",
  "import.pdf.altered": "Vorzeichen wurden gelesen ({n}). Ein Vorzeichen gilt noch nicht bis zum Taktende, eine Wiederholung der alterierten Note kommt daher ohne an.",
  "import.pdf.staves": "{n} Systeme wurden von oben nach unten als eine Linie gelesen.",
  "import.pdf.bass": "{n} Note(n) auf Systemen in einem anderen Schlüssel — der linken Hand eines Klavierparts — wurden ausgelassen.",
  "import.err.pdfScan": "dieses PDF ist ein Scan, kein Notensatz",
  "import.err.pdfLocked": "dieses PDF ist passwortgeschützt",
  "import.err.pdfNot": "diese Datei ist kein PDF",
  "import.err.pdfEmpty": "auf dieser Seite ist zu wenig gezeichnet",
  "import.err.pdfNoStaves": "auf der Seite wurden keine Notenlinien gefunden",
  "import.err.pdfInflate": "dieser Browser kann ein komprimiertes PDF nicht entpacken",
  "import.err.unknown": "diese Datei kann die App nicht lesen",
};
