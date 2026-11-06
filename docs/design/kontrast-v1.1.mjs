#!/usr/bin/env node
/**
 * Kontrastkontroll for v1.1-tokens (designsystem §11.9).
 *
 *   node docs/design/kontrast-v1.1.mjs          → tabell + sammendrag, exit 1 ved brudd
 *   node docs/design/kontrast-v1.1.mjs --json   → maskinlesbart resultat (for QA)
 *
 * Leser alle palett × modus-blokker fra tokens.css, regner ut de avledede v1.1-fargene med samme
 * color-mix(in oklab, …) som CSS bruker, og sjekker hver ny kombinasjon mot WCAG 2.1 (tekst ≥ 4.5,
 * ikke-tekst ≥ 3). Kontrast avhenger bare av palett × modus, men flatene varierer med typesett
 * (f.eks. which-key på surface i alle sett, statuslinje-flagg på surface i Terminal og bg ellers),
 * så vi går gjennom alle 3 × 4 × 2 = 24 kombinasjoner eksplisitt.
 * Ingen avhengigheter – kun node ≥ 18.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'tokens.css'), 'utf8');

/* ---------- 1. Les palettene ---------- */
const palettes = {};
for (const m of css.matchAll(/\[data-palette="(\w+)"\]\[data-mode="(\w+)"\]\s*\{([^}]*)\}/g)) {
  const vars = {};
  for (const d of m[3].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[d[1]] = d[2].toLowerCase();
  palettes[`${m[1]}/${m[2]}`] = vars;
}
if (Object.keys(palettes).length !== 8) throw new Error(`Forventet 8 palett×modus-blokker, fant ${Object.keys(palettes).length}`);

/* ---------- 2. Fargematte: sRGB ↔ OKLab, color-mix, kontrast ---------- */
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgb2hex = (c) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const toLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLin = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function rgb2oklab([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklab2rgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLin);
}
/** color-mix(in oklab, a p, b) for opake farger */
const mix = (a, p, b) => {
  const A = rgb2oklab(hex2rgb(a)), B = rgb2oklab(hex2rgb(b));
  return rgb2hex(oklab2rgb(A.map((v, i) => v * p + B[i] * (1 - p))));
};
/** halvtransparent farge (alpha) lagt over en opak bakgrunn – nettleseren kompositter i sRGB */
const over = (fg, alpha, bg) => rgb2hex(hex2rgb(fg).map((v, i) => v * alpha + hex2rgb(bg)[i] * (1 - alpha)));
const lum = (h) => { const [r, g, b] = hex2rgb(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/* ---------- 3. Avledede tokens (speiler tokens.css – endres de der, endre her) ---------- */
function derive(p) {
  const t = { ...p };
  t['color-tag-bg'] = mix(p['color-accent'], 0.12, p['color-bg']);
  t['color-kbd-bg'] = mix(p['color-sunken'], 0.55, p['color-surface']);
  t['color-kbd-fg'] = p['color-text'];
  t['color-kbd-edge'] = p['color-rule-strong'];
  t['color-kbd-edge-active'] = p['color-muted'];
  t['color-row-active'] = t['color-tag-bg'];
  t['color-cmd'] = p['color-accent'];
  t['color-disabled'] = p['color-muted'];
  t['color-src-rule'] = p['color-rule-strong'];
  t['color-veil-on-bg'] = over(p['color-bg'], 0.92, p['color-text']); // verste fall: slør over svart/hvit tekst
  return t;
}

/* ---------- 4. Kontrollene ---------- */
// [hva, forgrunn, bakgrunn, krav, typesett-filter?]  – bakgrunn kan være en funksjon av typesett
const surfaceFor = (type, t) => (type === 'tidsskrift' ? t['color-bg'] : t['color-surface']);
const checks = [
  // Tasttegn (refcard, palett, which-key, Utseende)
  ['kbd: tekst på tasttegn', 'color-kbd-fg', 'color-kbd-bg', 4.5],
  ['kbd: «+»/«eller» på tasttegn', 'color-muted', 'color-kbd-bg', 4.5],
  ['kbd: leder-tast (aksent) på tasttegn', 'color-cmd', 'color-kbd-bg', 4.5],
  ['kbd: kant mot bg', 'color-kbd-edge', 'color-bg', 3],
  ['kbd: kant mot surface', 'color-kbd-edge', 'color-surface', 3],
  ['kbd: kant mot valgt rad (kbd-edge-active)', 'color-kbd-edge-active', 'color-row-active', 3],
  // Palett: kommandomodus
  ['palett: «:»-prompt på bg', 'color-cmd', 'color-bg', 4.5],
  ['palett: tekst på valgt rad', 'color-text', 'color-row-active', 4.5],
  ['palett: beskrivelse på valgt rad', 'color-muted', 'color-row-active', 4.5],
  ['palett: treff-understrek (aksent) på valgt rad', 'color-cmd', 'color-row-active', 4.5],
  ['palett: deaktivert kommando på bg', 'color-disabled', 'color-bg', 4.5],
  ['palett: deaktivert kommando på valgt rad', 'color-disabled', 'color-row-active', 4.5],
  ['palett: fokusring på valgt rad', 'color-focus', 'color-row-active', 3],
  // Which-key, showcmd, zen-hint (flate = surface i alle sett)
  ['which-key: tekst på flate', 'color-text', 'color-surface', 4.5],
  ['which-key: beskrivelse på flate', 'color-muted', 'color-surface', 4.5],
  ['which-key: tast (aksent) på flate', 'color-cmd', 'color-surface', 4.5],
  ['which-key: kant mot bg', 'color-rule-strong', 'color-bg', 3],
  // Statuslinje-flagg [full] [diskré] (surface i Terminal, bg ellers)
  ['statuslinje: flagg', 'color-muted', (type, t) => surfaceFor(type === 'terminal' ? 'terminal' : 'tidsskrift', t), 4.5],
  ['statuslinje: flagg hover (aksent)', 'color-accent', (type, t) => surfaceFor(type === 'terminal' ? 'terminal' : 'tidsskrift', t), 4.5],
  // Folding
  ['fold: chevron/−+ i hvile (dempet)', 'color-muted', 'color-bg', 3],
  ['fold: chevron hover (aksent)', 'color-accent', 'color-bg', 3],
  ['fold: «n ord skjult»-linje', 'color-muted', 'color-bg', 4.5],
  ['fold: fokusring', 'color-focus', 'color-bg', 3],
  // Diskré embedding
  ['diskré: kildelenke (dempet)', 'color-muted', 'color-bg', 4.5],
  ['diskré: kildelenke hover (lenke)', 'color-link', 'color-bg', 4.5],
  ['diskré: hover-klamme', 'color-src-rule', 'color-bg', 3],
  // Zen
  ['zen: utgang-knapp og hint på flate', 'color-muted', 'color-surface', 4.5],
  ['zen: tekst gjennom slør (verste fall)', 'color-muted', 'color-veil-on-bg', 4.5],
];

const types = ['tidsskrift', 'terminal', 'klartekst'];
const rows = [];
let fails = 0;
for (const type of types) {
  for (const [key, pal] of Object.entries(palettes)) {
    const t = derive(pal);
    for (const [what, fg, bg, min] of checks) {
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
  // Laveste verdi per kontroll på tvers av alle 24 kombinasjoner
  const worst = new Map();
  for (const r of rows) if (!worst.has(r.what) || r.ratio < worst.get(r.what).ratio) worst.set(r.what, r);
  console.log('Laveste verdi per kontroll (av 24 kombinasjoner):\n');
  for (const [what, r] of worst) {
    console.log(`${r.ok ? 'ok ' : 'FEIL'}  ${String(r.ratio.toFixed(2)).padStart(5)}  (krav ${r.min})  ${what.padEnd(46)} ${r.palette} · ${r.type}`);
  }
  console.log('\nAvledede v1.1-farger per palett:');
  for (const [key, pal] of Object.entries(palettes)) {
    const t = derive(pal);
    console.log(`  ${key.padEnd(16)} kbd-bg ${t['color-kbd-bg']}  row-active ${t['color-row-active']}`);
  }
  console.log(`\n${rows.length} kontroller (${checks.length} × 24 kombinasjoner), ${fails} brudd.`);
}
process.exit(fails ? 1 : 0);
