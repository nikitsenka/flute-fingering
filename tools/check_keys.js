/* Checks that every translation key the pages ask for actually exists.
 *
 * check_i18n.js compares the locales with each other: same keys, same
 * placeholders, right plurals. It never looks at the app, so a key that is
 * asked for but was never written -- a typo in a data-i18n attribute, a string
 * added to the page and forgotten in lang/ -- passes it without a murmur and
 * surfaces as a blank label or a raw key in front of a child.
 *
 * That is normally caught by opening the page, which is exactly what cannot be
 * done here: check_audio.js needs a browser and skips without one. So this
 * reads the markup and the scripts instead, collects every key they name, and
 * requires the reference locale to have it.
 *
 * Keys built at runtime -- "note." + letter, an instrument's nameKey, a
 * translation key stored in a piece -- cannot be read this way. They are
 * counted and reported rather than silently ignored, so the number that is
 * beyond this check's reach stays visible.
 *
 *     node tools/check_keys.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");
var REF = "en";

var sandbox = {window:{}};
sandbox.global = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js", path.join("lang", REF + ".js")].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});
var STRINGS = sandbox.window.I18N_STRINGS[REF];

/* every page and every script the pages load, minus what is generated or vendored */
function sources(){
  var out = [];
  fs.readdirSync(ROOT).forEach(function(f){
    if(/\.(html|js)$/.test(f) && f !== "score.js"){ out.push(f); }
  });
  fs.readdirSync(path.join(ROOT, "instruments")).forEach(function(f){
    if(/\.js$/.test(f)){ out.push(path.join("instruments", f)); }
  });
  return out;
}

var asked = {};       /* key -> [where] */
var dynamic = [];     /* the ones this cannot resolve */

/* data-i18n="k", data-i18n-title="k", data-i18n-html="k", I18n.t("k"),
   I18n.plural("k", ...), and the one-off `hint: "k"` style entries a module
   hands to the page. A call whose first argument is not a plain string is
   counted as dynamic instead. */
var PATTERNS = [
  /data-i18n(?:-title|-html)?="([^"]+)"/g,
  /I18n\.(?:t|plural)\(\s*"([^"]+)"/g,
  /(?:nameKey|titleKey|hintKey|hint|onKey)\s*:\s*"([^"]+)"/g,
  /\bi18n\s*=\s*"([^"]+)"/g
];
var DYNAMIC = /I18n\.(?:t|plural)\(\s*[^"'\s)]/g;

sources().forEach(function(file){
  var text = fs.readFileSync(path.join(ROOT, file), "utf8");
  PATTERNS.forEach(function(re){
    re.lastIndex = 0;
    var m;
    while((m = re.exec(text))){
      var key = m[1];
      /* attribute values that are plainly not keys */
      if(!/^[a-z][\w.]*$/i.test(key)){ continue; }
      (asked[key] || (asked[key] = [])).push(file);
    }
  });
  var d;
  DYNAMIC.lastIndex = 0;
  while((d = DYNAMIC.exec(text))){ dynamic.push(file); }
});

var problems = [];
Object.keys(asked).sort().forEach(function(key){
  if(!STRINGS.hasOwnProperty(key)){
    problems.push('"' + key + '" is asked for in ' +
                  asked[key].filter(function(v, i, a){ return a.indexOf(v) === i; }).join(", ") +
                  " but no locale has it");
  }
});

/* The other direction is worth a word but not a failure: a key with no visible
   caller is usually one built at runtime, and only sometimes a leftover. It is
   counted by looking for the key quoted anywhere at all, not by the patterns
   above -- those are deliberately narrow, and using them here would report a
   key as unused merely because it is reached in a way they do not match. */
var haystack = sources().map(function(f){
  return fs.readFileSync(path.join(ROOT, f), "utf8");
}).join("\n");

var unused = Object.keys(STRINGS).filter(function(k){
  return haystack.indexOf('"' + k + '"') < 0;
});

if(problems.length){
  console.log("keys: " + problems.length + " problem(s)");
  problems.forEach(function(p){ console.log("  " + p); });
  process.exit(1);
}

/* The families that are always assembled at runtime: a note's name from its
   letter, an octave's from its register, a page title from the instrument. */
console.log("keys: ok -- " + Object.keys(asked).length + " named in the pages all exist"
          + " (" + dynamic.length + " calls build their key at runtime; "
          + unused.length + " keys are never quoted: "
          + unused.map(function(k){ return k.split(".")[0]; })
                  .filter(function(v, i, a){ return a.indexOf(v) === i; }).sort().join(", ") + ")");
