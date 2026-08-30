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
  "game.add.title": "MusicXML (.mxl) または録音を読み込む",
  "game.formats": "{list} を読み込みます",
  "game.listening": "録音を聴いています…",
  "game.reading": "ページを読み取っています…",
  "game.tempo": "テンポ",
  "game.sound": "🔊 音",
  "game.setup": "⚙ 設定",
  "game.bar": "小節",
  "game.staffCard": "五線上",
  "game.drop": "✕ 削除",
  "game.drop.title": "読み込んだ曲を削除する",
  "game.restore": "↺ 戻す",
  "game.restore.title": "取り除いた曲を戻します",
  "game.done": "おしまい！ ↺ でもう一度",
  "game.failed": "できませんでした：{why}",
  "game.added.missing": {other: "追加しました。ただし {n} 音に運指がありません：{notes}"},
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
  "import.playableAfter": "音符の {pct}% が{instrument}演奏できます。",
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
  "import.err.empty": "ファイルに音符が見つかりませんでした",

  /* ---------- importing a recording ---------- */
  "import.recording": "録音",
  "import.audio.hint": "録音から旋律を 1 本聞き取りました。テンポを確認し、違うところは追加してから直してください。",
  "import.audio.tempo": "聞き取ったテンポ：約 {bpm} 拍/分。",
  "import.audio.mixed": "この録音では複数の楽器が同時に鳴っているため、音符はおおよそのものになります。",
  "import.audio.wide": "音域が {spread} 半音あり、楽器の {span} 半音を超えています。一部がオクターブ違いで聞き取られたか、旋律ではなく低いパートを追ってしまったかのどちらかで、後者はオクターブの切り替えでは直りません。",
  "import.audio.jumpy": "隣り合う音がちょうど 1 オクターブ跳ぶことが繰り返されています。多くは聞き取りのずれ——ときには別のパートへの乗り移り——であって、音楽自体の跳躍ではありません。",
  "import.audio.below": "すべての音が楽器の音域より下に出ました。低い楽器の録音であればオクターブの切り替えで直りますが、旋律ではなく低いパートを追ってしまった場合は直りません。",
  "import.err.noAudio": "このブラウザーは音声を復号できません",
  "import.err.notAudio": "このファイルは音声として読めません",
  "import.err.noPitch": "音高の検出が読み込まれていません",
  "import.printed": "楽譜",
  "import.pdf.hint": "ページから音符を読み取りました。長さはまだ読み取れません — 追加してから確認してください。",
  "import.pdf.lengths": "長さはページから読み取っていません。すべて四分音符として取り込みました。",
  "import.pdf.accidentals": "音符の横の臨時記号は読み取っていないため、変化音はそのままの音として入ります。",
  "import.pdf.staves": "{n} 段を上から順に 1 つの譜として読み取りました。",
  "import.pdf.bass": "別の音部記号の譜（ピアノの左手）にある音符 {n} 個は除きました。",
  "import.err.pdfScan": "この PDF はスキャン画像です",
  "import.err.pdfLocked": "この PDF はパスワードで保護されています",
  "import.err.pdfNot": "このファイルは PDF ではありません",
  "import.err.pdfEmpty": "このページには描かれているものが少なすぎます",
  "import.err.pdfNoStaves": "ページに五線が見つかりません",
  "import.err.pdfInflate": "このブラウザーは圧縮された PDF を展開できません",
  "import.err.unknown": "このファイルは読み込めません",
};
