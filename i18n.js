/* Translations and the language switcher.
 *
 * Load this after prefs.js and before every other script on a page: songs.js
 * and the page code both ask it for text as they build themselves.
 *
 * The strings live in lang/<code>.js, each of which does
 *     window.I18N_STRINGS.<code> = { ... }
 * A plain assignment rather than fetched JSON, so the pages still work when
 * opened straight from disk (file:// blocks fetch).
 *
 * A value is either a string or, when it has to agree with a number, an object
 * of Intl.PluralRules categories: {one:..., few:..., many:..., other:...}.
 * Placeholders are written {like_this}.
 */
(function(global){
  "use strict";

  var STRINGS = global.I18N_STRINGS = global.I18N_STRINGS || {};

  var LANGS = [
    {code:"en", label:"English"},
    {code:"ru", label:"Русский"},
    {code:"de", label:"Deutsch"},
    {code:"es", label:"Español"},
    {code:"fr", label:"Français"},
    {code:"ja", label:"日本語"},
    {code:"zh", label:"中文"}
  ];

  var LANG_KEY = "flute.lang";
  var FALLBACK = "en";

  var remembered = global.Prefs.get;    /* prefs.js */
  var keep = global.Prefs.set;

  function known(code){
    for(var i = 0; i < LANGS.length; i++){
      if(LANGS[i].code === code){ return true; }
    }
    return false;
  }

  var current = remembered(LANG_KEY, null);
  if(!known(current)){ current = FALLBACK; }

  /* ---------- lookup ---------- */
  function raw(key){
    var here = STRINGS[current];
    if(here && here[key] !== undefined){ return here[key]; }
    var back = STRINGS[FALLBACK];
    if(back && back[key] !== undefined){ return back[key]; }
    return null;
  }

  function fill(text, params){
    if(!params){ return text; }
    return text.replace(/\{(\w+)\}/g, function(whole, name){
      return params[name] === undefined ? whole : String(params[name]);
    });
  }

  /* An untranslated key shows as the key itself -- loud enough to notice in
     testing, harmless enough not to break the page. */
  function t(key, params){
    var value = raw(key);
    if(value === null){ return key; }
    if(typeof value !== "string"){ value = value.other || key; }
    return fill(value, params);
  }

  /* Russian needs один такт / два такта / пять тактов, and the teens are all
     тактов; French and Spanish need their own splits. Intl.PluralRules knows
     every one of them, so the translations only have to supply the forms. */
  function plural(key, n, params){
    var value = raw(key);
    if(value === null){ return key; }

    var form;
    if(typeof value === "string"){
      form = value;
    } else {
      var category = "other";
      try { category = new Intl.PluralRules(current).select(n); } catch(e){}
      form = value[category] !== undefined ? value[category] : value.other;
    }

    var merged = {n:n};
    for(var k in params){ merged[k] = params[k]; }
    return fill(form, merged);
  }

  /* ---------- markup ---------- */
  /* data-i18n fills textContent, the -html variant allows the <br> and <b> in
     the longer hints, and the rest set attributes. */
  var ATTRS = [
    ["data-i18n-title", "title"],
    ["data-i18n-aria", "aria-label"],
    ["data-i18n-placeholder", "placeholder"]
  ];

  function apply(root){
    root = root || document;

    var texts = root.querySelectorAll("[data-i18n]");
    for(var i = 0; i < texts.length; i++){
      texts[i].textContent = t(texts[i].getAttribute("data-i18n"));
    }

    var htmls = root.querySelectorAll("[data-i18n-html]");
    for(i = 0; i < htmls.length; i++){
      htmls[i].innerHTML = t(htmls[i].getAttribute("data-i18n-html"));
    }

    ATTRS.forEach(function(pair){
      var nodes = root.querySelectorAll("[" + pair[0] + "]");
      for(var j = 0; j < nodes.length; j++){
        nodes[j].setAttribute(pair[1], t(nodes[j].getAttribute(pair[0])));
      }
    });

    document.documentElement.lang = current;
  }

  /* ---------- redraws ---------- */
  /* Canvas and SVG text cannot be swept the way the DOM can; the pages
     subscribe here and redraw themselves. */
  var listeners = [];

  function onChange(fn){ listeners.push(fn); }

  function set(code){
    if(!known(code) || code === current){ return; }
    current = code;
    keep(LANG_KEY, code);
    apply(document);
    listeners.forEach(function(fn){ fn(code); });
  }

  /* ---------- the switcher ---------- */
  function mountSwitcher(host){
    if(!host){ return null; }
    var sel = document.createElement("select");
    sel.className = "btn lang";
    sel.id = "lang";
    sel.setAttribute("aria-label", t("lang.pick"));
    LANGS.forEach(function(l){
      var opt = document.createElement("option");
      opt.value = l.code;
      opt.textContent = l.label;      /* endonyms -- never translated */
      sel.appendChild(opt);
    });
    sel.value = current;
    sel.addEventListener("change", function(){ set(this.value); });
    onChange(function(){ sel.setAttribute("aria-label", t("lang.pick")); });
    host.appendChild(sel);
    return sel;
  }

  global.I18n = {
    LANGS: LANGS,
    lang: function(){ return current; },
    set: set,
    t: t,
    plural: plural,
    apply: apply,
    onChange: onChange,
    mountSwitcher: mountSwitcher
  };
})(window);
