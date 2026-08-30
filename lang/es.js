/* Español — solfeo Do-Re-Mi, manos izquierda/derecha (I/D). */
window.I18N_STRINGS = window.I18N_STRINGS || {};
window.I18N_STRINGS.es = {
  "lang.pick": "Idioma",
  "theme.pick": "Tema",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",
  "theme.studio": "Estudio",

  "instrument.pick": "Instrumento",
  "instrument.flute": "Flauta",
  "instrument.piano": "Piano",

  "app.index.title": "{instrument} — dónde están las notas",
  "app.notes.plain": "partitura para {instrument}",
  "app.notes.title": "{song} — partitura para {instrument}",
  "app.game.plain": "entrenador de {instrument}",
  "app.game.title": "{song} — entrenador de {instrument}",

  "note.c": "Do",
  "note.d": "Re",
  "note.e": "Mi",
  "note.f": "Fa",
  "note.g": "Sol",
  "note.a": "La",
  "note.b": "Si",

  "octave.system": "scientific",
  "octave.short": "oct. {n}",
  "octave.long": "octava {n}",
  "octave.small.short": "peq.",
  "octave.small.long": "octava pequeña",
  "octave.great.short": "gr.",
  "octave.great.long": "octava grande",
  "octave.contra.short": "contra",
  "octave.contra.long": "contraoctava",

  "key.major": "{note} mayor",
  "key.minor": "{note} menor",

  "hand.left.short": "I",
  "hand.right.short": "D",

  "song.gamma": "Escala de {key}",

  /* ---------- la flauta ---------- */
  "flute.on": "en la flauta",
  "flute.sub": "Flauta Boehm, pie en Do, llaves cerradas",
  "flute.chartCard": "Digitación",
  "flute.legend.closed": "cerrada",
  "flute.legend.open": "abierta",
  "flute.hint": "{L}1, {L}2, {L}3 — índice, medio y anular de la mano izquierda.<br>" +
                "{R}1, {R}2, {R}3 — la mano derecha; el meñique acciona la llave de Mi bemol (Re♯).<br>" +
                "El meñique derecho descansa sobre su llave casi todo el tiempo.",
  "flute.about": "Las notas y la digitación se dibujan con código (VexFlow + SVG) — ya no hay imágenes, " +
                 "todo se recoloca según el ancho de la pantalla.<br>" +
                 "Una llave rellena está pulsada, una vacía está abierta; de arriba abajo: pulgar, " +
                 "mano izquierda, mano derecha, meñique (Mi bemol).",
  "flute.svg.lips": "labios",
  "flute.svg.left": "mano izquierda",
  "flute.svg.right": "mano derecha",
  "flute.svg.pinky": "meñique",

  /* ---------- el piano ---------- */
  "piano.on": "en el piano",
  "piano.sub": "Dos octavas desde el Do central — pulsa una tecla para ver su nota",
  "piano.chartCard": "Teclado",
  "piano.legend.press": "pulsa esta",
  "piano.legend.white": "tecla blanca",
  "piano.legend.black": "tecla negra",
  "piano.hint": "El Do de la izquierda es el Do central — la nota que queda justo debajo del " +
                "pentagrama de sol y justo encima del de fa.<br>" +
                "El esquema no lleva números de dedo a propósito: qué dedo toca una nota " +
                "lo deciden las notas que la rodean, no la nota misma.",
  "piano.about": "Las notas y los teclados se dibujan con código (VexFlow + SVG), así que todo " +
                 "se recoloca según el ancho de la pantalla.<br>" +
                 "Cada teclado pequeño es una octava con la tecla que hay que pulsar rellena; " +
                 "el número de debajo dice qué octava es.",

  "index.pick": "Elige una nota",
  "index.staff": "La nota en el pentagrama",
  "index.staff.aria": "La nota en el pentagrama",

  "notes.bars": {one: "{n} compás", other: "{n} compases"},
  "notes.zoomIn.aria": "Más grande",
  "notes.zoomOut.aria": "Más pequeño",
  "notes.denser": "Líneas más juntas",
  "notes.trainer": "Entrenador: las notas caen desde arriba",

  "game.sub": "Las notas caen desde arriba. El carril al que llegan es el que tocas ahora.",
  "game.play": "▶ Tocar",
  "game.pause": "❚❚ Pausa",
  "game.restart": "↺ Desde el principio",
  "game.piece": "pieza",
  "game.add": "＋ Desde archivo",
  "game.add.title": "Cargar MusicXML (.mxl) o una grabación",
  "game.formats": "lee {list}",
  "game.listening": "Escuchando la grabación…",
  "game.reading": "Leyendo la página…",
  "game.tempo": "tempo",
  "game.sound": "🔊 Sonido",
  "game.setup": "⚙ Ajustes",
  "game.bar": "compás",
  "game.staffCard": "en el pentagrama",
  "game.drop": "✕ Quitar",
  "game.drop.title": "Quitar la pieza cargada",
  "game.restore": "↺ Restaurar",
  "game.restore.title": "Devolver las piezas quitadas",
  "game.done": "¡Listo! ↺ para repetir",
  "game.failed": "No salió: {why}",
  "game.added.missing": {one: "Añadida, pero {n} nota no tiene digitación: {notes}",
                         other: "Añadida, pero {n} notas no tienen digitación: {notes}"},
  "game.added.problems": {one: "Añadida, pero {n} compás es dudoso",
                          other: "Añadida, pero {n} compases son dudosos"},
  "game.footer": "Espacio — empezar y pausar, <b>R</b> — desde el principio.",
  "game.sheetLink": "Todas las notas con su esquema",
  "game.untitled": "Mi pieza",

  "import.which": "¿Qué línea tocamos?",
  "import.hint": "El archivo tiene varias partes. Elige la melodía principal.",
  "import.name": "nombre",
  "import.octave": "octava",
  "import.asis": "tal cual",
  "import.cancel": "Cancelar",
  "import.confirm": "Añadir",
  "import.staff": " · pentagrama {n}",
  "import.voice": " · voz {n}",
  "import.facts": {one: "{n} nota · {lo}–{hi} · {pct}% se toca {instrument}",
                   other: "{n} notas · {lo}–{hi} · {pct}% se toca {instrument}"},
  "import.best": " — parece la melodía principal",
  "import.range": "Registro tras el desplazamiento: {lo}–{hi}.",
  "import.playableAfter": "El {pct}% de las notas se puede tocar {instrument}.",
  "import.outOfRange": "Algunas notas quedan fuera del registro del instrumento — seguirán cayendo, " +
                       "pero el recuadro del esquema quedará vacío para ellas.",
  "import.chords": {one: "Esta línea tiene un acorde ({n}) — se queda la nota superior.",
                    other: "Esta línea tiene acordes ({n}) — se queda la nota superior."},

  "import.err.notZip": "no parece un archivo zip (.mxl)",
  "import.err.compression": "compresión desconocida en el archivo",
  "import.err.notXml": "el archivo no se lee como XML",
  "import.err.notMusicXml": "esto no es MusicXML",
  "import.err.noScore": "dentro del archivo no hay partitura",
  "import.err.noPart": "no se encontró la parte",
  "import.err.noNotes": "esta línea no tiene notas",
  "import.err.empty": "no se encontraron notas en el archivo",

  /* ---------- importing a recording ---------- */
  "import.recording": "Grabación",
  "import.audio.hint": "Se oyó una línea en la grabación. Comprueba el tempo y corrige lo que haya salido mal después de añadirla.",
  "import.audio.tempo": "Tempo oído: unos {bpm} pulsos por minuto.",
  "import.audio.mixed": "En esta grabación suena más de un instrumento, así que las notas solo serán aproximadas.",
  "import.audio.wide": "Las notas abarcan {spread} semitonos y el instrumento solo {span}. O algunas se oyeron una octava desviadas, o se siguió una voz más grave en lugar de la melodía, y eso el control de octava no lo arregla.",
  "import.audio.jumpy": "Las notas vecinas saltan una octava exacta una y otra vez. Suele ser un fallo de escucha —a veces un salto a otra voz— y no un salto de la música.",
  "import.audio.below": "Todas las notas salieron por debajo del registro del instrumento. O la grabación es de un instrumento más grave —entonces sirve cambiar la octava— o se siguió una voz más grave en lugar de la melodía, y eso no se arregla así.",
  "import.err.noAudio": "este navegador no puede descodificar audio",
  "import.err.notAudio": "este archivo no se lee como audio",
  "import.err.noPitch": "el detector de tono no está cargado",
  "import.printed": "Partitura",
  "import.pdf.hint": "Las notas se leyeron de la página. Las duraciones aún no se leen: revísalas después de añadir.",
  "import.pdf.lengths": "Las duraciones no se leen de la página: cada nota entra como negra.",
  "import.pdf.timed": "Las duraciones se leyeron de las plicas, los corchetes y las barras. Una blanca no se distingue de una negra, y un compás corto se completó con un silencio: el ritmo es aproximado, no exacto.",
  "import.pdf.accidentals": "Las alteraciones junto a una nota no se leen: una nota alterada llega como la natural.",
  "import.pdf.altered": "Se leyeron las alteraciones ({n}). Una alteración todavía no rige hasta el final del compás, así que una nota alterada repetida llega sin ella.",
  "import.pdf.staves": "{n} pentagramas se leyeron como una sola línea, de arriba abajo.",
  "import.pdf.bass": "{n} nota(s) en pentagramas con otra clave — la mano izquierda de un piano — se dejaron fuera.",
  "import.err.pdfScan": "este PDF es un escaneo, no una partitura grabada",
  "import.err.pdfLocked": "este PDF está protegido con contraseña",
  "import.err.pdfNot": "este archivo no es un PDF",
  "import.err.pdfEmpty": "hay muy poco dibujado en esta página",
  "import.err.pdfNoStaves": "no se encontraron pentagramas en la página",
  "import.err.pdfInflate": "este navegador no puede descomprimir un PDF comprimido",
  "import.err.unknown": "la aplicación no sabe leer este archivo",
};
