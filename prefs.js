/* Everything the browser remembers between visits, under one roof.
 *
 * Private browsing and a full quota both make localStorage throw, and neither
 * is worth interrupting a lesson over, so every call swallows its own failure
 * and falls back to the default.
 *
 * Keys in use: flute.lang, flute.theme, flute.instrument, flute.song,
 * flute.userSongs.
 */
(function(global){
  "use strict";

  global.Prefs = {
    get: function(key, fallback){
      try {
        var raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch(e){ return fallback; }
    },

    set: function(key, value){
      try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){}
    }
  };
})(window);
