/* Which instrument the pages are showing, and the register the instruments
 * themselves sign into.
 *
 * Load this after notenames.js and before instruments/*.js, songimport.js and
 * the page code -- each instrument module calls register() as it loads, and
 * everything downstream asks current() what it is drawing for.
 *
 * An instrument definition looks like this (see instruments/flute.js for the
 * worked example):
 *
 *   id          "flute"
 *   nameKey     translation key for the display name
 *   range       {lo, hi} in MIDI numbers -- what songimport aims a line at
 *   has(pitch)  can this instrument play it?
 *   clefFor(p)  "treble" or "bass"
 *   chart       the diagram: width/height, diagram(), at(), and the wider
 *               hWidth/hHeight/horizontal() form for the panel on game.html
 *   reference   index.html: notes(), draw(), legend(), hintKey
 *   copy        the keys for wording that differs per instrument
 *
 * Modelled on i18n.js and theme.js: a remembered choice, validated against what
 * is actually registered, with listeners that redraw. The pages cannot restyle
 * their way through an instrument change -- the diagrams are different shapes --
 * so every one of them subscribes.
 */
(function(global){
  "use strict";

  var KEY = "flute.instrument";
  var FALLBACK = "flute";

  var LIST = [];
  var BY_ID = {};
  var listeners = [];

  /* Read before anything has registered, so it cannot be validated yet; get()
     resolves it lazily on the first current() instead. */
  var wanted = global.Prefs.get(KEY, null);
  var currentId = null;

  function register(def){
    if(!def || !def.id || BY_ID[def.id]){ return; }
    BY_ID[def.id] = def;
    LIST.push(def);
  }

  function current(){
    if(currentId && BY_ID[currentId]){ return BY_ID[currentId]; }
    currentId = BY_ID[wanted] ? wanted
              : BY_ID[FALLBACK] ? FALLBACK
              : (LIST[0] || {}).id;
    return BY_ID[currentId] || null;
  }

  function set(id){
    if(!BY_ID[id] || id === current().id){ return; }
    currentId = id;
    wanted = id;
    global.Prefs.set(KEY, id);
    listeners.forEach(function(fn){ fn(BY_ID[id]); });
  }

  function onChange(fn){ listeners.push(fn); }

  function name(def){ return global.I18n.t(def.nameKey); }

  /* Sits next to the language switcher, and looks like it: the topbar on all
     three pages is styled by theme.css's `select.lang` rule, which this borrows
     rather than duplicating. */
  function mountPicker(host){
    if(!host){ return null; }
    var sel = document.createElement("select");
    sel.className = "btn lang instrument";
    sel.id = "instrument";

    function relabel(){
      sel.setAttribute("aria-label", global.I18n.t("instrument.pick"));
      for(var i = 0; i < sel.options.length; i++){
        sel.options[i].textContent = name(BY_ID[sel.options[i].value]);
      }
    }

    LIST.forEach(function(def){
      var opt = document.createElement("option");
      opt.value = def.id;
      opt.textContent = name(def);
      sel.appendChild(opt);
    });
    sel.value = current().id;
    sel.addEventListener("change", function(){ set(this.value); });
    global.I18n.onChange(relabel);
    relabel();
    host.appendChild(sel);
    return sel;
  }

  /* The reference drawings are built node by node rather than from markup --
     the piano's keys have to be clickable -- so both instruments want this. */
  var SVGNS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs, text){
    var n = document.createElementNS(SVGNS, name);
    for(var k in attrs){ n.setAttribute(k, attrs[k]); }
    if(text !== undefined){ n.textContent = text; }
    return n;
  }

  function clear(node){
    while(node.firstChild){ node.removeChild(node.firstChild); }
  }

  global.Instruments = {
    register: register,
    svgEl: svgEl,
    clear: clear,
    list: function(){ return LIST.slice(); },
    get: function(id){ return BY_ID[id] || null; },
    current: current,
    set: set,
    name: name,
    onChange: onChange,
    mountPicker: mountPicker
  };
})(window);
