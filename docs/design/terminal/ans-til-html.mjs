#!/usr/bin/env node
/* global process, console, document */
/**
 * ANSI-mockups → HTML → PNG (designsystem-terminal.md §9).
 *
 *   node docs/design/terminal/ans-til-html.mjs                 alle mockups/*.ans → skjermbilder/v3/*.png
 *   node docs/design/terminal/ans-til-html.mjs 08 31           bare filer som starter med 08 eller 31
 *   node docs/design/terminal/ans-til-html.mjs --html <mappe>  behold HTML-filene i <mappe>
 *   node docs/design/terminal/ans-til-html.mjs --bredde 1440   vindusbredde i px (standard 1440, se under)
 *
 * Filnavnet bærer størrelsen: «…-120x36-…ans». Alle størrelser tegnes i SAMME vindusbredde, slik et delt
 * Ghostty-vindu i Teams ser ut: 80 kolonner gir stor skrift, 200 kolonner liten. Det er poenget med §1.4.
 *
 * Tolker SGR (fet, kursiv, understrek med stil og farge 58, revers, 16 farger, 256, truecolor med ; og :)
 * og OSC 8-lenker. Rammetegn (U+2500–257F) og blokker (U+2580–259F) tegnes som masker over hele cellen,
 * slik Ghostty gjør, ellers blir det glipper mellom radene. Font: JetBrains Mono fra node_modules,
 * DejaVu Sans Mono som reserve for piler og geometriske tegn. Playwright: forhåndsinstallert nettleser.
 */
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..', '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const BREDDE = +opt('--bredde', 1440);
const htmlDir = opt('--html', null) ?? mkdtempSync(join(tmpdir(), 'v3-html-'));
mkdirSync(htmlDir, { recursive: true });
const mockDir = join(here, 'mockups');
const utDir = join(here, '..', 'skjermbilder', 'v3');
mkdirSync(utDir, { recursive: true });

/* Eksempeltema for «terminalens egne farger» (ansi16): et vanlig mørkt og et vanlig lyst tema.
 * Bare til illustrasjon – i virkeligheten eier brukerens Ghostty-tema disse fargene. */
const TEMA = {
  dark: { fg: '#c5c8c6', bg: '#1d1f21', ansi: ['#1d1f21', '#cc6666', '#b5bd68', '#f0c674', '#81a2be', '#b294bb', '#8abeb7', '#c5c8c6', '#666666', '#d54e53', '#b9ca4a', '#e7c547', '#7aa6da', '#c397d8', '#70c0b1', '#eaeaea'] },
  light: { fg: '#4d4d4c', bg: '#ffffff', ansi: ['#000000', '#c82829', '#718c00', '#eab700', '#4271ae', '#8959a8', '#3e999f', '#d6d6d6', '#8e908c', '#c82829', '#718c00', '#b58900', '#4271ae', '#8959a8', '#3e999f', '#4d4d4c'] },
};

