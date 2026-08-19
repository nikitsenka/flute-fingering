/* 简体中文 — 音名用字母 C-D-E（固定唱名，与简谱的可动 1-7 不同）。
   中文没有复数变化，所以只有 other。 */
window.I18N_STRINGS = window.I18N_STRINGS || {};
window.I18N_STRINGS.zh = {
  "lang.pick": "语言",
  "theme.pick": "主题",
  "theme.light": "浅色",
  "theme.dark": "深色",
  "theme.studio": "工作室",

  "instrument.pick": "乐器",
  "instrument.flute": "长笛",
  "instrument.piano": "钢琴",

  "app.index.title": "{instrument} — 音的位置",
  "app.notes.plain": "{instrument}乐谱",
  "app.notes.title": "{song} — {instrument}乐谱",
  "app.game.plain": "{instrument}练习",
  "app.game.title": "{song} — {instrument}练习",

  "note.c": "C",
  "note.d": "D",
  "note.e": "E",
  "note.f": "F",
  "note.g": "G",
  "note.a": "A",
  "note.b": "B",

  "octave.system": "scientific",
  "octave.short": "第{n}八度",
  "octave.long": "第{n}八度",
  "octave.small.short": "小",
  "octave.small.long": "小字组",
  "octave.great.short": "大",
  "octave.great.long": "大字组",
  "octave.contra.short": "倍低",
  "octave.contra.long": "倍低音组",

  "key.major": "{note}大调",
  "key.minor": "{note}小调",

  "hand.left.short": "左",
  "hand.right.short": "右",

  "song.gamma": "{key}音阶",

  /* ---------- 长笛 ---------- */
  "flute.on": "用长笛",
  "flute.sub": "波姆长笛，C 尾管，闭孔键",
  "flute.chartCard": "指法",
  "flute.legend.closed": "按下",
  "flute.legend.open": "松开",
  "flute.hint": "{L}1、{L}2、{L}3 — 左手的食指、中指、无名指。<br>" +
                "{R}1、{R}2、{R}3 — 右手；小指负责 E♭ 键（D♯）。<br>" +
                "右手小指几乎始终搭在自己的键上。",
  "flute.about": "音符和指法都由代码绘制（VexFlow + SVG），不再使用图片，" +
                 "一切都会随屏幕宽度重新排布。<br>" +
                 "实心键表示按下，空心键表示松开；从上到下依次是：拇指、" +
                 "左手、右手、小指（E♭）。",
  "flute.svg.lips": "嘴唇",
  "flute.svg.left": "左手",
  "flute.svg.right": "右手",
  "flute.svg.pinky": "小指",

  /* ---------- 钢琴 ---------- */
  "piano.on": "用钢琴",
  "piano.sub": "从中央 C 起两个八度 — 点击琴键即可看到音名",
  "piano.chartCard": "键盘",
  "piano.legend.press": "按这一个",
  "piano.legend.white": "白键",
  "piano.legend.black": "黑键",
  "piano.hint": "最左边的 C 就是中央 C — 它正好落在高音谱表的下方、低音谱表的上方。<br>" +
                "图里特意不标指法号：用哪个手指弹，取决于前后的音，而不是这个音本身。",
  "piano.about": "音符和键盘都由代码绘制（VexFlow + SVG），一切都会随屏幕宽度重新排布。<br>" +
                 "每个小键盘是一个八度，要按的键已填充；下方的数字表示这是第几个八度。",

  "index.pick": "选择一个音",
  "index.staff": "五线谱上的音符",
  "index.staff.aria": "五线谱上的音符",

  "notes.bars": {other: "{n} 小节"},
  "notes.zoomIn.aria": "放大",
  "notes.zoomOut.aria": "缩小",
  "notes.denser": "行距更紧",
  "notes.trainer": "练习：音符从上方落下",

  "game.sub": "音符从上方落下。它们落到哪条轨道，就演奏哪个音。",
  "game.play": "▶ 播放",
  "game.pause": "❚❚ 暂停",
  "game.restart": "↺ 从头开始",
  "game.piece": "曲目",
  "game.add": "＋ 从文件",
  "game.add.title": "载入 MusicXML (.mxl)",
  "game.tempo": "速度",
  "game.sound": "🔊 声音",
  "game.bar": "小节",
  "game.staffCard": "五线谱",
  "game.drop": "✕ 移除",
  "game.drop.title": "移除已载入的曲目",
  "game.done": "完成！↺ 再来一次",
  "game.failed": "没有成功：{why}",
  "game.added.problems": {other: "已添加，但有 {n} 个小节存疑"},
  "game.footer": "空格键 — 开始和暂停，<b>R</b> — 从头开始。",
  "game.sheetLink": "全部音符及其图示",
  "game.untitled": "我的曲子",

  "import.which": "演奏哪一行？",
  "import.hint": "文件里有多个声部，请选择主旋律。",
  "import.name": "名称",
  "import.octave": "八度",
  "import.asis": "保持原样",
  "import.cancel": "取消",
  "import.confirm": "添加",
  "import.staff": " · 谱表 {n}",
  "import.voice": " · 声部 {n}",
  "import.facts": {other: "{n} 个音 · {lo}–{hi} · {pct}% 可{instrument}演奏"},
  "import.best": " — 看起来是主旋律",
  "import.range": "移调后的音域：{lo}–{hi}。",
  "import.outOfRange": "有些音超出了乐器的音域 — 它们照样会落下，" +
                       "但图示窗口对这些音会是空的。",
  "import.chords": {other: "这一行里有和弦（{n}），只保留最高的那个音。"},

  "import.err.notZip": "看起来不是 zip 压缩包 (.mxl)",
  "import.err.compression": "压缩包中使用了未知的压缩方式",
  "import.err.notXml": "无法把文件读成 XML",
  "import.err.notMusicXml": "这不是 MusicXML",
  "import.err.noScore": "压缩包里没有乐谱",
  "import.err.noPart": "找不到该声部",
  "import.err.noNotes": "这一行里没有音符",
  "import.err.empty": "文件里没有找到音符"
};
