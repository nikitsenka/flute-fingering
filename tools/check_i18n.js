/* Validates the translations in lang/.
 *
 * English is the reference: every other locale has to carry exactly the same
 * keys, with the same {placeholders} inside each value, and the plural forms
 * its language actually needs according to Intl.PluralRules.
 *
 *     node tools/check_i18n.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");
var REF = "en";

/* the lang files expect to be classic browser scripts sharing one global */
var sandbox = {window:{}};
sandbox.global = sandbox;
vm.createContext(sandbox);
["prefs.js", "i18n.js"].forEach(function(f){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});

var CODES = sandbox.window.I18n.LANGS.map(function(l){ return l.code; });
CODES.forEach(function(code){
  var f = path.join("lang", code + ".js");
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, {filename:f});
});

var STRINGS = sandbox.window.I18N_STRINGS;
var problems = [];

/* every {name} a value asks the page to substitute */
function slots(value){
  var found = {};
  forms(value).forEach(function(text){
    (String(text).match(/\{(\w+)\}/g) || []).forEach(function(s){ found[s] = true; });
  });
  return Object.keys(found).sort();
}

function forms(value){
  if(typeof value === "string"){ return [value]; }
  return Object.keys(value).map(function(k){ return value[k]; });
}

/* which plural categories this language can actually produce, 0..200 plus a
   fraction, which is enough to hit one/few/many/other everywhere we ship */
function categories(code){
  var rules = new Intl.PluralRules(code);
  var seen = {};
  for(var n = 0; n <= 200; n++){ seen[rules.select(n)] = true; }
  seen[rules.select(1.5)] = true;
  return Object.keys(seen).sort();
}

var reference = STRINGS[REF];
if(!reference){
  console.log("  ! no reference locale " + REF);
  process.exit(1);
}
var refKeys = Object.keys(reference).sort();

CODES.forEach(function(code){
  var here = STRINGS[code];
  if(!here){
    problems.push(code + ": lang/" + code + ".js defined nothing");
    return;
  }
  var keys = Object.keys(here).sort();
  var plurals = 0;

  refKeys.forEach(function(key){
    if(here[key] === undefined){
      problems.push(code + ": missing " + key);
      return;
    }

    var want = typeof reference[key];
    var got = typeof here[key];
    if(want !== got){
      problems.push(code + ": " + key + " should be a " + want + ", is a " + got);
      return;
    }

    forms(here[key]).forEach(function(text){
      if(typeof text !== "string" || !text.trim()){
        problems.push(code + ": " + key + " is empty");
      }
    });

    var want2 = slots(reference[key]).join(" ");
    var got2 = slots(here[key]).join(" ");
    if(want2 !== got2){
      problems.push(code + ": " + key + " uses [" + got2 + "], expected [" + want2 + "]");
    }

    /* a plural entry must cover every category the language can select, or
       I18n.plural silently falls back to `other` and reads wrong */
    if(typeof reference[key] === "object"){
      plurals++;
      categories(code).forEach(function(c){
        if(here[key][c] === undefined){
          problems.push(code + ": " + key + " has no \"" + c + "\" form");
        }
      });
    }
  });

  keys.forEach(function(key){
    if(reference[key] === undefined){
      problems.push(code + ": " + key + " is not in " + REF);
    }
  });

  console.log(pad(code, 5) + pad(keys.length + " keys", 11) +
              pad(plurals + " plural", 11) + "[" + categories(code).join(" ") + "]");
});

function pad(s, n){ return (s + "            ").slice(0, Math.max(n, String(s).length + 1)); }

console.log("");
if(problems.length){
  problems.forEach(function(p){ console.log("  ! " + p); });
  console.log("\n" + problems.length + " problem(s)");
  process.exit(1);
}
console.log("all " + CODES.length + " locales OK, " + refKeys.length + " keys each");