/* ---------- Rammetegn og blokker som masker ---------- */
const BOX = {"─":"l:l r:l","━":"l:h r:h","│":"u:l d:l","┃":"u:h d:h","┄":"l:l r:l dash:3","┅":"l:h r:h dash:3","┆":"u:l d:l dash:3","┇":"u:h d:h dash:3","┈":"l:l r:l dash:4","┉":"l:h r:h dash:4","┊":"u:l d:l dash:4","┋":"u:h d:h dash:4","┌":"d:l r:l","┍":"d:l r:h","┎":"d:h r:l","┏":"d:h r:h","┐":"d:l l:l","┑":"d:l l:h","┒":"d:h l:l","┓":"d:h l:h","└":"u:l r:l","┕":"u:l r:h","┖":"u:h r:l","┗":"u:h r:h","┘":"u:l l:l","┙":"u:l l:h","┚":"u:h l:l","┛":"u:h l:h","├":"u:l d:l r:l","┝":"u:l d:l r:h","┞":"u:h r:h d:l","┟":"d:h r:h u:l","┠":"u:h d:h r:l","┡":"d:l r:l u:h","┢":"u:l r:l d:h","┣":"u:h d:h r:h","┤":"u:l d:l l:l","┥":"u:l d:l l:h","┦":"u:h l:h d:l","┧":"d:h l:h u:l","┨":"u:h d:h l:l","┩":"d:l l:l u:h","┪":"u:l l:l d:h","┫":"u:h d:h l:h","┬":"d:l l:l r:l","┭":"l:h r:h d:l","┮":"r:h l:h d:l","┯":"d:l l:h r:h","┰":"d:h l:l r:l","┱":"r:l l:l d:h","┲":"l:l r:l d:h","┳":"d:h l:h r:h","┴":"u:l l:l r:l","┵":"l:h r:h u:l","┶":"r:h l:h u:l","┷":"u:l l:h r:h","┸":"u:h l:l r:l","┹":"r:l l:l u:h","┺":"l:l r:l u:h","┻":"u:h l:h r:h","┼":"u:l d:l l:l r:l","┽":"l:h r:h u:l d:l","┾":"r:h l:h u:l d:l","┿":"u:l d:l l:h r:h","╀":"u:h d:h l:l r:l","╁":"d:h u:h l:l r:l","╂":"u:h d:h l:l r:l","╃":"u:h r:h d:l","╄":"u:h l:h d:l","╅":"d:h r:h u:l","╆":"d:h l:h u:l","╇":"d:l u:l l:h r:h","╈":"u:l d:l l:h r:h","╉":"r:l l:l u:h d:h","╊":"l:l r:l u:h d:h","╋":"u:h d:h l:h r:h","╌":"l:l r:l dash:2","╍":"l:h r:h dash:2","╎":"u:l d:l dash:2","╏":"u:h d:h dash:2","═":"l:d r:d","║":"u:d d:d","╒":"d:l r:d","╓":"d:d r:l","╔":"d:d r:d","╕":"d:l l:d","╖":"d:d l:l","╗":"d:d l:d","╘":"u:l r:d","╙":"u:d r:l","╚":"u:d r:d","╛":"u:l l:d","╜":"u:d l:l","╝":"u:d l:d","╞":"u:l d:l r:d","╟":"u:d d:d r:l","╠":"u:d d:d r:d","╡":"u:l d:l l:d","╢":"u:d d:d l:l","╣":"u:d d:d l:d","╤":"d:l l:d r:d","╥":"d:d l:l r:l","╦":"d:d l:d r:d","╧":"u:l l:d r:d","╨":"u:d l:l r:l","╩":"u:d l:d r:d","╪":"u:l d:l l:d r:d","╫":"u:d d:d l:l r:l","╬":"u:d d:d l:d r:d","╭":"d:l r:l arc:1","╮":"d:l l:l arc:1","╯":"u:l l:l arc:1","╰":"u:l r:l arc:1","╱":"diag:ur","╲":"diag:ul","╳":"diag:x","╴":"l:l","╵":"u:l","╶":"r:l","╷":"d:l","╸":"l:h","╹":"u:h","╺":"r:h","╻":"d:h","╼":"l:h r:h","╽":"u:h d:h","╾":"l:l r:l","╿":"u:l d:l"};
const W = 10, H = 20, cx = 5, cy = 10, G = 1.6;
let TL = 1.25, TH = 2.6; // settes per fil: aldri tynnere enn 1 px (lett) / 2 px (tung), som Ghostty
function boxSvg(spec) {
  const s = Object.fromEntries(spec.split(' ').map((p) => p.split(':')));
  const p = [];
  const line = (x1, y1, x2, y2, t, cap = 'square') => p.push(`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#000" stroke-width="${t}" stroke-linecap="${cap}" fill="none"/>`);
  if (s.diag) {
    if (s.diag !== 'ul') line(W, 0, 0, H, TL, 'butt');
    if (s.diag !== 'ur') line(0, 0, W, H, TL, 'butt');
    return p.join('');
  }
  if (s.dash) {
    const n = +s.dash, t = s.l === 'h' || s.u === 'h' ? TH : TL;
    if (s.l) { const seg = W / n; p.push(`<path d="M0 ${cy}H${W}" stroke="#000" stroke-width="${t}" stroke-dasharray="${seg * 0.62} ${seg * 0.38}" stroke-dashoffset="${-seg * 0.19}"/>`); }
    else { const seg = H / n; p.push(`<path d="M${cx} 0V${H}" stroke="#000" stroke-width="${t}" stroke-dasharray="${seg * 0.62} ${seg * 0.38}" stroke-dashoffset="${-seg * 0.19}"/>`); }
    return p.join('');
  }
  const dirs = ['u', 'd', 'l', 'r'].filter((d) => s[d]);
  const end = { u: [cx, 0], d: [cx, H], l: [0, cy], r: [W, cy] };
  if (s.arc) {
    const v = dirs.find((d) => d === 'u' || d === 'd'), h = dirs.find((d) => d === 'l' || d === 'r');
    const [vx, vy] = end[v], [hx] = end[h];
    const r = 4.5, sy = v === 'd' ? 1 : -1, sx = h === 'r' ? 1 : -1;
    p.push(`<path d="M${vx} ${vy}V${cy + sy * r}Q${cx} ${cy} ${cx + sx * r} ${cy}H${hx}" stroke="#000" stroke-width="${TL}" fill="none"/>`);
    return p.join('');
  }
  const dbl = dirs.filter((d) => s[d] === 'd');
  if (dbl.length) {
    // dobbeltstreker: rette linjer og hjørner (det ANSI Shadow bruker); andre kombinasjoner tilnærmes
    const v = dirs.filter((d) => d === 'u' || d === 'd'), h = dirs.filter((d) => d === 'l' || d === 'r');
    if (v.length === 1 && h.length === 1) {
      const sv = v[0] === 'd' ? 1 : -1, sh = h[0] === 'r' ? 1 : -1;
      for (const o of [-1, 1]) {
        const x = cx + o * sh * G, y = cy + o * sv * G;
        p.push(`<path d="M${x} ${sv > 0 ? H : 0}V${y}H${sh > 0 ? W : 0}" stroke="#000" stroke-width="${TL}" fill="none"/>`);
      }
      return p.join('');
    }
    if (v.length === 2 && !h.length) { for (const o of [-G, G]) line(cx + o, 0, cx + o, H, TL, 'butt'); return p.join(''); }
    if (h.length === 2 && !v.length) { for (const o of [-G, G]) line(0, cy + o, W, cy + o, TL, 'butt'); return p.join(''); }
    for (const d of dirs) for (const o of [-G, G]) { const [x, y] = end[d]; if (d === 'u' || d === 'd') line(cx + o, cy, x + o, y, TL); else line(cx, cy + o, x, y + o, TL); }
    return p.join('');
  }
  const tmax = Math.max(...dirs.map((d) => (s[d] === 'h' ? TH : TL)));
  for (const d of dirs) {
    const t = s[d] === 'h' ? TH : TL, [x, y] = end[d];
    // segment fra sentrum til kanten, forlenget med halv tykkeste strek så skjøtene blir tette
    const ext = tmax / 2;
    if (d === 'u') p.push(`<rect x="${cx - t / 2}" y="0" width="${t}" height="${cy + ext}"/>`);
    if (d === 'd') p.push(`<rect x="${cx - t / 2}" y="${cy - ext}" width="${t}" height="${H - cy + ext}"/>`);
    if (d === 'l') p.push(`<rect x="0" y="${cy - t / 2}" width="${cx + ext}" height="${t}"/>`);
    if (d === 'r') p.push(`<rect x="${cx - ext}" y="${cy - t / 2}" width="${W - cx + ext}" height="${t}"/>`);
    void x; void y;
  }
  return p.join('');
}
const q = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const BLOKK = {
  '▀': q(0, 0, W, H / 2), '▄': q(0, H / 2, W, H / 2), '█': q(0, 0, W, H), '▌': q(0, 0, W / 2, H), '▐': q(W / 2, 0, W / 2, H),
  '▔': q(0, 0, W, H / 8), '▁': q(0, H * 7 / 8, W, H / 8), '▂': q(0, H * 6 / 8, W, H * 2 / 8), '▃': q(0, H * 5 / 8, W, H * 3 / 8),
  '▅': q(0, H * 3 / 8, W, H * 5 / 8), '▆': q(0, H * 2 / 8, W, H * 6 / 8), '▇': q(0, H / 8, W, H * 7 / 8),
  '▏': q(0, 0, W / 8, H), '▎': q(0, 0, W / 4, H), '▍': q(0, 0, W * 3 / 8, H), '▕': q(W * 7 / 8, 0, W / 8, H),
  '▖': q(0, H / 2, W / 2, H / 2), '▗': q(W / 2, H / 2, W / 2, H / 2), '▘': q(0, 0, W / 2, H / 2), '▝': q(W / 2, 0, W / 2, H / 2),
  '▙': q(0, 0, W / 2, H) + q(W / 2, H / 2, W / 2, H / 2), '▛': q(0, 0, W, H / 2) + q(0, H / 2, W / 2, H / 2),
  '▜': q(0, 0, W, H / 2) + q(W / 2, H / 2, W / 2, H / 2), '▟': q(W / 2, 0, W / 2, H) + q(0, H / 2, W / 2, H / 2),
  '▚': q(0, 0, W / 2, H / 2) + q(W / 2, H / 2, W / 2, H / 2), '▞': q(W / 2, 0, W / 2, H / 2) + q(0, H / 2, W / 2, H / 2),
};
/** Skriftstørrelse slik at cellebredden blir hele piksler (JetBrains Mono: 0,6 em per tegn) */
const fontPx = (cols) => Math.floor(BREDDE / (cols + 2)) / 0.6;
const glyfSvg = (ch) => BLOKK[ch] ?? (BOX[ch] ? boxSvg(BOX[ch]) : null);
const maskeCss = new Map();
function maskeKlasse(ch) {
  if (!maskeCss.has(ch)) {
    // rette streker og blokker snappes til pikselrutenettet (som Ghostty); buer og diagonaler glattes
    const skarp = !/arc|diag/.test(BOX[ch] ?? '') ? ' shape-rendering="crispEdges"' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"${skarp}>${glyfSvg(ch)}</svg>`;
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    maskeCss.set(ch, `.g${ch.codePointAt(0).toString(16)}{-webkit-mask:${url} 0 0/100% 100% no-repeat;mask:${url} 0 0/100% 100% no-repeat}`);
  }
  return `g${ch.codePointAt(0).toString(16)}`;
}

