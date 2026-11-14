#!/usr/bin/env node
/* global console */
/**
 * Lager docs/design/terminal/farger.json: fargeroller for terminalpresentasjonen (v3), designsystem-terminal.md §6.
 *
 *   node docs/design/terminal/lag-farger.mjs
 *
 * Kilde: palettene i docs/design/tokens.css (kanonisk). Avledede roller (linje-bg, skygge i figlet-hodet …) regnes
 * ut med samme color-mix(in oklab, …) som CSS bruker. Ingen nye råverdier, bortsett fra #000000 til svart skjerm.
 * Kontrasten kontrolleres med kontrast-terminal.mjs. Ingen avhengigheter – kun node ≥ 18.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'tokens.css'), 'utf8');

const palettes = {};
for (const m of css.matchAll(/\[data-palette="(\w+)"\]\[data-mode="(\w+)"\]\s*\{([^}]*)\}/g)) {
  const vars = {};
  for (const d of m[3].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[d[1]] = d[2].toLowerCase();
  (palettes[m[1]] ??= {})[m[2]] = vars;
}

/* ---------- oklab-blanding (som kontrast-v2.mjs) ---------- */
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
/** color-mix(in oklab, a p, b) */
const mix = (a, p, b) => { const A = rgb2oklab(hex2rgb(a)), B = rgb2oklab(hex2rgb(b)); return rgb2hex(oklab2rgb(A.map((v, i) => v * p + B[i] * (1 - p)))); };

/* ---------- Roller (truecolor) ---------- */
const KODE = ['foreground', 'keyword', 'string', 'comment', 'constant', 'function', 'parameter', 'punctuation',
  'string-expression', 'link', 'number', 'type', 'property', 'operator'];
const HUES = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'plum', 'grey'];

function roller(p, modus) {
  const r = {
    bg: p['color-bg'],                     // lerretet (hele terminalen males, også margene)
    tekst: p['color-text'],
    dempet: p['color-muted'],              // sekundærtekst, tastehint, tidligere agendapunkter (≥ 4,5)
    dekor: p['color-faint'],               // KUN dekor: prikkede ledere, hårstreker, sporet i fremdriften
    strek: p['color-rule-strong'],         // rammer på callouts/tabeller/plassholdere (≥ 3 mot bg)
    aksent: p['color-accent'],
    aksent2: p['color-accent2'],
    lenke: p['color-link'],
    lenke_brutt: p['color-link-broken'],
    // tabline/statuslinje/flytevinduer: et tydelig, men stille bånd (surface er for nær bg i mørke paletter)
    linje_bg: mix(p['color-text'], modus === 'dark' ? 0.08 : 0.07, p['color-bg']),
    flate_bg: mix(p['color-text'], modus === 'dark' ? 0.08 : 0.07, p['color-bg']), // flytevinduer og inline-kode (= linje_bg i truecolor)
    kode_bg: p['shiki-background'],        // = sunken
    kode_tekst: p['shiki-foreground'],
    // «du er her» på overgang = vims cursorline invertert: tekst på tekstfarge
    invertert_bg: p['color-text'],
    invertert_tekst: p['color-bg'],
    // markør i lister (oversikt, notatliste): seleksjonsfargen, som i leseren
    markor_bg: p['color-selection'],
    markor_tekst: p['color-text'],
    treff_bg: p['color-mark'],             // fuzzy-treff på markørraden og i søk
    fokus: p['color-focus'],
    // figlet-hodet: fyllet (█) i aksent, skyggen (╔═╗║) som dekor
    hode: p['color-accent'],
    hode_skygge: mix(p['color-accent'], 0.45, p['color-bg']),
    fremdrift: p['color-accent'],
    fremdrift_spor: p['color-faint'],  // dekor (som --color-progress-track i v2); gjenstående tegnes med ─, ferdig med ━
    feil: p['hue-red'],
    ok: p['hue-green'],
    svart: '#000000',
  };
  const kode = Object.fromEntries(KODE.map((k) => [k, p[`shiki-${k === 'foreground' ? 'foreground' : 'token-' + k}`]]));
  const kulor = Object.fromEntries(HUES.map((h) => [h, p[`hue-${h}`]]));
  return { roller: r, kode, kulor };
}

