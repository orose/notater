#!/usr/bin/env node
/* global process, console */
/**
 * Kontrastkontroll for v2 – presentasjonsmodus (designsystem §12.10).
 *
 *   node docs/design/kontrast-v2.mjs          → laveste verdi per kontroll + sammendrag, exit 1 ved brudd
 *   node docs/design/kontrast-v2.mjs --json   → maskinlesbart resultat (for QA)
 *
 * Leser palettene fra tokens.css, regner ut de avledede v2-fargene (letterbox, oversikt) med samme
 * color-mix(in oklab, …) som CSS, og sjekker alle nye flater/kombinasjoner i presentasjonen mot WCAG 2.1
 * (tekst ≥ 4.5, ikke-tekst ≥ 3) i alle 3 typesett × 4 paletter × 2 moduser = 24 kombinasjoner.
 * Typesettet avgjør enkelte flater (Terminal: invertert gjeldende agendapunkt, properties og kanban på surface).
 * Ingen avhengigheter – kun node ≥ 18.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'tokens.css'), 'utf8');

const palettes = {};
for (const m of css.matchAll(/\[data-palette="(\w+)"\]\[data-mode="(\w+)"\]\s*\{([^}]*)\}/g)) {
  const vars = {};
  for (const d of m[3].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[d[1]] = d[2].toLowerCase();
  palettes[`${m[1]}/${m[2]}`] = vars;
}
if (Object.keys(palettes).length !== 8) throw new Error(`Forventet 8 palett×modus-blokker, fant ${Object.keys(palettes).length}`);

// Speil av letterbox-reglene i tokens.css – feiler høyt om de endres der uten at skriptet følger med.
const lbLight = css.match(/\[data-mode="light"\]\s*\{\s*--color-letterbox:\s*color-mix\(in oklab, var\(--color-text\) (\d+)%, var\(--color-bg\)\)/);
const lbDark = css.match(/\[data-mode="dark"\]\s*\{\s*--color-letterbox:\s*color-mix\(in oklab, #000 (\d+)%, var\(--color-bg\)\)/);
if (!lbLight || !lbDark) throw new Error('Fant ikke --color-letterbox-reglene i tokens.css (skriptet må oppdateres)');
const LB_LIGHT = +lbLight[1] / 100, LB_DARK = +lbDark[1] / 100;

/* ---------- Fargematte (som kontrast-v1.1.mjs) ---------- */
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgb2hex = (c) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const toLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLin = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function rgb2oklab([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklab2rgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(fromLin);
}
const mix = (a, p, b) => { const A = rgb2oklab(hex2rgb(a)), B = rgb2oklab(hex2rgb(b)); return rgb2hex(oklab2rgb(A.map((v, i) => v * p + B[i] * (1 - p)))); };
const lum = (h) => { const [r, g, b] = hex2rgb(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/* ---------- Avledede tokens (speiler tokens.css) ---------- */
function derive(p, mode) {
  const t = { ...p };
  t['color-tag-bg'] = mix(p['color-accent'], 0.12, p['color-bg']);
  t['color-letterbox'] = mode === 'light' ? mix(p['color-text'], LB_LIGHT, p['color-bg']) : mix('#000000', LB_DARK, p['color-bg']);
  t['color-overview-bg'] = t['color-letterbox'];
  t['color-head'] = p['color-muted'];
  t['color-head-current'] = p['color-text'];
  t['color-head-mark'] = p['color-accent'];
  t['color-progress'] = p['color-accent'];
  t['color-agenda-past'] = p['color-muted'];
  t['color-agenda-current'] = p['color-accent'];
  t['color-thumb-current'] = p['color-accent'];
  t['color-thumb-cursor'] = p['color-focus'];
  t['color-letterbox-edge'] = p['color-muted'];
  t['code-bg'] = p['shiki-background'];
  return t;
}

/* [hva, forgrunn, bakgrunn (token eller fn(type,t)), krav, bare-for-typesett?] */
const onCard = (type, t) => (type === 'tidsskrift' ? t['color-bg'] : t['color-surface']);   // kanban-kort/bane, properties
const checks = [
  // Agendalinjen (kolumnetittel) og folio
  ['agendalinje: andre punkter (muted) på bg', 'color-head', 'color-bg', 4.5],
  ['agendalinje: gjeldende punkt på bg', 'color-head-current', 'color-bg', 4.5],
  ['agendalinje: strek under gjeldende (ikke-tekst)', 'color-head-mark', 'color-bg', 3],
  ['folio «7 / 13» og notattittel på bg', 'color-muted', 'color-bg', 4.5],
  ['fremdrift: fyll mot bg', 'color-progress', 'color-bg', 3],
  ['live-prikk «oppdatert» (hue-green) mot bg', 'hue-green', 'color-bg', 3],
  // Tittel-, agenda- og overgangslysbilder
  ['agenda: punkt på bg', 'color-text', 'color-bg', 4.5],
  ['agenda: «§ n»/nummer (aksent) på bg', 'color-accent', 'color-bg', 4.5],
  ['agenda: lysbildenummer i høyre kolonne (muted)', 'color-muted', 'color-bg', 4.5],
  ['overgang: tidligere punkt (dempet)', 'color-agenda-past', 'color-bg', 4.5],
  ['overgang: gjeldende punkt (aksent)', 'color-agenda-current', 'color-bg', 4.5],
  ['overgang: markørstrek ved gjeldende (ikke-tekst)', 'color-agenda-current', 'color-bg', 3],
  ['overgang Terminal: invertert rad (bg på tekst)', 'color-bg', 'color-text', 4.5, 'terminal'],
  ['tittel: ingress (muted) på bg', 'color-muted', 'color-bg', 4.5],
  ['tittel: properties-etikett (muted) på flate', 'color-muted', onCard, 4.5],
  ['tittel: properties-verdi på flate', 'color-text', onCard, 4.5],
  // Innhold
  ['innhold: «(forts.)» (muted) på bg', 'color-muted', 'color-bg', 4.5],
  ['innhold: fotnote (muted) på bg', 'color-muted', 'color-bg', 4.5],
  ['innhold: fotnotenummer (aksent) på bg', 'color-accent', 'color-bg', 4.5],
  ['kanban: korttittel på kort', 'color-text', onCard, 4.5],
  ['kanban: metadata (muted) på kort', 'color-muted', onCard, 4.5],
  ['kanban: kolonnehode (muted) på bane', 'color-muted', (type, t) => (type === 'tidsskrift' ? t['color-bg'] : t['color-surface']), 4.5],
  ['stor blokk: rullehint (muted) på kodeflate', 'color-muted', 'code-bg', 4.5],
  ['stor blokk: rullehint (muted) på bg', 'color-muted', 'color-bg', 4.5],
  ['feil: E475/E486 (hue-red) på bg', 'hue-red', 'color-bg', 4.5],
  ['feil: E475/E486 (hue-red) på surface', 'hue-red', 'color-surface', 4.5],
  // Letterbox, oversikt og mobilkontroller
  ['letterbox: tekst', 'color-text', 'color-letterbox', 4.5],
  ['letterbox: dempet tekst (bildetekst, mobil-folio)', 'color-muted', 'color-letterbox', 4.5],
  ['letterbox: knappekant (letterbox-edge = muted)', 'color-letterbox-edge', 'color-letterbox', 3],
  ['oversikt: «nå»-ramme (aksent) mot bakgrunn', 'color-thumb-current', 'color-overview-bg', 3],
  ['oversikt: markør (fokus) mot bakgrunn', 'color-thumb-cursor', 'color-overview-bg', 3],
  ['oversikt: markør (fokus) mot miniatyr (bg)', 'color-thumb-cursor', 'color-bg', 3],
  ['oversikt: «NÅ»-merke (bg på aksent)', 'color-bg', 'color-thumb-current', 4.5],
  ['oversikt: lysbildenummer (aksent) mot bakgrunn', 'color-accent', 'color-overview-bg', 4.5],
  ['oversikt/hint: tekst på surface', 'color-text', 'color-surface', 4.5],
  ['oversikt/hint: dempet på surface', 'color-muted', 'color-surface', 4.5],
];

const types = ['tidsskrift', 'terminal', 'klartekst'];
const rows = [];
let fails = 0;
for (const type of types) {
  for (const [key, pal] of Object.entries(palettes)) {
    const t = derive(pal, key.split('/')[1]);
    for (const [what, fg, bg, min, only] of checks) {
      if (only && only !== type) continue;
      const bgHex = typeof bg === 'function' ? bg(type, t) : t[bg];
      const r = ratio(t[fg], bgHex);
      const ok = r >= min;
      if (!ok) fails++;
      rows.push({ type, palette: key, what, fg: t[fg], bg: bgHex, ratio: +r.toFixed(2), min, ok });
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ checks: rows.length, fails, rows }, null, 2));
} else {
  const worst = new Map();
  for (const r of rows) if (!worst.has(r.what) || r.ratio < worst.get(r.what).ratio) worst.set(r.what, r);
  console.log('Laveste verdi per kontroll (av 24 kombinasjoner):\n');
  for (const [what, r] of worst) console.log(`${r.ok ? 'ok ' : 'FEIL'}  ${String(r.ratio.toFixed(2)).padStart(5)}  (krav ${r.min})  ${what.padEnd(50)} ${r.palette} · ${r.type}`);
  console.log('\nAvledet letterbox per palett:');
  for (const [key, pal] of Object.entries(palettes)) console.log(`  ${key.padEnd(16)} ${derive(pal, key.split('/')[1])['color-letterbox']}`);
  console.log(`\n${rows.length} kontroller, ${fails} brudd.`);
}
process.exit(fails ? 1 : 0);
