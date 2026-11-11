#!/usr/bin/env node
/* global process, console */
/**
 * Kontrastkontroll for terminalpresentasjonen (v3), designsystem-terminal.md §6.4.
 *
 *   node docs/design/terminal/kontrast-terminal.mjs          → tabell + sammendrag, exit 1 ved brudd
 *   node docs/design/terminal/kontrast-terminal.mjs --json   → maskinlesbart resultat (for QA)
 *
 * Leser farger.json (truecolor-rollene) og sjekker hver kombinasjon av forgrunn og bakgrunn som faktisk
 * tegnes i terminalen, mot WCAG 2.1 (tekst ≥ 4,5, ikke-tekst ≥ 3). ansi16-modusen kan ikke kontrolleres:
 * der eier terminaltemaet fargene (se §6.3).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const F = JSON.parse(readFileSync(join(here, 'farger.json'), 'utf8'));

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (h) => { const [r, g, b] = hex2rgb(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** [navn, forgrunn, bakgrunn, krav] – krav 4.5 = tekst, 3 = ikke-tekst/stor figlet, 0 = bare rapport (dekor). */
function kontroller({ roller: r, kode, kulor }) {
  const k = [];
  const T = 4.5, NT = 3;
  for (const f of ['tekst', 'dempet', 'aksent', 'aksent2', 'lenke', 'lenke_brutt', 'feil', 'ok']) k.push([`${f} / bg`, r[f], r.bg, T]);
  for (const f of ['tekst', 'dempet', 'aksent', 'feil']) k.push([`${f} / linje_bg (tabline, statuslinje, flytevindu)`, r[f], r.linje_bg, T]);
  k.push(['tekst / kode_bg', r.kode_tekst, r.kode_bg, T]);
  k.push(['dempet / kode_bg (linjenumre, rullehint)', r.dempet, r.kode_bg, T]);
  k.push(['aksent / kode_bg (prikk i kodehodet)', r.aksent, r.kode_bg, NT]);
  for (const [t, c] of Object.entries(kode)) k.push([`kode.${t} / kode_bg`, c, r.kode_bg, T]);
  k.push(['invertert_tekst / invertert_bg («du er her»)', r.invertert_tekst, r.invertert_bg, T]);
  k.push(['invertert_tekst / aksent (merkene NÅ og OVERSIKT)', r.invertert_tekst, r.aksent, T]);
  k.push(['tekst / linje_bg (inline-kode)', r.tekst, r.linje_bg, T]);
  k.push(['markor_tekst / markor_bg (oversikt, notatliste)', r.markor_tekst, r.markor_bg, T]);
  // Markørraden er ensfarget (§5.1): sti, dato og treff tegnes i markor_tekst, så dempet/markor_bg finnes ikke.
  k.push(['tekst / treff_bg (fuzzy-treff)', r.tekst, r.treff_bg, T]);
  for (const [h, c] of Object.entries(kulor)) k.push([`kulør.${h} / bg (callout-etikett og ramme)`, c, r.bg, T]);
  k.push(['hode / bg (figlet-fyll)', r.hode, r.bg, T]);
  k.push(['strek / bg (rammer)', r.strek, r.bg, NT]);
  k.push(['fremdrift / linje_bg', r.fremdrift, r.linje_bg, NT]);
  k.push(['fokus / bg', r.fokus, r.bg, NT]);
  k.push(['hode_skygge / bg (dekor)', r.hode_skygge, r.bg, 0]);
  k.push(['dekor / bg (ledere, hårstreker)', r.dekor, r.bg, 0]);
  k.push(['fremdrift_spor / linje_bg (dekor, formen ─ bærer)', r.fremdrift_spor, r.linje_bg, 0]);
  return k;
}

const resultat = [];
for (const [palett, moduser] of Object.entries(F.truecolor)) {
  for (const [modus, sett] of Object.entries(moduser)) {
    for (const [navn, fg, bg, krav] of kontroller(sett)) {
      const v = ratio(fg, bg);
      resultat.push({ palett, modus, navn, fg, bg, krav, verdi: +v.toFixed(2), ok: krav === 0 || v >= krav });
    }
  }
}
const brudd = resultat.filter((r) => !r.ok);
const sjekket = resultat.filter((r) => r.krav > 0);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ kontroller: sjekket.length, brudd: brudd.length, resultat }, null, 2));
} else {
  const navn = [...new Set(resultat.map((r) => r.navn))];
  const kombos = [...new Set(resultat.map((r) => `${r.palett}/${r.modus}`))];
  console.log(`Kontroll${' '.repeat(52)}laveste   (palett/modus)   krav`);
  for (const n of navn) {
    const rs = resultat.filter((r) => r.navn === n).sort((a, b) => a.verdi - b.verdi);
    const lav = rs[0];
    const merke = rs.some((r) => !r.ok) ? '  ✗ BRUDD' : '';
    console.log(`${n.padEnd(60)}${lav.verdi.toFixed(2).padStart(7)}   ${`${lav.palett}/${lav.modus}`.padEnd(16)} ${lav.krav || 'dekor'}${merke}`);
  }
  console.log(`\n${sjekket.length} kontroller (${navn.length} per kombinasjon × ${kombos.length} kombinasjoner, dekor ikke medregnet), ${brudd.length} brudd.`);
  for (const b of brudd) console.log(`  ✗ ${b.palett}/${b.modus}  ${b.navn}: ${b.verdi} (${b.fg} på ${b.bg}, krav ${b.krav})`);
}
process.exit(brudd.length ? 1 : 0);