/* ---------- «Terminalens egne farger» (16 ANSI-farger) ----------
 * Verdiene er SGR-forgrunnsindekser (0–15) eller "default" (39/49). Bakgrunn bruker samme indeks (40–47/100–107).
 * Lys/mørk velges ved oppstart fra terminalens bakgrunn (OSC 11), ellers COLORFGBG, ellers mørk.
 * Aksenten følger valgt palett, slik at --palett fortsatt betyr noe.                                      */
const ansiAksent = {
  papir: { dark: 9, light: 1 }, cyanotypi: { dark: 12, light: 4 }, fosfor: { dark: 10, light: 2 }, signal: { dark: 11, light: 1 },
};
function ansi16(modus) {
  const d = modus === 'dark';
  return {
    roller: {
      bg: 'default', tekst: 'default',
      dempet: d ? 7 : 8, dekor: d ? 8 : 7, strek: d ? 8 : 8,
      aksent: 'palett', aksent2: d ? 14 : 6, lenke: 'palett', lenke_brutt: d ? 7 : 8,
      linje_bg: 'revers', // tabline-fyll og statuslinje: SGR 7 som vims StatusLine/TabLineFill (reverse,bold)
      flate_bg: 'default', // flytevinduer: ingen fyll, bare rammen; inline-kode: kode.string uten bakgrunn
      kode_bg: 'default', kode_tekst: 'default',
      invertert_bg: 'default-fg', invertert_tekst: 'default-bg', // SGR 7 (reverse video)
      markor_bg: 'default-fg', markor_tekst: 'default-bg', treff_bg: 'default',
      fokus: d ? 11 : 3, hode: 'palett', hode_skygge: 8, fremdrift: 'palett', fremdrift_spor: 8,
      feil: d ? 9 : 1, ok: d ? 10 : 2, svart: 0,
    },
    kode: {
      foreground: 'default', keyword: d ? 13 : 5, string: d ? 10 : 2, comment: `${d ? 8 : 8}+kursiv`,
      constant: d ? 11 : 3, function: d ? 12 : 4, parameter: 'default', punctuation: d ? 7 : 8,
      'string-expression': d ? 14 : 6, link: d ? 12 : 4, number: d ? 11 : 3, type: d ? 14 : 6,
      property: d ? 12 : 4, operator: d ? 13 : 5,
    },
    kulor: { blue: d ? 12 : 4, teal: d ? 14 : 6, green: d ? 10 : 2, amber: d ? 11 : 3, orange: d ? 11 : 3, red: d ? 9 : 1, plum: d ? 13 : 5, grey: d ? 7 : 8 },
  };
}

const out = {
  $schema: 'designsystem-terminal.md §6',
  beskrivelse: 'Fargeroller for terminalpresentasjonen (v3). Generert av lag-farger.mjs fra tokens.css – ikke rediger for hånd.',
  standard: { palett: 'fosfor', modus: 'system' },
  truecolor: {},
  ansi16: {
    merknad: 'Tall er ANSI-indekser 0–15 (0–7: SGR 30–37/40–47, 8–15: SGR 90–97/100–107). "default" = SGR 39/49. "default-fg"/"default-bg" i invertert/markør = SGR 7 (reverse). "palett" = aksentAvPalett. "+kursiv" = SGR 3 i tillegg. linje_bg "revers": tabline-fyll og statuslinje tegnes med SGR 7 (som vims standard StatusLine), og valgt fane står uten revers.',
    aksentAvPalett: ansiAksent,
    dark: ansi16('dark'),
    light: ansi16('light'),
  },
};
for (const [navn, moduser] of Object.entries(palettes)) {
  out.truecolor[navn] = {};
  for (const modus of ['light', 'dark']) out.truecolor[navn][modus] = roller(moduser[modus], modus);
}
writeFileSync(join(here, 'farger.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`farger.json: ${Object.keys(palettes).length} paletter × 2 moduser + ansi16 (lys/mørk)`);