/* ---------- ANSI-tolking ---------- */
const SGR = new RegExp(`^${String.fromCharCode(27)}\\[([\\d;:]*)m`);
const idx256 = (n, tema) => {
  if (n < 16) return tema.ansi[n];
  if (n < 232) { n -= 16; const v = (k) => (k ? 55 + k * 40 : 0); return '#' + [Math.floor(n / 36), Math.floor(n / 6) % 6, n % 6].map((k) => v(k).toString(16).padStart(2, '0')).join(''); }
  const g = (8 + (n - 232) * 10).toString(16).padStart(2, '0'); return '#' + g + g + g;
};
function tolk(tekst, cols, rows, tema) {
  const tom = () => ({ ch: ' ', fg: null, bg: null, b: 0, i: 0, ul: 0, uc: null, rev: 0, dim: 0, link: null });
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, tom));
  let st = tom(), x = 0, y = 0, link = null;
  const farge = (ps, k) => {
    // ps: liste av parametre (tall), k: indeks til 38/48/58. Returnerer [farge, antall forbrukt]
    if (ps[k + 1] === 2) return [`#${[ps[k + 2], ps[k + 3], ps[k + 4]].map((v) => (+v).toString(16).padStart(2, '0')).join('')}`, 5];
    if (ps[k + 1] === 5) return [idx256(ps[k + 2], tema), 3];
    return [null, 1];
  };
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (c === '\x1b' && tekst[i + 1] === '[') {
      const m = SGR.exec(tekst.slice(i, i + 64));
      if (!m) continue;
      i += m[0].length - 1;
      const grupper = m[1] === '' ? ['0'] : m[1].split(';');
      // normaliser: «38:2::r:g:b» → [38,2,r,g,b]; «4:3» → understrekstil
      const ps = []; const sub = [];
      for (const g of grupper) {
        if (g.includes(':')) { const d = g.split(':'); if ((d[0] === '38' || d[0] === '48' || d[0] === '58') && d[1] === '2') { ps.push(+d[0], 2, +d.at(-3), +d.at(-2), +d.at(-1)); } else if (d[1] === '5') ps.push(+d[0], 5, +d[2]); else { ps.push(+d[0]); sub[ps.length - 1] = +d[1]; } } else ps.push(+g);
      }
      for (let k = 0; k < ps.length; k++) {
        const p = ps[k];
        if (p === 0) st = tom();
        else if (p === 1) st.b = 1; else if (p === 2) st.dim = 1; else if (p === 3) st.i = 1;
        else if (p === 4) st.ul = sub[k] ?? 1; else if (p === 7) st.rev = 1;
        else if (p === 22) { st.b = 0; st.dim = 0; } else if (p === 23) st.i = 0; else if (p === 24) st.ul = 0; else if (p === 27) st.rev = 0;
        else if (p >= 30 && p <= 37) st.fg = tema.ansi[p - 30]; else if (p >= 90 && p <= 97) st.fg = tema.ansi[p - 82];
        else if (p >= 40 && p <= 47) st.bg = tema.ansi[p - 40]; else if (p >= 100 && p <= 107) st.bg = tema.ansi[p - 92];
        else if (p === 39) st.fg = null; else if (p === 49) st.bg = null; else if (p === 59) st.uc = null;
        else if (p === 38 || p === 48 || p === 58) { const [f, n] = farge(ps, k); if (p === 38) st.fg = f; else if (p === 48) st.bg = f; else st.uc = f; k += n - 1; }
      }
      continue;
    }
    if (c === '\x1b' && tekst[i + 1] === ']') {
      const slutt = tekst.indexOf('\x1b\\', i);
      const innhold = tekst.slice(i + 2, slutt);
      if (innhold.startsWith('8;')) link = innhold.split(';').slice(2).join(';') || null;
      i = slutt + 1;
      continue;
    }
    if (c === '\n') { y++; x = 0; continue; }
    if (c === '\r') { x = 0; continue; }
    const cp = tekst.codePointAt(i); const ch = String.fromCodePoint(cp); if (cp > 0xffff) i++;
    if (y < rows && x < cols) grid[y][x] = { ...st, ch, link };
    x++;
  }
  return grid;
}

