/* Which theme the pages wear, remembered between visits.
 *
 * Load this in <head>, right after prefs.js and the stylesheet: it sets the
 * attribute before the page is painted, so a reader who chose one of the dark
 * themes never sees a flash of the light palette first.
 *
 * The themes themselves all live in theme.css. Anything drawn from script --
 * the instrument diagrams, the canvas, the charts -- reads the tokens back with
 * colourOf() or token() rather than keeping its own copy.
 *
 * Modelled on i18n.js: a remembered choice validated against a known list,
 * with listeners for the things a stylesheet cannot reach.
 */
(function(global){
  "use strict";

  var KEY = "flute.theme";
  var FALLBACK = "light";

  /* light carries no attribute, so it is also what a page shows before any
     script has run */
  var THEMES = [
    {id:"light",  nameKey:"theme.light",  attr:null},
    {id:"dark",   nameKey:"theme.dark",   attr:"dark"},
    {id:"studio", nameKey:"theme.studio", attr:"studio"}
  ];

  function known(id){
    for(var i = 0; i < THEMES.length; i++){
      if(THEMES[i].id === id){ return THEMES[i]; }
    }
    return null;
  }

  /* Light is the default, as with the language: the reader asks for a dark
     theme rather than having the operating system ask on their behalf. */
  var current = known(global.Prefs.get(KEY, null)) ? global.Prefs.get(KEY, null) : FALLBACK;

  var listeners = [];

  function paint(){
    var attr = known(current).attr;
    if(attr){
      document.documentElement.setAttribute("data-theme", attr);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  paint();   /* before first paint, hence the <head> placement */

  function set(next){
    if(!known(next) || next === current){ return; }
    current = next;
    global.Prefs.set(KEY, next);
    paint();
    listeners.forEach(function(fn){ fn(next); });
  }

  /* One read of the cascade, for the canvas and the hand-built SVG. Call it
     again after a theme change -- the values are different by then. */
  function token(name){
    return getComputedStyle(document.documentElement)
      .getPropertyValue("--" + name).trim();
  }

  function onChange(fn){ listeners.push(fn); }

  /* Sits next to the language and instrument pickers and looks like them: the
     topbar on all three pages is styled by theme.css's `select.lang` rule,
     which this borrows rather than duplicating. */
  function mountPicker(host){
    if(!host){ return null; }
    var sel = document.createElement("select");
    sel.className = "btn lang theme";
    sel.id = "theme";

    function relabel(){
      sel.setAttribute("aria-label", global.I18n.t("theme.pick"));
      for(var i = 0; i < sel.options.length; i++){
        sel.options[i].textContent = global.I18n.t(known(sel.options[i].value).nameKey);
      }
    }

    THEMES.forEach(function(t){
      var opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = global.I18n.t(t.nameKey);
      sel.appendChild(opt);
    });
    sel.value = current;
    sel.addEventListener("change", function(){ set(this.value); });
    global.I18n.onChange(relabel);
    /* the theme can be set from somewhere other than this control, so follow it
       rather than assuming this select is the only way in */
    onChange(function(next){ sel.value = next; });
    relabel();
    host.appendChild(sel);
    return sel;
  }

  global.Theme = {
    THEMES: THEMES,
    get: function(){ return current; },
    isDark: function(){ return current !== "light"; },
    set: set,
    onChange: onChange,
    token: token,
    colourOf: token,       /* the same read, named for the usual case */
    mountPicker: mountPicker
  };
})(window);
