/* Reading a PDF far enough to see whether there is music in it.
 *
 * This is the layer under a PDF importer, not the importer: it answers "what is
 * actually drawn on this page, and where", and nothing about notes. Turning
 * marks into pitches is the next module's job; keeping the two apart is what
 * lets the hard part be argued about against real files instead of guesses.
 *
 * A PDF holds no music. An engraved one holds vectors -- staff lines as thin
 * filled rectangles or strokes, noteheads as filled curves, stems as slivers --
 * and text showing glyphs of a music font. A scan holds one image and nothing
 * else. Those two need completely different machinery, so the first question
 * any file has to answer is which it is: classify() answers it, and fonts()
 * says whether the glyphs in an engraved one can be named at all -- an exported
 * music font is usually subset, often with no ToUnicode map, and LilyPond may
 * draw noteheads as outlines with no font involved. That distinction decides
 * how much of the recognition can be done by reading and how much by shape.
 *
 * No library. The file is walked the way songimport.js walks a .mxl: by hand,
 * because this repository vendors what it needs and loads nothing at runtime.
 * Rather than trusting the cross-reference table -- which can be a table, a
 * stream, or several of both after incremental saves -- every "N G obj" in the
 * file is indexed directly, last definition winning, which is what an updated
 * file means anyway. Object streams are expanded the same way.
 *
 * Inflating is injected because the two callers differ: the page has
 * DecompressionStream, node has zlib, and both are asynchronous here so the
 * browser one does not need a shim. Everything below returns promises for that
 * one reason.
 *
 *   PdfRead.open(bytes, inflate) -> doc
 *   PdfRead.page(doc, i)         -> what is drawn, in page coordinates
 *   PdfRead.classify(page)       -> "engraved" | "scan" | "empty"
 */