/* ---------- HTML ---------- */
const fontDir = join(repo, 'node_modules', '@fontsource-variable', 'jetbrains-mono', 'files');
const font = (f) => pathToFileURL(join(fontDir, f)).href;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const latin = (ch) => { const c = ch.codePointAt(0); return c < 0x250 || (c >= 0x2018 && c <= 0x201e) || c === 0x2026 || c === 0x2013 || c === 0x2014 || c === 0x2022 || c === 0x2191 || c === 0x2193 || c === 0x20ac; };

function html(grid, cols, rows, tema, tittel) {
  const fs = fontPx(cols); // hele piksler per celle, ellers blir det sømmer mellom blokktegn
  const css = [];
  const rader = grid.map((rad) => {
    let ut = '', run = null;
    const lukk = () => { if (run) { ut += `<span style="${run.stil}">${esc(run.t)}</span>`; run = null; } };
    for (const c of rad) {
      let fg = c.fg ?? tema.fg, bg = c.bg ?? tema.bg;
      if (c.rev) [fg, bg] = [bg, fg];
      const stil = [`color:${fg}`, `background:${bg}`, c.b ? 'font-weight:700' : '', c.i ? 'font-style:italic' : '', c.dim ? 'opacity:.6' : '',
        c.ul ? `text-decoration:underline ${{ 1: 'solid', 2: 'double', 3: 'wavy', 4: 'dotted', 5: 'dashed' }[c.ul] ?? 'solid'} ${c.uc ?? fg};text-decoration-thickness:max(1.5px,.07em);text-underline-offset:.18em` : ''].filter(Boolean).join(';');
      if (glyfSvg(c.ch)) { lukk(); ut += `<span class="c" style="background:${bg}"><i class="m ${maskeKlasse(c.ch)}" style="background:${fg}"></i></span>`; continue; }
      if (!latin(c.ch)) { lukk(); ut += `<span class="c" style="${stil}">${esc(c.ch)}</span>`; continue; }
      if (run && run.stil === stil) run.t += c.ch; else { lukk(); run = { stil, t: c.ch }; }
    }
    lukk();
    return `<div class="r">${ut}</div>`;
  });
  for (const v of maskeCss.values()) css.push(v);
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>${esc(tittel)}</title><style>
@font-face{font-family:JBM;src:url("${font('jetbrains-mono-latin-wght-normal.woff2')}") format("woff2");font-weight:100 800;font-style:normal}
@font-face{font-family:JBM;src:url("${font('jetbrains-mono-latin-ext-wght-normal.woff2')}") format("woff2");font-weight:100 800;font-style:normal;unicode-range:U+0100-024F,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:JBM;src:url("${font('jetbrains-mono-latin-wght-italic.woff2')}") format("woff2");font-weight:100 800;font-style:italic}
html,body{margin:0;background:${(() => { const c = grid[Math.floor(rows / 2)][0]; return c.rev ? c.fg ?? tema.fg : c.bg ?? tema.bg; })()}}
body{padding:${Math.round(fs * 0.6)}px ${Math.round(fs * 0.6)}px;font:${fs.toFixed(3)}px/1 JBM,"DejaVu Sans Mono",monospace;font-variant-ligatures:none;font-feature-settings:"calt" 0;-webkit-font-smoothing:antialiased}
.r{height:${Math.round(fs * 1.2)}px;white-space:pre;display:flex}
.r>span{display:inline-block;height:100%;line-height:${Math.round(fs * 1.2)}px;flex:none}
.c{width:${(fs * 0.6).toFixed(3)}px;text-align:center;overflow:visible;position:relative}
.m{position:absolute;inset:-.4px}
${css.join('\n')}
</style></head><body>${rader.join('')}</body></html>`;
}

/* ---------- Kjør ---------- */
const filter = args.filter((a) => !a.startsWith('--'));
const filer = readdirSync(mockDir).filter((f) => f.endsWith('.ans') && (!filter.length || filter.some((p) => f.startsWith(p)))).sort();
const { chromium } = await import(pathToFileURL(join(repo, 'node_modules', 'playwright', 'index.mjs')).href);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const f of filer) {
  const m = /-(\d+)x(\d+)/.exec(f);
  if (!m) { console.warn(`hopper over ${f}: mangler «-<kol>x<rader>» i navnet`); continue; }
  const [cols, rows] = [+m[1], +m[2]];
  const tema = /ansi16-lys/.test(f) ? TEMA.light : TEMA.dark;
  maskeCss.clear();
  { const cellH = Math.round(fontPx(cols) * 1.2); TL = Math.max(1.25, 1.0 * H / cellH); TH = Math.max(2.6, 2.0 * H / cellH); }
  const grid = tolk(readFileSync(join(mockDir, f), 'utf8'), cols, rows, tema);
  const h = html(grid, cols, rows, tema, f);
  const hf = join(htmlDir, f.replace(/\.ans$/, '.html'));
  writeFileSync(hf, h);
  const fs = fontPx(cols);
  await page.setViewportSize({ width: Math.round(fs * 0.6 * (cols + 2)), height: Math.round(fs * 1.2) * rows + Math.round(fs * 1.2) });
  await page.goto(pathToFileURL(hf).href);
  await page.evaluate(() => document.fonts.ready);
  const png = join(utDir, f.replace(/\.ans$/, '.png'));
  await page.screenshot({ path: png, fullPage: true });
  console.log(`${basename(png)}  ${cols}×${rows}`);
}
await browser.close();
console.log(`HTML i ${htmlDir}`);
