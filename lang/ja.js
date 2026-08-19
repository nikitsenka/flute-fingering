/* 日本語 — 音名はカタカナの階名（ド・レ・ミ）。日本語に複数形はないので other だけ。 */
window.I18N_STRINGS = window.I18N_STRINGS || {};
window.I18N_STRINGS.ja = {
  "lang.pick": "言語",
  "theme.pick": "テーマ",
  "theme.light": "ライト",
  "theme.dark": "ダーク",
  "theme.studio": "スタジオ",

  "instrument.pick": "楽器",
  "instrument.flute": "フルート",
  "instrument.piano": "ピアノ",

  "app.index.title": "{instrument} — 音の位置",
  "app.notes.plain": "{instrument}の楽譜",
  "app.notes.title": "{song} — {instrument}の楽譜",
  "app.game.plain": "{instrument}練習",
  "app.game.title": "{song} — {instrument}練習",

  "note.c": "ド",
  "note.d": "レ",
  "note.e": "ミ",
  "note.f": "ファ",
  "note.g": "ソ",
  "note.a": "ラ",
  "note.b": "シ",

  "octave.system": "scientific",
  "octave.short": "第{n}オクターブ",
  "octave.long": "第{n}オクターブ",
  "octave.small.short": "小",
  "octave.small.long": "小オクターブ",
  "octave.great.short": "大",
  "octave.great.long": "大オクターブ",
  "octave.contra.short": "コントラ",
  "octave.contra.long": "コントラオクターブ",

  "key.major": "{note}長調",
  "key.minor": "{note}短調",

  "hand.left.short": "左",
  "hand.right.short": "右",

  "song.gamma": "{key}の音階",

  /* ---------- フルート ---------- */
  "flute.on": "フルートで",
  "flute.sub": "ベーム式フルート、C 足部管、閉じたキー",
  "flute.chartCard": "運指",
  "flute.legend.closed": "押さえる",
  "flute.legend.open": "開ける",
  "flute.hint": "{L}1、{L}2、{L}3 — 左手の人差し指・中指・薬指。<br>" +
                "{R}1、{R}2、{R}3 — 右手。小指は ミ♭ キー（レ♯）を押さえます。<br>" +
                "右手の小指はほとんどの場合そのキーに置いたままです。",
  "flute.about": "音符も運指もコードで描いています（VexFlow + SVG）。画像はもうありません。" +
                 "画面の幅に合わせて組み直されます。<br>" +
                 "塗られたキーは押さえる、白いキーは開ける。上から順に、親指、" +
                 "左手、右手、小指（ミ♭）です。",
  "flute.svg.lips": "唇",
  "flute.svg.left": "左手",
  "flute.svg.right": "右手",
  "flute.svg.pinky": "小指",

  /* ---------- ピアノ ---------- */
  "piano.on": "ピアノで",
  "piano.sub": "中央ドから 2 オクターブ。鍵盤をクリックすると音名が出ます",
  "piano.chartCard": "鍵盤",
  "piano.legend.press": "ここを押す",
  "piano.legend.white": "白鍵",
  "piano.legend.black": "黒鍵",
  "piano.hint": "いちばん左のドが中央のド — ト音記号の五線のすぐ下、" +
                "ヘ音記号の五線のすぐ上にある音です。<br>" +
                "運指番号をあえて出していません。どの指で弾くかは、その音自体ではなく" +
                "前後の音で決まるからです。",
  "piano.about": "音符も鍵盤もコードで描いています（VexFlow + SVG）。" +
                 "画面の幅に合わせて組み直されます。<br>" +
                 "小さな鍵盤はそれぞれ 1 オクターブで、押す鍵が塗られています。" +
                 "下の数字がどのオクターブかを示します。",

  "index.pick": "音を選んでください",
  "index.staff": "五線上の音符",
  "index.staff.aria": "五線上の音符",

  "notes.bars": {other: "{n} 小節"},
  "notes.zoomIn.aria": "大きく",
  "notes.zoomOut.aria": "小さく",
  "notes.denser": "行を詰める",
  "notes.trainer": "練習：音符が上から落ちてきます",

  "game.sub": "音符が上から落ちてきます。線まで届いたレーンを今すぐ演奏しましょう。",
  "game.play": "▶ 再生",
  "game.pause": "❚❚ 一時停止",
  "game.restart": "↺ 最初から",
  "game.piece": "曲",
  "game.add": "＋ ファイルから",
  "game.add.title": "MusicXML (.mxl) を読み込む",
  "game.tempo": "テンポ",
  "game.sound": "🔊 音",
  "game.bar": "小節",
  "game.staffCard": "五線上",
  "game.drop": "✕ 削除",
  "game.drop.title": "読み込んだ曲を削除する",
  "game.done": "おしまい！ ↺ でもう一度",
  "game.failed": "できませんでした：{why}",
  "game.added.problems": {other: "追加しました。ただし {n} 小節があやしいです"},
  "game.footer": "スペース — 開始と一時停止、<b>R</b> — 最初から。",
  "game.sheetLink": "図つきの全音符",
  "game.untitled": "自分の曲",

  "import.which": "どの段を演奏しますか？",
  "import.hint": "ファイルに複数のパートがあります。主旋律を選んでください。",
  "import.name": "曲名",
  "import.octave": "オクターブ",
  "import.asis": "そのまま",
  "import.cancel": "キャンセル",
  "import.confirm": "追加",
  "import.staff": " · 譜表 {n}",
  "import.voice": " · 声部 {n}",
  "import.facts": {other: "{n} 音 · {lo}–{hi} · {instrument}演奏できるのは {pct}%"},
  "import.best": " — 主旋律のようです",
  "import.range": "移調後の音域：{lo}–{hi}。",
  "import.outOfRange": "楽器の音域から外れる音符があります。落ちてはきますが、" +
                       "その音では図の窓が空のままになります。",
  "import.chords": {other: "この段には和音（{n}）があります。いちばん上の音だけが残ります。"},

  "import.err.notZip": "zip アーカイブ (.mxl) ではないようです",
  "import.err.compression": "アーカイブの圧縮形式が不明です",
  "import.err.notXml": "ファイルを XML として読めません",
  "import.err.notMusicXml": "これは MusicXML ではありません",
  "import.err.noScore": "アーカイブの中に楽譜がありません",
  "import.err.noPart": "パートが見つかりません",
  "import.err.noNotes": "この段には音符がありません",
  "import.err.empty": "ファイルに音符が見つかりませんでした"
};
