/* global localStorage, URLSearchParams, location, matchMedia, document */
/* Vault-leser: setter tema-attributtene på <html> FØR første maling, slik at feil tema aldri blinker.
   Lastes synkront fra <head> i index.html (ekstern fil i stedet for inline-script, så den virker med
   CSP `script-src 'self'` – PO-16). Samme regler som src/web/features/theme/theme-state.ts. */
(function () {
  var KEY = 'vault-leser.tema';
  var ALLOWED = {
    mode: ['system', 'light', 'dark'],
    type: ['tidsskrift', 'terminal', 'klartekst'],
    palette: ['papir', 'cyanotypi', 'fosfor', 'signal'],
  };
  var d = { mode: 'system', type: 'tidsskrift', palette: 'papir', ornaments: true };
  function set(k, v) {
    if (ALLOWED[k] && ALLOWED[k].indexOf(v) !== -1) d[k] = v;
  }
  try {
    var s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') {
      set('mode', s.mode); set('type', s.type); set('palette', s.palette);
      if (typeof s.ornaments === 'boolean') d.ornaments = s.ornaments;
    }
  } catch { /* privat modus eller ødelagt verdi: bruk standard */ }
  try {
    var q = new URLSearchParams(location.search);
    set('mode', q.get('mode')); set('type', q.get('type')); set('palette', q.get('palette'));
    if (q.get('ornaments')) d.ornaments = q.get('ornaments') !== 'off';
  } catch { /* ignorer */ }
  var dark = false;
  try { dark = d.mode === 'dark' || (d.mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); } catch { /* ignorer */ }
  var r = document.documentElement;
  r.dataset.type = d.type;
  r.dataset.palette = d.palette;
  r.dataset.mode = dark ? 'dark' : 'light';
  r.dataset.modePref = d.mode;
  r.dataset.ornaments = d.ornaments ? 'on' : 'off';
  /* F1 lesebredde (ADR-008): samme regler som src/web/features/view-settings/view-state.ts. */
  try {
    var w = JSON.parse(localStorage.getItem('vault-leser.visning') || 'null');
    if (w && w.v === 1 && w.width === 'full') r.dataset.width = 'full';
  } catch { /* ignorer */ }
})();
