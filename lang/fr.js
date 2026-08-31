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
  "game.add.title": "Charger un MusicXML (.mxl) ou un enregistrement",
  "game.formats": "lit {list}",
  "game.listening": "Écoute de l'enregistrement…",
  "game.reading": "Lecture de la page…",
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
  "import.err.empty": "aucune note trouvée dans le fichier",

  /* ---------- importing a recording ---------- */
  "import.recording": "Enregistrement",
  "import.audio.hint": "Une ligne a été entendue dans l'enregistrement. Vérifie le tempo et corrige ce qui est faux après l'ajout.",
  "import.audio.tempo": "Tempo entendu : environ {bpm} pulsations par minute.",
  "import.audio.mixed": "Plusieurs instruments jouent dans cet enregistrement : les notes ne seront qu'approximatives.",
  "import.audio.wide": "Les notes couvrent {spread} demi-tons, l'instrument {span}. Soit certaines ont été entendues à une octave près, soit c'est une voix plus grave qui a été suivie au lieu de la mélodie — et le réglage d'octave n'y peut rien.",
  "import.audio.jumpy": "Des notes voisines sautent sans cesse d'une octave exacte. C'est le plus souvent une erreur d'écoute — parfois un glissement vers une autre voix — et non un saut de la musique.",
  "import.audio.below": "Toutes les notes sont sorties sous l'ambitus de l'instrument. Soit l'enregistrement est celui d'un instrument plus grave — l'octave y remédie — soit une voix plus grave a été suivie au lieu de la mélodie, et là non.",
  "import.err.noAudio": "ce navigateur ne sait pas décoder l'audio",
  "import.err.notAudio": "ce fichier ne se lit pas comme de l'audio",
  "import.err.noPitch": "le détecteur de hauteur n'est pas chargé",
  "import.printed": "Partition",
  "import.pdf.hint": "Les notes ont été lues sur la page. Les durées ne sont pas encore lues — vérifiez-les après l'ajout.",
  "import.pdf.lengths": "Les durées ne sont pas lues sur la page : chaque note arrive en noire.",
  "import.pdf.timed": "Les durées ont été lues sur les hampes, les crochets et les ligatures. Une blanche n'est pas distinguée d'une noire, et une mesure trop courte a été complétée par un silence : le rythme est proche, pas exact.",
  "import.pdf.accidentals": "Les altérations à côté d'une note ne sont pas lues : une note altérée arrive telle quelle.",
  "import.pdf.altered": "Les altérations ont été lues ({n}). Une altération ne vaut pas encore jusqu'à la fin de la mesure : une note altérée répétée arrive sans elle.",
  "import.pdf.staves": "{n} portées ont été lues comme une seule ligne, de haut en bas.",
  "import.pdf.bass": "{n} note(s) sur des portées dans une autre clé — la main gauche d'une partie de piano — ont été laissées de côté.",
  "import.pdf.scanned": "Lu sur une image de la page : environ une note sur dix peut manquer, et le rythme n'a pas été lu du tout. Vérifiez sur le papier avant de travailler ce morceau.",
  "import.err.pdfScan": "ce PDF est un scan, pas une gravure",
  "import.err.pdfLocked": "ce PDF est protégé par un mot de passe",
  "import.err.pdfNot": "ce fichier n'est pas un PDF",
  "import.err.pdfEmpty": "il y a trop peu de choses dessinées sur cette page",
  "import.err.pdfNoStaves": "aucune portée n'a été trouvée sur la page",
  "import.err.pdfInflate": "ce navigateur ne sait pas décompresser un PDF compressé",
  "import.err.unknown": "l'application ne sait pas lire ce fichier",
};