(function(global){
  "use strict";

  /* ---------- bytes as a string ----------
     Every offset in a PDF is a byte offset, so the file is held as a latin-1
     string where one character is one byte and an index is an offset. Streams
     are sliced back out of the original bytes. */

  function latin1(bytes){
    var out = "", CHUNK = 0x8000;
    for(var i = 0; i < bytes.length; i += CHUNK){
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return out;
  }

  /* A failure that a reader will see needs a translation key on it: the page
     shows err.i18n when there is one and this English line when there is not,
     and "pdf: the file is protected" in a Russian interface is the app talking
     to itself. The key is optional because most of these are malformed-file
     details nobody outside this file can act on. */
  function fail(message, key){
    var e = new Error("pdf: " + message);
    if(key){ e.i18n = key; }
    return e;
  }

  /* ---------- object syntax ---------- */

  var WS = " \t\r\n\f\0";
  var DELIM = "()<>[]{}/%";

  function isWs(c){ return WS.indexOf(c) >= 0; }
  function isDelim(c){ return DELIM.indexOf(c) >= 0; }
  function isRegular(c){ return c !== undefined && !isWs(c) && !isDelim(c); }

  /* A cursor over the file. Each read leaves `pos` after what it read, so a
     caller can ask where a stream's bytes begin. */
  function Lexer(str, pos){
    this.s = str;
    this.pos = pos || 0;
  }

  Lexer.prototype.skip = function(){
    while(this.pos < this.s.length){
      var c = this.s[this.pos];
      if(isWs(c)){ this.pos++; continue; }
      if(c === "%"){                       /* comment to end of line */
        while(this.pos < this.s.length && this.s[this.pos] !== "\n" && this.s[this.pos] !== "\r"){ this.pos++; }
        continue;
      }
      return;
    }
  };

  Lexer.prototype.token = function(){
    this.skip();
    if(this.pos >= this.s.length){ return null; }
    var c = this.s[this.pos];

    if(c === "<" && this.s[this.pos + 1] === "<"){ this.pos += 2; return {t:"<<"}; }
    if(c === ">" && this.s[this.pos + 1] === ">"){ this.pos += 2; return {t:">>"}; }
    if(c === "[" || c === "]" || c === "{" || c === "}"){ this.pos++; return {t:c}; }
    if(c === "/"){ return {t:"name", v:this.name()}; }
    if(c === "("){ return {t:"string", v:this.literal()}; }
    if(c === "<"){ return {t:"string", v:this.hex()}; }

    var start = this.pos;
    while(isRegular(this.s[this.pos])){ this.pos++; }
    if(this.pos === start){ this.pos++; return {t:"junk", v:c}; }   /* a stray delimiter */
    var word = this.s.slice(start, this.pos);
    if(/^[-+.\d]/.test(word)){
      var n = parseFloat(word);
      return {t:"number", v:isNaN(n) ? 0 : n};
    }
    return {t:"word", v:word};
  };

  Lexer.prototype.name = function(){
    this.pos++;                                   /* the slash */
    var out = "";
    while(isRegular(this.s[this.pos])){
      var c = this.s[this.pos++];
      if(c === "#"){
        out += String.fromCharCode(parseInt(this.s.substr(this.pos, 2), 16) || 0);
        this.pos += 2;
      } else { out += c; }
    }
    return out;
  };

  /* Literal strings nest, so parentheses are counted rather than searched for.
     Only the escapes that change length matter here -- nothing downstream reads
     these as text, they are glyph codes. */
  Lexer.prototype.literal = function(){
    this.pos++;
    var out = "", depth = 1;
    while(this.pos < this.s.length){
      var c = this.s[this.pos++];
      if(c === "\\"){
        var e = this.s[this.pos++];
        if(e >= "0" && e <= "7"){
          var oct = e;
          while(oct.length < 3 && this.s[this.pos] >= "0" && this.s[this.pos] <= "7"){ oct += this.s[this.pos++]; }
          out += String.fromCharCode(parseInt(oct, 8));
        } else if(e === "n"){ out += "\n"; }
        else if(e === "r"){ out += "\r"; }
        else if(e === "t"){ out += "\t"; }
        else if(e === "b"){ out += "\b"; }
        else if(e === "f"){ out += "\f"; }
        else if(e === "\n"){ /* a line continuation */ }
        else if(e === "\r"){ if(this.s[this.pos] === "\n"){ this.pos++; } }
        else { out += e; }
        continue;
      }
      if(c === "("){ depth++; out += c; continue; }
      if(c === ")"){ if(--depth === 0){ return out; } out += c; continue; }
      out += c;
    }
    return out;
  };

  Lexer.prototype.hex = function(){
    this.pos++;
    var digits = "";
    while(this.pos < this.s.length && this.s[this.pos] !== ">"){
      var c = this.s[this.pos++];
      if(/[0-9a-fA-F]/.test(c)){ digits += c; }
    }
    this.pos++;
    if(digits.length % 2){ digits += "0"; }
    var out = "";
    for(var i = 0; i < digits.length; i += 2){
      out += String.fromCharCode(parseInt(digits.substr(i, 2), 16));
    }
    return out;
  };

  /* A reference is three tokens -- number number R -- so numbers are read with
     two tokens of lookahead. */
  function parseValue(lex){
    var tok = lex.token();
    return valueFrom(lex, tok);
  }

  function valueFrom(lex, tok){
    if(!tok){ return null; }

    if(tok.t === "number"){
      var save = lex.pos;
      var t2 = lex.token();
      if(t2 && t2.t === "number"){
        var save2 = lex.pos;
        var t3 = lex.token();
        if(t3 && t3.t === "word" && t3.v === "R"){
          return {ref:tok.v, gen:t2.v};
        }
        lex.pos = save2;
      }
      lex.pos = save;
      return tok.v;
    }

    if(tok.t === "name"){ return {name:tok.v}; }
    if(tok.t === "string"){ return {str:tok.v}; }

    if(tok.t === "["){
      var arr = [];
      for(;;){
        var it = lex.token();
        if(!it || it.t === "]"){ return arr; }
        arr.push(valueFrom(lex, it));
      }
    }

    if(tok.t === "<<"){
      var dict = {};
      for(;;){
        var k = lex.token();
        if(!k || k.t === ">>"){ return dict; }
        if(k.t !== "name"){ continue; }             /* malformed: skip the key */
        dict[k.v] = parseValue(lex);
      }
    }

    if(tok.t === "word"){
      if(tok.v === "true"){ return true; }
      if(tok.v === "false"){ return false; }
      if(tok.v === "null"){ return null; }
      return {word:tok.v};
    }
    return null;
  }

  function isDict(v){ return v && typeof v === "object" && !Array.isArray(v) && !v.ref && !v.name && !v.str && !v.word; }
  function nameOf(v){ return v && v.name ? v.name : null; }

  /* ---------- the document ---------- */

  function indexObjects(str, gens){
    var at = {};
    var re = /(\d+)[ \t\r\n]+(\d+)[ \t\r\n]+obj\b/g;
    var m;
    while((m = re.exec(str))){
      /* a later definition of the same number is an incremental update, and the
         update is the one that counts */
      at[+m[1]] = m.index + m[0].length;
      /* the generation goes with it: decryption keys are made from both */
      if(gens){ gens[+m[1]] = +m[2]; }
    }
    return at;
  }

  function Doc(bytes, inflate){
    this.bytes = bytes;
    this.s = latin1(bytes);
    this.inflate = inflate;
    this.gens = {};
    this.at = indexObjects(this.s, this.gens);
    this.crypt = null;
    this.cache = {};
    this.streams = {};      /* object number -> {dict, start, length} */
    this.pages = [];
  }

  Doc.prototype.object = function(num){
    if(this.cache.hasOwnProperty(num)){ return this.cache[num]; }
    var pos = this.at[num];
    if(pos === undefined){ return (this.cache[num] = null); }

    var lex = new Lexer(this.s, pos);
    var value = parseValue(lex);

    /* a stream follows its dictionary; its bytes start after the EOL that
       follows the keyword */
    lex.skip();
    if(this.s.substr(lex.pos, 6) === "stream"){
      var p = lex.pos + 6;
      if(this.s[p] === "\r"){ p++; }
      if(this.s[p] === "\n"){ p++; }
      this.streams[num] = {dict:value, start:p};
    }
    this.cache[num] = value;
    return value;
  };

  Doc.prototype.resolve = function(v){
    var seen = 0;
    while(v && v.ref !== undefined && seen++ < 32){ v = this.object(v.ref); }
    return v;
  };

  Doc.prototype.get = function(dict, key){
    if(!dict) { return null; }
    return this.resolve(dict[key]);
  };

  /* /Length is often an indirect reference, and after a repaired or hand-made
     file it can be wrong outright, so "endstream" is the fallback. */
  Doc.prototype.streamBytes = function(num){
    var self = this;
    this.object(num);
    var rec = this.streams[num];
    if(!rec){ return Promise.resolve(null); }

    var len = this.get(rec.dict, "Length");
    var end;
    if(typeof len === "number" && len >= 0 && rec.start + len <= this.bytes.length){
      end = rec.start + len;
      var after = this.s.substr(end, 20);
      if(!/^[\s]*endstream/.test(after)){ end = null; }
    }
    if(end === null || end === undefined){
      var idx = this.s.indexOf("endstream", rec.start);
      if(idx < 0){ return Promise.reject(fail("a stream never ends")); }
      end = idx;
      while(end > rec.start && (this.s[end - 1] === "\n" || this.s[end - 1] === "\r")){ end--; }
    }

    var raw = this.bytes.subarray(rec.start, end);

    /* An encrypted file hides its streams, and they have to come back before
       any filter runs -- a cross-reference stream excepted, which is never
       encrypted because the reader has to find the encryption dictionary
       through it. */
    var before;
    if(this.crypt && nameOf(this.get(rec.dict, "Type")) !== "XRef"){
      before = decryptBytes(this.crypt, objectKey(this.crypt, num, this.gens[num] || 0), raw);
    } else {
      before = Promise.resolve(raw);
    }

    var filters = this.get(rec.dict, "Filter");
    if(!filters){ return before; }
    if(!Array.isArray(filters)){ filters = [filters]; }

    /* /DecodeParms lines up with /Filter by position, so each filter is handed
       its own parameters and its predictor is undone before the next filter
       runs. A Ghostscript file is the case that cares: [ASCII85Decode
       FlateDecode] with the predictor in the second slot and nothing in the
       first, so reading parms[0] would apply the wrong thing at the wrong
       moment -- or, with one filter, quietly work and hide the mistake. */
    var parms = this.get(rec.dict, "DecodeParms");
    if(parms === null || parms === undefined){ parms = this.get(rec.dict, "DP"); }
    if(!Array.isArray(parms)){ parms = [parms]; }

    var chain = before;
    filters.forEach(function(f, i){
      var name = nameOf(self.resolve(f));
      var parm = self.resolve(parms[i]);
      chain = chain.then(function(data){
        return decodeOne(self, name, data);
      }).then(function(data){
        var predictor = isDict(parm) ? self.get(parm, "Predictor") : null;
        if(!predictor || predictor <= 1){ return data; }
        return unpredict(data, predictor, self.get(parm, "Columns") || 1, self.get(parm, "Colors") || 1);
      });
    });
    return chain;
  };

  function decodeOne(doc, name, data){
    if(name === "FlateDecode" || name === "Fl"){ return doc.inflate(data); }
    if(name === "ASCII85Decode" || name === "A85"){ return ascii85(data); }
    if(name === "ASCIIHexDecode" || name === "AHx"){ return asciiHex(data); }
    if(name === "RunLengthDecode" || name === "RL"){ return runLength(data); }
    /* Everything left is an image codec -- DCT, JPX, CCITT -- or the LZW nobody
       has emitted this century. This layer has no reason to read pixels, so a
       stream in one of those is only an error when someone asks for its
       content, and a page's content stream is never in one. */
    return Promise.reject(fail("unsupported stream filter " + name));
  }

  /* ---------- the text-safe filters ----------
     Ghostscript, which a great many downloadable scores have been through,
     likes to wrap a compressed stream in ASCII85. Both of these are short
     enough to write out rather than to refuse the file over. */

  function ascii85(data){
    var out = [], tuple = 0, count = 0;
    for(var i = 0; i < data.length; i++){
      var c = data[i];
      if(c === 0x7e){ break; }                       /* ~> ends the data */
      if(c === 0x7a && count === 0){                 /* z: four zero bytes */
        out.push(0, 0, 0, 0);
        continue;
      }
      if(c < 0x21 || c > 0x75){ continue; }          /* whitespace and noise */
      tuple = tuple * 85 + (c - 0x21);
      if(++count === 5){
        out.push((tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff);
        tuple = 0; count = 0;
      }
    }
    if(count > 0){
      /* a partial group is padded with 'u' and yields count-1 bytes */
      for(var p = count; p < 5; p++){ tuple = tuple * 85 + 84; }
      var bytes = [(tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff];
      for(var k = 0; k < count - 1; k++){ out.push(bytes[k]); }
    }
    return Promise.resolve(new Uint8Array(out));
  }

  function asciiHex(data){
    var out = [], hi = -1;
    for(var i = 0; i < data.length; i++){
      var c = data[i];
      if(c === 0x3e){ break; }                       /* > ends the data */
      var v = c >= 0x30 && c <= 0x39 ? c - 0x30
            : c >= 0x41 && c <= 0x46 ? c - 0x37
            : c >= 0x61 && c <= 0x66 ? c - 0x57 : -1;
      if(v < 0){ continue; }
      if(hi < 0){ hi = v; } else { out.push((hi << 4) | v); hi = -1; }
    }
    if(hi >= 0){ out.push(hi << 4); }                /* an odd digit pads with 0 */
    return Promise.resolve(new Uint8Array(out));
  }

  function runLength(data){
    var out = [];
    for(var i = 0; i < data.length;){
      var n = data[i++];
      if(n === 128){ break; }
      if(n < 128){
        for(var k = 0; k <= n && i < data.length; k++){ out.push(data[i++]); }
      } else {
        var b = data[i++];
        for(var r = 0; r < 257 - n; r++){ out.push(b); }
      }
    }
    return Promise.resolve(new Uint8Array(out));
  }

  /* PNG predictors, which object and cross-reference streams lean on. */
  function unpredict(data, predictor, columns, colors){
    if(predictor < 10){ return data; }              /* TIFF predictor 2: not seen in the wild here */
    var bpp = Math.max(1, colors);
    var rowLen = columns * bpp;
    var rows = Math.floor(data.length / (rowLen + 1));
    var out = new Uint8Array(rows * rowLen);
    var prev = new Uint8Array(rowLen);
    for(var r = 0; r < rows; r++){
      var tag = data[r * (rowLen + 1)];
      var src = r * (rowLen + 1) + 1;
      var dst = r * rowLen;
      for(var i = 0; i < rowLen; i++){
        var raw = data[src + i];
        var left = i >= bpp ? out[dst + i - bpp] : 0;
        var up = prev[i];
        var upLeft = i >= bpp ? prev[i - bpp] : 0;
        var value;
        if(tag === 0){ value = raw; }
        else if(tag === 1){ value = raw + left; }
        else if(tag === 2){ value = raw + up; }
        else if(tag === 3){ value = raw + ((left + up) >> 1); }
        else {
          var p = left + up - upLeft;
          var pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
          value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
        }
        out[dst + i] = value & 0xff;
      }
      prev = out.subarray(dst, dst + rowLen);
    }
    return out;
  }

  /* ---------- object streams ----------
     A PDF 1.5 file keeps most of its small objects packed inside one compressed
     stream, so indexing "N 0 obj" alone finds the container and none of its
     contents. Every ObjStm in the file is unpacked once, at open(). */

  function expandObjectStreams(doc){
    var numbers = Object.keys(doc.at).map(Number);
    var chain = Promise.resolve();

    numbers.forEach(function(num){
      var obj = doc.object(num);
      if(!isDict(obj) || nameOf(doc.get(obj, "Type")) !== "ObjStm"){ return; }
      chain = chain.then(function(){
        return doc.streamBytes(num).then(function(bytes){
          if(!bytes){ return; }
          var str = latin1(bytes);
          var count = doc.get(obj, "N") || 0;
          var first = doc.get(obj, "First") || 0;
          var head = new Lexer(str, 0);
          var pairs = [];
          for(var i = 0; i < count; i++){
            var a = head.token(), b = head.token();
            if(!a || !b || a.t !== "number" || b.t !== "number"){ break; }
            pairs.push([a.v, b.v]);
          }
          pairs.forEach(function(pair){
            /* a packed object never overrides one written out at top level */
            if(doc.at[pair[0]] !== undefined || doc.cache.hasOwnProperty(pair[0])){ return; }
            var lex = new Lexer(str, first + pair[1]);
            doc.cache[pair[0]] = parseValue(lex);
          });
        }, function(){ /* an ObjStm we cannot inflate is one we do without */ });
      });
    });
    return chain;
  }

  /* ---------- pages ---------- */

  function collectPages(doc){
    var pages = [];
    var seen = {};

    function walk(node, depth, inherited){
      node = doc.resolve(node);
      if(!isDict(node) || depth > 32){ return; }
      var next = {
        Resources: node.Resources !== undefined ? node.Resources : inherited.Resources,
        MediaBox:  node.MediaBox  !== undefined ? node.MediaBox  : inherited.MediaBox,
        Rotate:    node.Rotate    !== undefined ? node.Rotate    : inherited.Rotate
      };
      var type = nameOf(doc.get(node, "Type"));
      var kids = doc.get(node, "Kids");
      if(type === "Page" || (!kids && node.Contents !== undefined)){
        pages.push({dict:node, inherited:next});
        return;
      }
      if(Array.isArray(kids)){
        kids.forEach(function(kid){
          var key = kid && kid.ref !== undefined ? kid.ref : null;
          if(key !== null){
            if(seen[key]){ return; }                 /* a loop in the page tree */
            seen[key] = true;
          }
          walk(kid, depth + 1, next);
        });
      }
    }

    var catalogNum = null;
    Object.keys(doc.at).concat(Object.keys(doc.cache)).forEach(function(k){
      if(catalogNum !== null){ return; }
      var obj = doc.object(+k);
      if(isDict(obj) && nameOf(doc.get(obj, "Type")) === "Catalog"){ catalogNum = +k; }
    });

    if(catalogNum !== null){
      walk(doc.get(doc.object(catalogNum), "Pages"), 0, {});
    }

    /* No catalog, or a page tree that led nowhere: take every page object there
       is, in the order they were written. A damaged file still reads. */
    if(!pages.length){
      Object.keys(doc.at).map(Number).sort(function(a, b){ return a - b; }).forEach(function(num){
        var obj = doc.object(num);
        if(isDict(obj) && nameOf(doc.get(obj, "Type")) === "Page"){
          pages.push({dict:obj, inherited:{}});
        }
      });
    }
    return pages;
  }

  /* A protected file has to be refused by name rather than by accident. Only
     the streams are encrypted, never the dictionaries, so the structure of one
     parses perfectly: pages are found, content is located, and the first
     inflate fails on bytes that are not deflate at all. Left alone that reaches
     the reader as a puzzling complaint about a stream, when the true answer is
     that the file is locked -- and a great many published scores are locked
     with an empty password, which we still cannot open, but can at least name.

     The trailer is not read here (the cross-reference table is deliberately
     ignored), so /Encrypt is looked for where it is written -- in a trailer or
     a cross-reference stream dictionary -- and confirmed against the security
     handler's own object. */
  /* ---------- a file that is "protected" but not locked ----------
     Most sheet music that arrives encrypted has an owner password and an empty
     user one: the restrictions are on printing and copying, and every reader
     opens it without asking anybody anything. Refusing those is refusing the
     common case. What is genuinely locked -- a real user password -- still has
     to be refused, and the difference is testable: the standard handler stores
     a check value that only comes out right when the password is the one the
     file was made with.

     MD5 and RC4 are written out here because nothing else in the browser has
     them; AES comes from WebCrypto, which is why the whole path is promised.
     Only streams are decrypted. Strings inside dictionaries are encrypted too,
     but nothing in this reader reads one -- a title or an author, not a note.

     PDF 32000-1, 7.6.3: algorithm 2 builds the key, algorithm 6 checks it. */
  var PAD = [0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,0x64,0x00,0x4E,0x56,
             0xFF,0xFA,0x01,0x08,0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,
             0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A];

  function md5(bytes){
    function rol(n, c){ return (n << c) | (n >>> (32 - c)); }
    var S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    var K = [];
    for(var i = 0; i < 64; i++){ K[i] = (Math.abs(Math.sin(i + 1)) * 4294967296) | 0; }

    var len = bytes.length;
    var withPad = new Uint8Array(((len + 8) >> 6) * 64 + 64);
    withPad.set(bytes);
    withPad[len] = 0x80;
    var bits = len * 8;
    for(var b = 0; b < 4; b++){ withPad[withPad.length - 8 + b] = (bits >>> (8 * b)) & 0xFF; }

    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for(var off = 0; off < withPad.length; off += 64){
      var M = [];
      for(var j = 0; j < 16; j++){
        M[j] = withPad[off + j * 4] | (withPad[off + j * 4 + 1] << 8) |
               (withPad[off + j * 4 + 2] << 16) | (withPad[off + j * 4 + 3] << 24);
      }
      var A = a0, B = b0, C = c0, D = d0;
      for(var k = 0; k < 64; k++){
        var F, g;
        if(k < 16){ F = (B & C) | (~B & D); g = k; }
        else if(k < 32){ F = (D & B) | (~D & C); g = (5 * k + 1) % 16; }
        else if(k < 48){ F = B ^ C ^ D; g = (3 * k + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * k) % 16; }
        F = (F + A + K[k] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + rol(F, S[k])) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }

    var out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach(function(word, w){
      for(var n = 0; n < 4; n++){ out[w * 4 + n] = (word >>> (8 * n)) & 0xFF; }
    });
    return out;
  }

  function rc4(key, data){
    var s = new Uint8Array(256), i, j = 0, t;
    for(i = 0; i < 256; i++){ s[i] = i; }
    for(i = 0; i < 256; i++){
      j = (j + s[i] + key[i % key.length]) & 0xFF;
      t = s[i]; s[i] = s[j]; s[j] = t;
    }
    var out = new Uint8Array(data.length);
    i = 0; j = 0;
    for(var n = 0; n < data.length; n++){
      i = (i + 1) & 0xFF;
      j = (j + s[i]) & 0xFF;
      t = s[i]; s[i] = s[j]; s[j] = t;
      out[n] = data[n] ^ s[(s[i] + s[j]) & 0xFF];
    }
    return out;
  }

  /* the parser hands a PDF string back as {str:"..."}, already unescaped */
  function textOf(v){
    if(v && typeof v.str === "string"){ return v.str; }
    return typeof v === "string" ? v : "";
  }

  function bytesOfString(str){
    var out = new Uint8Array(str.length);
    for(var i = 0; i < str.length; i++){ out[i] = str.charCodeAt(i) & 0xFF; }
    return out;
  }

  function joinBytes(parts){
    var n = 0;
    parts.forEach(function(p){ n += p.length; });
    var out = new Uint8Array(n), at = 0;
    parts.forEach(function(p){ out.set(p, at); at += p.length; });
    return out;
  }

  /* The first half of /ID, as bytes. It is written in the trailer, which this
     reader does not parse, so it is read where it is written. */
  function firstId(doc){
    var m = /\/ID\s*\[\s*<([0-9a-fA-F\s]*)>/.exec(doc.s);
    if(m){
      var hex = m[1].replace(/\s+/g, "");
      var out = new Uint8Array(hex.length >> 1);
      for(var i = 0; i < out.length; i++){ out[i] = parseInt(hex.substr(i * 2, 2), 16); }
      return out;
    }
    m = /\/ID\s*\[\s*\(([^)]*)\)/.exec(doc.s);
    return m ? bytesOfString(m[1]) : new Uint8Array(0);
  }

  function fileKey(enc, doc){
    var R = num(doc.get(enc, "R")) || 2;
    var length = num(doc.get(enc, "Length")) || 40;
    var bits = R === 2 ? 5 : Math.floor(length / 8);
    var O = bytesOfString(textOf(doc.get(enc, "O")));
    var P = num(doc.get(enc, "P")) | 0;
    var pbytes = new Uint8Array(4);
    for(var i = 0; i < 4; i++){ pbytes[i] = (P >>> (8 * i)) & 0xFF; }

    var parts = [new Uint8Array(PAD), O.subarray(0, 32), pbytes, firstId(doc)];
    if(R >= 4 && doc.get(enc, "EncryptMetadata") === false){
      parts.push(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]));
    }

    var key = md5(joinBytes(parts));
    if(R >= 3){
      for(var n = 0; n < 50; n++){ key = md5(key.subarray(0, bits)); }
    }
    return key.subarray(0, bits);
  }

  /* Algorithm 6: does the empty user password open this file? */
  function emptyPasswordWorks(enc, doc, key){
    var R = num(doc.get(enc, "R")) || 2;
    var U = bytesOfString(textOf(doc.get(enc, "U")));
    if(R === 2){
      var want = rc4(key, new Uint8Array(PAD));
      return same(want, U, 32);
    }
    var seed = md5(joinBytes([new Uint8Array(PAD), firstId(doc)]));
    var out = rc4(key, seed);
    for(var i = 1; i <= 19; i++){
      var k = new Uint8Array(key.length);
      for(var j = 0; j < key.length; j++){ k[j] = key[j] ^ i; }
      out = rc4(k, out);
    }
    /* only the first 16 bytes are the check; the rest is arbitrary padding */
    return same(out, U, 16);
  }

  function same(a, b, n){
    if(!a || !b || a.length < n || b.length < n){ return false; }
    for(var i = 0; i < n; i++){ if(a[i] !== b[i]){ return false; } }
    return true;
  }

  /* Which cipher the streams are under: V4 names a crypt filter, and anything
     earlier is RC4 with the file key. */
  function streamCipher(enc, doc){
    var V = num(doc.get(enc, "V")) || 0;
    if(V < 4){ return "rc4"; }
    var name = nameOf(doc.get(enc, "StmF")) || "Identity";
    if(name === "Identity"){ return "none"; }
    var filters = doc.get(enc, "CF");
    var cf = isDict(filters) ? doc.get(filters, name) : null;
    var cfm = cf ? nameOf(doc.get(cf, "CFM")) : null;
    if(cfm === "AESV2"){ return "aes"; }
    if(cfm === "V2" || cfm === "RC4"){ return "rc4"; }
    if(cfm === "None"){ return "none"; }
    return null;                       /* AESV3 and anything newer: not read */
  }

  function setupCrypt(doc){
    var enc = null;
    var nums = Object.keys(doc.at).map(Number);
    var m = /\/Encrypt\s+(\d+)\s+\d+\s+R/.exec(doc.s);
    if(m){ enc = doc.object(+m[1]); }
    if(!isDict(enc)){
      for(var i = 0; i < nums.length && !isDict(enc); i++){
        var o = doc.object(nums[i]);
        if(isDict(o) && nameOf(doc.get(o, "Filter")) === "Standard" && o.O !== undefined){ enc = o; }
      }
    }
    if(!isDict(enc)){ return null; }

    var V = num(doc.get(enc, "V")) || 0;
    if(V > 4){ return {locked:true, why:"this PDF uses an encryption this reader does not know"}; }

    var cipher = streamCipher(enc, doc);
    if(!cipher){ return {locked:true, why:"this PDF uses an encryption this reader does not know"}; }
    /* AES comes from WebCrypto, which a page has and a bare script may not --
       better to say so here than to hand back a document whose every stream
       fails to decrypt and whose every page then looks empty */
    if(cipher === "aes" && !subtleCrypto()){
      return {locked:true, why:"this PDF is AES-encrypted and there is no crypto here to open it"};
    }

    var key = fileKey(enc, doc);
    if(!emptyPasswordWorks(enc, doc, key)){
      return {locked:true, why:"this PDF needs a password to open"};
    }
    return {key:key, cipher:cipher, aes:cipher === "aes"};
  }

  /* Per object, per PDF 32000-1 algorithm 1: the file key, the object number
     and generation, and for AES four bytes that say so. */
  function objectKey(crypt, num, gen){
    if(crypt.cipher === "none"){ return null; }
    var extra = crypt.aes ? [0x73, 0x41, 0x6C, 0x54] : [];
    var parts = [crypt.key, new Uint8Array([num & 0xFF, (num >> 8) & 0xFF, (num >> 16) & 0xFF,
                                            gen & 0xFF, (gen >> 8) & 0xFF].concat(extra))];
    var key = md5(joinBytes(parts));
    return key.subarray(0, Math.min(crypt.key.length + 5, 16));
  }

  function subtleCrypto(){
    if(global.crypto && global.crypto.subtle){ return global.crypto.subtle; }
    if(typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle){
      return globalThis.crypto.subtle;
    }
    return null;
  }

  function decryptBytes(crypt, key, data){
    if(!key){ return Promise.resolve(data); }
    if(!crypt.aes){ return Promise.resolve(rc4(key, data)); }
    if(data.length <= 16){ return Promise.resolve(new Uint8Array(0)); }

    var subtle = subtleCrypto();
    if(!subtle){ return Promise.reject(fail("this browser cannot decrypt AES", "import.err.pdfLocked")); }

    var iv = data.subarray(0, 16);
    var body = data.subarray(16);
    return subtle.importKey("raw", key, {name:"AES-CBC"}, false, ["decrypt"]).then(function(k){
      return subtle.decrypt({name:"AES-CBC", iv:iv}, k, body);
    }).then(function(buf){ return new Uint8Array(buf); });
  }

  function encrypted(doc){
    if(/\/Encrypt[\s]*\d+[\s]+\d+[\s]+R/.test(doc.s)){ return true; }
    var nums = Object.keys(doc.at).map(Number);
    for(var i = 0; i < nums.length; i++){
      var obj = doc.object(nums[i]);
      if(isDict(obj) && nameOf(doc.get(obj, "Filter")) === "Standard" &&
         (obj.V !== undefined || obj.R !== undefined) && obj.O !== undefined){
        return true;
      }
    }
    return false;
  }

  function open(bytes, inflate){
    if(!(bytes instanceof Uint8Array)){ bytes = new Uint8Array(bytes); }
    var doc = new Doc(bytes, inflate);
    /* The header is normally the first five bytes, but a file that has been
       concatenated or served with a preamble can carry it a little further in,
       so a late one is tolerated. Missing entirely is the case that matters and
       the one this used to get wrong: indexOf answers -1, which is neither zero
       nor greater than a kilobyte, so a file of random bytes walked past this
       test and was turned away further down as "nothing drawn on the page" --
       true of a JPEG, and no help at all to someone who picked the wrong file. */
    var header = doc.s.indexOf("%PDF-");
    if(header < 0 || header > 1024){
      return Promise.reject(fail("this is not a PDF", "import.err.pdfNot"));
    }
    if(!Object.keys(doc.at).length){
      return Promise.reject(fail("no objects in the file", "import.err.pdfEmpty"));
    }
    if(encrypted(doc)){
      var crypt = setupCrypt(doc);
      if(!crypt || crypt.locked){
        return Promise.reject(fail((crypt && crypt.why) || "the file is protected",
                                   "import.err.pdfLocked"));
      }
      doc.crypt = crypt;
    }
    return expandObjectStreams(doc).then(function(){
      doc.pages = collectPages(doc);
      if(!doc.pages.length){
        return Promise.reject(fail("no pages in the file", "import.err.pdfEmpty"));
      }
      return doc;
    });
  }

  /* ---------- what a page draws ----------
     The content stream is a stack machine. Only the operators that leave a mark
     matter here, plus the ones that move the coordinate system under it -- an
     engraver may draw a whole system inside a form with its own transform, so
     everything is reported in page coordinates and nothing downstream has to
     know that. */

  function mul(m, n){                       /* m then n */
    return [
      m[0]*n[0] + m[1]*n[2],       m[0]*n[1] + m[1]*n[3],
      m[2]*n[0] + m[3]*n[2],       m[2]*n[1] + m[3]*n[3],
      m[4]*n[0] + m[5]*n[2] + n[4], m[4]*n[1] + m[5]*n[3] + n[5]
    ];
  }

  function apply(m, x, y){
    return [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
  }

  function scaleOf(m){                      /* how long a unit line comes out */
    return Math.sqrt(Math.abs(m[0]*m[3] - m[1]*m[2])) || 1;
  }

  function tokenizeOps(str){
    var lex = new Lexer(str, 0);
    var ops = [], args = [];
    for(;;){
      var tok = lex.token();
      if(!tok){ break; }
      if(tok.t === "word"){
        if(tok.v === "true" || tok.v === "false" || tok.v === "null"){ args.push(tok.v === "true"); continue; }
        if(tok.v === "BI"){                 /* an inline image: skip to EI */
          var end = str.indexOf("EI", lex.pos);
          lex.pos = end < 0 ? str.length : end + 2;
          ops.push({op:"BI", args:[]});
          args = [];
          continue;
        }
        ops.push({op:tok.v, args:args});
        args = [];
        continue;
      }
      args.push(valueFrom(lex, tok));
      if(args.length > 64){ args.shift(); }  /* malformed content: do not grow forever */
    }
    return ops;
  }

  function num(v){ return typeof v === "number" ? v : 0; }

  function Marks(){
    this.fills = [];      /* filled paths: staff lines, noteheads, stems, beams */
    this.strokes = [];    /* stroked paths: staff lines too, in some engravers  */
    this.texts = [];      /* glyphs shown, with the font they came from         */
    this.images = [];     /* what makes a scan a scan                          */
    this.truncated = false;
  }

  var MAX_MARKS = 200000;   /* a busy orchestral page, with room to spare */

  function walk(doc, content, resources, state, marks, depth){
    var ops = tokenizeOps(content);
    var stack = [];
    var gs = {ctm:state.ctm.slice(), font:null, size:0};
    var path = [], curves = false, subpaths = 0, wasRect = null;
    var tm = null, tlm = null, leading = 0;

    function point(x, y){
      var p = apply(gs.ctm, x, y);
      path.push(p);
    }

    function bbox(){
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for(var i = 0; i < path.length; i++){
        if(path[i][0] < x0){ x0 = path[i][0]; }
        if(path[i][0] > x1){ x1 = path[i][0]; }
        if(path[i][1] < y0){ y0 = path[i][1]; }
        if(path[i][1] > y1){ y1 = path[i][1]; }
      }
      return {x:x0, y:y0, w:x1 - x0, h:y1 - y0};
    }

    function paint(kind, width){
      if(!path.length){ return; }
      var list = kind === "fill" ? marks.fills : marks.strokes;
      if(list.length < MAX_MARKS){
        var b = bbox();
        b.curves = curves;
        b.subpaths = subpaths;
        b.rect = wasRect === subpaths && !curves;      /* every subpath was `re` */
        b.points = path.length;
        if(kind === "stroke"){ b.width = width * scaleOf(gs.ctm); }
        list.push(b);
      } else { marks.truncated = true; }
      path = []; curves = false; subpaths = 0; wasRect = 0;
    }

    var lineWidth = 1;
    var i = 0;
    var pending = null;

    function step(){
      for(; i < ops.length; i++){
        var o = ops[i], a = o.args;
        switch(o.op){
          case "q": stack.push({ctm:gs.ctm.slice(), font:gs.font, size:gs.size, lineWidth:lineWidth}); break;
          case "Q":
            var prev = stack.pop();
            if(prev){ gs.ctm = prev.ctm; gs.font = prev.font; gs.size = prev.size; lineWidth = prev.lineWidth; }
            break;
          case "cm": gs.ctm = mul([num(a[0]),num(a[1]),num(a[2]),num(a[3]),num(a[4]),num(a[5])], gs.ctm); break;
          case "w": lineWidth = num(a[0]); break;

          case "m": point(num(a[0]), num(a[1])); subpaths++; break;
          case "l": point(num(a[0]), num(a[1])); break;
          case "c": curves = true; point(num(a[0]),num(a[1])); point(num(a[2]),num(a[3])); point(num(a[4]),num(a[5])); break;
          case "v": case "y": curves = true; point(num(a[0]),num(a[1])); point(num(a[2]),num(a[3])); break;
          case "h": break;
          case "re":
            var x = num(a[0]), y = num(a[1]), w = num(a[2]), h = num(a[3]);
            point(x, y); point(x + w, y); point(x + w, y + h); point(x, y + h);
            subpaths++; wasRect = (wasRect || 0) + 1;
            break;

          case "f": case "F": case "f*": paint("fill"); break;
          case "B": case "B*": case "b": case "b*": paint("fill"); break;
          case "S": case "s": paint("stroke", lineWidth); break;
          case "n": path = []; curves = false; subpaths = 0; wasRect = 0; break;

          case "BT": tm = [1,0,0,1,0,0]; tlm = tm.slice(); break;
          case "ET": tm = tlm = null; break;
          case "Tf": gs.font = a[0] && a[0].name ? a[0].name : null; gs.size = num(a[1]); break;
          case "TL": leading = num(a[0]); break;
          case "Td": tlm = mul([1,0,0,1,num(a[0]),num(a[1])], tlm || [1,0,0,1,0,0]); tm = tlm.slice(); break;
          case "TD": leading = -num(a[1]); tlm = mul([1,0,0,1,num(a[0]),num(a[1])], tlm || [1,0,0,1,0,0]); tm = tlm.slice(); break;
          case "Tm": tlm = [num(a[0]),num(a[1]),num(a[2]),num(a[3]),num(a[4]),num(a[5])]; tm = tlm.slice(); break;
          case "T*": tlm = mul([1,0,0,1,0,-leading], tlm || [1,0,0,1,0,0]); tm = tlm.slice(); break;
          case "Tj": case "'": case "\"":
            if(o.op !== "Tj"){ tlm = mul([1,0,0,1,0,-leading], tlm || [1,0,0,1,0,0]); tm = tlm.slice(); }
            show(a[a.length - 1]);
            break;
          case "TJ":
            if(Array.isArray(a[0])){
              a[0].forEach(function(part){ if(part && part.str !== undefined){ show(part); } });
            }
            break;

          case "Do":
            var name = a[0] && a[0].name;
            var xo = name ? lookup(doc, resources, "XObject", name) : null;
            if(!xo){ break; }
            var sub = nameOf(doc.get(xo.dict, "Subtype"));
            if(sub === "Image"){
              var placed = apply(gs.ctm, 0, 0), corner = apply(gs.ctm, 1, 1);
              marks.images.push({
                name: name,
                x: Math.min(placed[0], corner[0]), y: Math.min(placed[1], corner[1]),
                w: Math.abs(corner[0] - placed[0]), h: Math.abs(corner[1] - placed[1]),
                pixels: {w: doc.get(xo.dict, "Width") || 0, h: doc.get(xo.dict, "Height") || 0}
              });
              break;
            }
            if(sub === "Form" && depth < 8){
              /* the form has to be inflated before its operators can run, so the
                 walk pauses here and resumes in the promise below */
              i++;
              pending = {xo:xo, ctm:gs.ctm.slice()};
              return;
            }
            break;
        }
      }
    }

    function show(v){
      if(!v || v.str === undefined || !tm){ return; }
      var at = apply(mul(tm, gs.ctm), 0, 0);
      if(marks.texts.length < MAX_MARKS){
        marks.texts.push({font:gs.font, size:gs.size * scaleOf(mul(tm, gs.ctm)), x:at[0], y:at[1],
                          codes:v.str, length:v.str.length});
      } else { marks.truncated = true; }
      /* No font metrics are read, so the pen does not advance: a glyph's own
         position is what a notehead needs, and TJ/Tm give that directly. Words
         set with one Tj land on one point, which is why check_pdfread reads
         glyph counts rather than word positions. */
    }

    function resume(){
      pending = null;
      step();
      if(!pending){ return Promise.resolve(); }
      var xo = pending.xo, ctm = pending.ctm;
      var matrix = doc.get(xo.dict, "Matrix");
      var formCtm = Array.isArray(matrix) && matrix.length === 6
        ? mul(matrix.map(num), ctm) : ctm;
      var formRes = doc.get(xo.dict, "Resources") || resources;
      return doc.streamBytes(xo.num).then(function(bytes){
        if(!bytes){ return; }
        return walk(doc, latin1(bytes), formRes, {ctm:formCtm}, marks, depth + 1);
      }, function(){ /* an unreadable form is one form's worth of missing marks */ })
       .then(resume);
    }

    return resume();
  }

  /* Resources are inherited down the page tree and shadowed inside forms, so a
     name is looked up in the dictionary that was handed in, not globally. */
  function lookup(doc, resources, category, name){
    var cat = doc.get(resources, category);
    if(!isDict(cat)){ return null; }
    var ref = cat[name];
    var dict = doc.resolve(ref);
    if(!isDict(dict)){ return null; }
    return {num: ref && ref.ref !== undefined ? ref.ref : null, dict:dict};
  }

  /* ---------- fonts ----------
     Whether a glyph can be named at all decides how much of an engraved page can
     be read rather than measured. An exported music font is normally embedded as
     a subset under arbitrary codes with no ToUnicode map, in which case the codes
     mean nothing outside that one file -- and some engravers draw noteheads as
     outlines, with no font in sight. Both cases are visible here. */

  function fonts(doc, resources){
    var out = [];
    var cat = doc.get(resources, "Font");
    if(!isDict(cat)){ return out; }

    Object.keys(cat).forEach(function(name){
      var f = doc.resolve(cat[name]);
      if(!isDict(f)){ return; }
      var base = nameOf(doc.get(f, "BaseFont")) || "";
      var subtype = nameOf(doc.get(f, "Subtype")) || "";
      var descriptor = doc.get(f, "FontDescriptor");

      /* a Type0 font keeps its descriptor one level down, in the descendant */
      if(!descriptor){
        var kids = doc.get(f, "DescendantFonts");
        if(Array.isArray(kids) && kids.length){
          descriptor = doc.get(doc.resolve(kids[0]), "FontDescriptor");
        }
      }

      var embedded = !!(descriptor && (descriptor.FontFile || descriptor.FontFile2 || descriptor.FontFile3));
      var encoding = doc.get(f, "Encoding");
      var differences = isDict(encoding) ? doc.get(encoding, "Differences") : null;

      out.push({
        key: name,
        base: base,
        /* "ABCDEF+Bravura" is the subset convention: six capitals and a plus */
        subset: /^[A-Z]{6}\+/.test(base),
        family: base.replace(/^[A-Z]{6}\+/, ""),
        subtype: subtype,
        embedded: embedded,
        toUnicode: !!f.ToUnicode,
        encoding: nameOf(encoding) || (isDict(encoding) ? "custom" : null),
        differences: Array.isArray(differences) ? differences.filter(function(d){ return d && d.name; }).length : 0
      });
    });
    return out;
  }

  /* ---------- one page ---------- */

  function contentOf(doc, pageDict){
    var contents = pageDict.Contents;
    var refs = Array.isArray(doc.resolve(contents)) ? doc.resolve(contents) : [contents];
    var parts = [];
    var chain = Promise.resolve();
    refs.forEach(function(ref){
      if(!ref || ref.ref === undefined){ return; }
      chain = chain.then(function(){
        return doc.streamBytes(ref.ref).then(function(bytes){
          if(bytes){ parts.push(latin1(bytes)); }
        }, function(){ /* one unreadable piece of content, not the whole page */ });
      });
    });
    /* the pieces of a page's content are one stream cut in places, and a token
       may not straddle the cut -- a newline between them is what the spec says */
    return chain.then(function(){ return parts.join("\n"); });
  }

  /* ---------- what a glyph code means ----------
     A subset music font hands out codes that mean nothing outside the file it
     came in -- but a PDF that carries a /ToUnicode CMap says what each code was
     meant to be, and engravers do write one. Two conventions turn up: a SMuFL
     font maps to the musical block at U+E000, and the older Finale and Sibelius
     fonts map to the private-use area at U+F000 plus the ASCII code the glyph
     used to sit at, so a flat is U+F062, the letter b. Either way the map is
     what lets a reader say "that is a flat" instead of "that is code 68".

     Only bfchar and bfranges are read, which is all a ToUnicode CMap holds. */
  function parseCMap(text){
    var map = {};

    text.replace(/beginbfchar([\s\S]*?)endbfchar/g, function(all, body){
      body.replace(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g, function(m, from, to){
        map[parseInt(from, 16)] = parseInt(to.slice(0, 4), 16);
        return "";
      });
      return "";
    });

    text.replace(/beginbfrange([\s\S]*?)endbfrange/g, function(all, body){
      body.replace(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g,
        function(m, lo, hi, to){
          var a = parseInt(lo, 16), b = parseInt(hi, 16), t = parseInt(to.slice(0, 4), 16);
          /* a runaway range would be a malformed file, not a big font */
          for(var i = a; i <= b && i - a < 4096; i++){ map[i] = t + (i - a); }
          return "";
        });
      return "";
    });

    return map;
  }

  /* One promise per font that has a map; a font without one is left alone. */
  function toUnicode(doc, resources, list){
    var cat = doc.get(resources, "Font");
    if(!isDict(cat)){ return Promise.resolve(list); }

    var jobs = list.map(function(f){
      var dict = doc.resolve(cat[f.key]);
      var ref = isDict(dict) ? dict.ToUnicode : null;
      if(!ref || ref.ref === undefined){ return Promise.resolve(); }
      return doc.streamBytes(ref.ref).then(function(bytes){
        if(bytes){ f.map = parseCMap(latin1(bytes)); }
      }, function(){ /* an unreadable map is the same as none */ });
    });

    return Promise.all(jobs).then(function(){ return list; });
  }

  function page(doc, index){
    var entry = doc.pages[index];
    if(!entry){ return Promise.reject(fail("no page " + index)); }

    var dict = entry.dict;
    var box = doc.get(dict, "MediaBox") || doc.resolve(entry.inherited.MediaBox) || [0, 0, 612, 792];
    box = box.map(function(v){ return num(doc.resolve(v)); });
    var width = Math.abs(box[2] - box[0]), height = Math.abs(box[3] - box[1]);
    var resources = doc.get(dict, "Resources") || doc.resolve(entry.inherited.Resources) || {};

    /* the origin is the media box's corner, not necessarily (0,0) */
    var base = [1, 0, 0, 1, -Math.min(box[0], box[2]), -Math.min(box[1], box[3])];

    var marks = new Marks();
    var list = fonts(doc, resources);
    return contentOf(doc, dict).then(function(content){
      return walk(doc, content, resources, {ctm:base}, marks, 0);
    }).then(function(){
      return toUnicode(doc, resources, list);
    }).then(function(){
      return {
        index: index,
        width: width,
        height: height,
        rotate: num(doc.get(dict, "Rotate") || doc.resolve(entry.inherited.Rotate) || 0),
        fills: marks.fills,
        strokes: marks.strokes,
        texts: marks.texts,
        images: marks.images,
        fonts: list,
        truncated: marks.truncated
      };
    });
  }

  /* ---------- which sort of PDF is this ----------
     The one question that has to be answered before any recognition starts. An
     engraved page is thousands of small vector marks; a scan is one image and
     nothing else. Anything in between -- a scan with a text layer stamped over
     it, a page of prose -- is reported as it is rather than forced into one of
     the two. */

  function classify(pg){
    var area = Math.max(1, pg.width * pg.height);
    var covered = 0;
    pg.images.forEach(function(im){ covered += Math.abs(im.w * im.h); });
    var imageShare = Math.min(1, covered / area);

    var marks = pg.fills.length + pg.strokes.length;
    var glyphs = pg.texts.reduce(function(n, t){ return n + t.length; }, 0);

    /* A dominant image decides first. A scan often carries a few hundred vector
       marks on top -- a library's stamp, a watermark, a publisher's logo -- and
       counting marks before looking at the image would call such a page an
       engraving and send the recogniser hunting for staff lines in a logo. */
    var kind, why;
    if(imageShare > 0.5){
      kind = "scan";
      why = "one image covers " + Math.round(imageShare * 100) + "% of the page"
          + (marks ? ", with " + marks + " vector mark(s) over it -- a stamp or a watermark" : "");
    } else if(marks >= 40){
      kind = "engraved";
      why = marks + " vector marks and " + glyphs + " glyphs";
    } else if(glyphs > 0 || marks > 0){
      kind = "sparse";
      why = "only " + marks + " marks and " + glyphs + " glyphs -- too little for a page of music";
    } else {
      kind = "empty";
      why = "the page draws nothing";
    }

    return {kind:kind, why:why, imageShare:imageShare, marks:marks, glyphs:glyphs,
            fills:pg.fills.length, strokes:pg.strokes.length, images:pg.images.length};
  }

  global.PdfRead = {
    open: open,
    page: page,
    classify: classify,
    fonts: fonts,
    _Lexer: Lexer,
    _parseValue: parseValue,
    _latin1: latin1
  };
})(typeof window !== "undefined" ? window : globalThis);
