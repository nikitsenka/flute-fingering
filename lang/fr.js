/* Français — solfège Do-Ré-Mi, mains gauche/droite (G/D). */
window.I18N_STRINGS = window.I18N_STRINGS || {};
window.I18N_STRINGS.fr = {
  "lang.pick": "Langue",
  "theme.pick": "Thème",
  "theme.light": "Clair",
  "theme.dark": "Sombre",
  "theme.studio": "Studio",

  "instrument.pick": "Instrument",
  "instrument.flute": "Flûte",
  "instrument.piano": "Piano",

  "app.index.title": "{instrument} — où sont les notes",
  "app.notes.plain": "partition · {instrument}",
  "app.notes.title": "{song} — partition · {instrument}",
  "app.game.plain": "entraîneur · {instrument}",
  "app.game.title": "{song} — entraîneur · {instrument}",

  "note.c": "Do",
  "note.d": "Ré",
  "note.e": "Mi",
  "note.f": "Fa",
  "note.g": "Sol",
  "note.a": "La",
  "note.b": "Si",

  "octave.system": "scientific",
  "octave.short": "oct. {n}",
  "octave.long": "octave {n}",
  "octave.small.short": "pet.",
  "octave.small.long": "petite octave",
  "octave.great.short": "gr.",
  "octave.great.long": "grande octave",
  "octave.contra.short": "contre",
  "octave.contra.long": "contre-octave",

  "key.major": "{note} majeur",
  "key.minor": "{note} mineur",

  "hand.left.short": "G",
  "hand.right.short": "D",

  "song.gamma": "Gamme de {key}",

  /* ---------- la flûte ---------- */
  "flute.on": "à la flûte",
  "flute.sub": "Flûte Boehm, patte d'ut, clés fermées",
  "flute.chartCard": "Doigtés",
  "flute.legend.closed": "fermée",
  "flute.legend.open": "ouverte",
  "flute.hint": "{L}1, {L}2, {L}3 — index, majeur et annulaire de la main gauche.<br>" +
                "{R}1, {R}2, {R}3 — la main droite ; l'auriculaire tient la clé de Mi bémol (Ré♯).<br>" +
                "L'auriculaire droit reste posé sur sa clé presque tout le temps.",
  "flute.about": "Les notes et les doigtés sont dessinés par le code (VexFlow + SVG) — plus d'images, " +
                 "tout se réagence selon la largeur de l'écran.<br>" +
                 "Une clé pleine est bouchée, une clé vide est ouverte ; de haut en bas : pouce, " +
                 "main gauche, main droite, auriculaire (Mi bémol).",
  "flute.svg.lips": "lèvres",
  "flute.svg.left": "main gauche",
  "flute.svg.right": "main droite",
  "flute.svg.pinky": "auriculaire",

  /* ---------- le piano ---------- */
  "piano.on": "au piano",
  "piano.sub": "Deux octaves à partir du do médian — clique une touche pour voir sa note",
  "piano.chartCard": "Clavier",
  "piano.legend.press": "appuie ici",
  "piano.legend.white": "touche blanche",
  "piano.legend.black": "touche noire",
  "piano.hint": "Le do de gauche est le do médian — la note qui se place juste sous la portée " +
                "de sol et juste au-dessus de celle de fa.<br>" +
                "Le schéma ne porte pas de numéros de doigts, et c'est volontaire : quel doigt " +
                "joue une note, ce sont les notes voisines qui le décident, pas la note elle-même.",
  "piano.about": "Les notes et les claviers sont dessinés par le code (VexFlow + SVG), tout se " +
                 "réagence donc selon la largeur de l'écran.<br>" +
                 "Chaque petit clavier est une octave avec la touche à enfoncer remplie ; " +
                 "le chiffre en dessous dit de quelle octave il s'agit.",

  "index.pick": "Choisis une note",
  "index.staff": "La note sur la portée",
  "index.staff.aria": "La note sur la portée",

  "notes.bars": {one: "{n} mesure", other: "{n} mesures"},
  "notes.zoomIn.aria": "Plus grand",
  "notes.zoomOut.aria": "Plus petit",
  "notes.denser": "Lignes plus serrées",
  "notes.trainer": "Entraîneur : les notes tombent d'en haut",

  "game.sub": "Les notes tombent d'en haut. La piste qu'elles atteignent, c'est celle que tu joues.",
  "game.play": "▶ Jouer",
  "game.pause": "❚❚ Pause",
  "game.restart": "↺ Au début",
  "game.piece": "morceau",
  "game.add": "＋ Depuis un fichier",
  "game.add.title": "Charger un MusicXML (.mxl)",
  "game.tempo": "tempo",
  "game.sound": "🔊 Son",
  "game.setup": "⚙ Réglages",
  "game.bar": "mesure",
  "game.staffCard": "sur la portée",
  "game.drop": "✕ Retirer",
  "game.drop.title": "Retirer le morceau chargé",
  "game.restore": "↺ Restaurer",
  "game.restore.title": "Remettre les morceaux retirés",
  "game.done": "Terminé ! ↺ pour recommencer",
  "game.failed": "Ça n'a pas marché : {why}",
  "game.added.missing": {one: "Ajouté, mais {n} note n'a pas de doigté : {notes}",
                         other: "Ajouté, mais {n} notes n'ont pas de doigtés : {notes}"},
  "game.added.problems": {one: "Ajouté, mais {n} mesure est douteuse",
                          other: "Ajouté, mais {n} mesures sont douteuses"},
  "game.footer": "Espace — départ et pause, <b>R</b> — au début.",
  "game.sheetLink": "Toutes les notes avec leur schéma",
  "game.untitled": "Mon morceau",

  "import.which": "Quelle ligne joue-t-on ?",
  "import.hint": "Le fichier contient plusieurs parties. Choisis la mélodie principale.",
  "import.name": "nom",
  "import.octave": "octave",
  "import.asis": "tel quel",
  "import.cancel": "Annuler",
  "import.confirm": "Ajouter",
  "import.staff": " · portée {n}",
  "import.voice": " · voix {n}",
  "import.facts": {one: "{n} note · {lo}–{hi} · {pct}% jouable {instrument}",
                   other: "{n} notes · {lo}–{hi} · {pct}% jouable {instrument}"},
  "import.best": " — ressemble à la mélodie principale",
  "import.range": "Étendue après le décalage : {lo}–{hi}.",
  "import.playableAfter": "{pct}% des notes se jouent {instrument}.",
  "import.outOfRange": "Une partie des notes sort de l'étendue de l'instrument — elles tomberont " +
                       "quand même, mais la fenêtre du schéma restera vide pour elles.",
  "import.chords": {one: "Cette ligne contient un accord ({n}) — seule la note du haut est gardée.",
                    other: "Cette ligne contient des accords ({n}) — seule la note du haut est gardée."},

  "import.err.notZip": "ne ressemble pas à une archive zip (.mxl)",
  "import.err.compression": "compression inconnue dans l'archive",
  "import.err.notXml": "le fichier ne se lit pas comme du XML",
  "import.err.notMusicXml": "ce n'est pas du MusicXML",
  "import.err.noScore": "il n'y a pas de partition dans l'archive",
  "import.err.noPart": "partie introuvable",
  "import.err.noNotes": "il n'y a pas de notes dans cette ligne",
  "import.err.empty": "aucune note trouvée dans le fichier"
};
