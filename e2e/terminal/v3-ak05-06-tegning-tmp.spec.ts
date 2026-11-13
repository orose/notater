// AK-3-05 Kode, tabeller, callouts og Bases-tabell tegnes lesbart med farger og rammetegn ved 80×24, 120×36 og 200×50.
// AK-3-06 Mermaid-blokker, kanban-views og bilder vises som diskret plassholder med forklaring; ingen krasj eller ødelagt tegning.
// + kanttilfeller: æøå/emoji/bredde-2-tegn, veldig lange ord og URL-er (OSC 8), kode og tabell bredere enn terminalen.
// Testplan: TC-3-05-*, TC-3-06-*. Fasit: v3-fasit.json › innhold, plassholdere, kanter.
import {
  cellerFor,
  expect,
  fargeNøkkel,
  fasit3,
  fasitNotat,
  gåTilLysbilde,
  innholdsflate,
  osc8Mål,
  presenterNotat,
  rullHeleBlokken,
  skjøtt,
  skjøttHardt,
  STANDARDSTØRRELSER,
  statuslinje,
  test,
  visningsbredde,
} from '../support/terminal-tmp';

const f = fasit3 as unknown as {
  innhold: {
    kode: { notat: string; lysbilde: number; inneholder: string[]; linje001?: string }[];
    tabeller: { notat: string; lysbilde: number; inneholder?: string[]; kolonner?: number; rader?: number; celleMønster?: string }[];
    fotnoter: { notat: string; lysbilde: number; tekst: string }[];
    rammetegn: string;
    callouts: { notat: string; lysbilde: number; etiketter: string[] };
  };
  plassholdere: { steder: { notat: string; lysbilde: number; type: string; tekst: string; ikke?: string[] }[] };
};
const RAMME = new RegExp(`[${f.innhold.rammetegn}]`);
const navn = (s: { cols: number; rows: number }) => `${s.cols}×${s.rows}`;
const kanter = fasit3.kanter;

test.describe('AK-3-05 kode, tabeller, callouts, Bases-tabell', () => {
  for (const s of STANDARDSTØRRELSER) {
    test(`TC-3-05-01 kode med Shiki-farger (truecolor) ved ${navn(s)}`, async ({ present }) => {
      const k = f.innhold.kode[0]!;
      const t = await presenterNotat(present, fasitNotat(k.notat).sti, { størrelse: s });
      const rader = await gåTilLysbilde(t, k.lysbilde);
      for (const m of k.inneholder) expect(skjøtt(rader)).toContain(m);
      const kodeRader = t.celler().filter((r) => r.map((c) => c.tegn).join('').includes('PageDown') || r.map((c) => c.tegn).join('').includes('PRESENT_BINDINGS'));
      const farger = new Set(kodeRader.flat().filter((c) => c.tegn.trim()).map((c) => fargeNøkkel(c.fg)));
      expect(farger.size, 'minst tre syntaksfarger').toBeGreaterThanOrEqual(3);
      expect([...farger].every((x) => x.startsWith('#')), 'truecolor (38;2)').toBe(true);
    });

    test(`TC-3-05-02 tabell med rammetegn og fotnote nederst ved ${navn(s)}`, async ({ present }) => {
      const tab = f.innhold.tabeller[0]!;
      const fot = f.innhold.fotnoter[0]!;
      const t = await presenterNotat(present, fasitNotat(tab.notat).sti, { størrelse: s });
      const rader = await gåTilLysbilde(t, tab.lysbilde);
      for (const m of tab.inneholder!) expect(skjøtt(rader), m).toContain(m);
      expect(rader.some((r) => RAMME.test(r)), 'rammetegn').toBe(true);
      const flate = innholdsflate(rader, fasitNotat(tab.notat).agenda);
      const fotRad = flate.findIndex((r) => r.includes(fot.tekst.slice(0, 20)));
      const sisteTabellRad = flate.map((r) => RAMME.test(r)).lastIndexOf(true);
      expect(fotRad, 'fotnoten står under tabellen').toBeGreaterThan(sisteTabellRad);
      expect(statuslinje(rader)).not.toContain(fot.tekst.slice(0, 10));
    });

    test(`TC-3-05-03 callouts med ramme og etikett ved ${navn(s)}`, async ({ present }) => {
      const c = f.innhold.callouts;
      const t = await presenterNotat(present, kanter.sti, { størrelse: s });
      const rader = await gåTilLysbilde(t, c.lysbilde);
      for (const e of c.etiketter) expect(skjøtt(rader)).toContain(e);
      for (const m of kanter.lysbilder[c.lysbilde - 1]!.inneholder!) expect(skjøtt(rader).replace(/[│┃║]/g, ' ').replace(/\s+/g, ' ')).toContain(m);
      // Lang linje i callouten brytes innenfor rammen: hver rad med venstrekant har også høyrekant.
      const medKant = rader.filter((r) => /^\s*[│┃║]/.test(r));
      expect(medKant.length).toBeGreaterThan(0);
    });

    test(`TC-3-05-04 Bases-tabell (inline base, view «Kritisk») med rammetegn ved ${navn(s)}`, async ({ present }) => {
      const l = kanter.lysbilder[6]! as unknown as { basetabell: { rader: string[] } };
      const t = await presenterNotat(present, kanter.sti, { størrelse: s });
      const rader = await gåTilLysbilde(t, 7);
      for (const navn of l.basetabell.rader) expect(skjøtt(rader), navn).toContain(navn);
      expect(rader.some((r) => RAMME.test(r))).toBe(true);
      // Fasitrekkefølgen (sortert på due synkende, bases-fasit.json › Sprintoversikt blokk 1).
      const pos = l.basetabell.rader.map((n) => skjøtt(rader).indexOf(n));
      expect(pos).toEqual([...pos].sort((a, b) => a - b));
    });
  }

  test('TC-3-05-05 kodeblokk bredere enn 80 kolonner: linjene brytes med fortsettelsesmerke ↪, ingen tegn tapt (ADR-011 §4)', async ({ present }) => {
    const k = f.innhold.kode[1]!;
    const t = await presenterNotat(present, fasitNotat(k.notat).sti, { størrelse: { cols: 80, rows: 24 } });
    await gåTilLysbilde(t, k.lysbilde);
    expect(skjøttHardt(t.skjerm())).toContain(k.linje001!.replace(/\s/g, ''));
    for (const rad of t.skjerm()) expect(visningsbredde(rad)).toBeLessThanOrEqual(80);
  });

  for (const s of [{ cols: 80, rows: 24 }, { cols: 200, rows: 50 }]) {
    test(`TC-3-05-06 tabell med 12 kolonner × 40 rader ved ${navn(s)}: alle 480 celler synlige (rulling), ingen avkuttet`, async ({ present }) => {
      const tab = f.innhold.tabeller[1]!;
      const t = await presenterNotat(present, fasitNotat(tab.notat).sti, { størrelse: s });
      await gåTilLysbilde(t, tab.lysbilde);
      const sett = new Set<string>();
      for (const skjerm of await rullHeleBlokken(t)) for (const m of skjerm.join(' ').matchAll(/R\d{2}K\d{2}/g)) sett.add(m[0]);
      expect(sett.size).toBe(tab.kolonner! * tab.rader!);
    });

    test(`TC-3-05-07 tabell med 10 kolonner ved ${navn(s)}: alle celler hele (også «Ærlig»)`, async ({ present }) => {
      const t = await presenterNotat(present, kanter.sti, { størrelse: s });
      await gåTilLysbilde(t, 9);
      const tekst = (await rullHeleBlokken(t)).map((r) => r.join(' ')).join(' ');
      for (const m of kanter.lysbilder[8]!.inneholder!) expect(tekst).toContain(m);
      expect(new Set(tekst.match(/T\dK\d{2}/g)).size).toBe(29);
    });
  }

  for (const s of STANDARDSTØRRELSER) {
    test(`TC-3-05-08 æøå, emoji, bredde-2-tegn og kombinerende tegn ved ${navn(s)}`, async ({ present }) => {
      const l = kanter.lysbilder[3]!;
      const t = await presenterNotat(present, kanter.sti, { størrelse: s });
      const rader = await gåTilLysbilde(t, 4);
      expect(skjøtt(rader)).toContain(l.overskrift!);
      for (const m of l.inneholder!) expect(skjøttHardt(rader), m).toContain(m.replace(/\s/g, ''));
      // A + U+0308 vises som én celle (Ä), ikke «A¨» og ikke forskjøvet.
      expect(skjøtt(rader).normalize('NFC')).toContain('«Ä»');
      for (const rad of rader) expect(visningsbredde(rad), `rad «${rad.trim().slice(0, 30)}»`).toBeLessThanOrEqual(s.cols);
      // Statuslinjen er ikke forskjøvet av bredde-2-tegn: «n/N» står helt til høyre.
      expect(statuslinje(rader)).toMatch(/4\s*\/\s*11\s*$/);
    });

    test(`TC-3-05-09 veldig lange ord og URL-er brytes hardt uten tap ved ${navn(s)}, lenker er OSC 8`, async ({ present }) => {
      const l = kanter.lysbilder[10]! as unknown as { inneholder: string[]; lenker: { tekst: string; url: string }[] };
      const t = await presenterNotat(present, kanter.sti, { størrelse: s });
      const rader = await gåTilLysbilde(t, 11);
      for (const m of l.inneholder) expect(skjøttHardt(rader), m.slice(0, 30)).toContain(m.replace(/\s/g, ''));
      const mål = osc8Mål(t.råstrøm());
      for (const lenke of l.lenker) expect(mål, `OSC 8 for ${lenke.url}`).toContain(lenke.url);
      // Lenketeksten er markert (understrek eller lenkefarge).
      const celler = cellerFor(t.celler(), l.lenker[0]!.tekst.slice(0, 12)) ?? [];
      expect(celler.some((c) => c.understrek || c.fg.kind !== 'standard')).toBe(true);
    });
  }
});

test.describe('AK-3-05 lenker (OSC 8, PO-109)', () => {
  const l = (fasit3 as unknown as { lenker: { intern: { notat: string; lysbilde: number; tekst: string; prefiks: string; fil: string }; utenStotte: { miljo: Record<string, string> } } }).lenker;

  test('TC-3-05-10 intern lenke får OSC 8 til obsidian://open?vault=…&file=…', async ({ present }) => {
    const t = await presenterNotat(present, fasitNotat(l.intern.notat).sti);
    await gåTilLysbilde(t, l.intern.lysbilde);
    const mål = osc8Mål(t.råstrøm()).find((u) => u.startsWith(l.intern.prefiks));
    expect(mål, 'OSC 8 med obsidian://open').toBeDefined();
    const url = new URL(mål!);
    expect(url.searchParams.get('vault')).toBeTruthy();
    expect(url.searchParams.get('file')?.replace(/\.md$/, '')).toBe(l.intern.fil);
    expect(skjøtt(t.skjerm())).toContain(l.intern.tekst);
  });

  test('TC-3-05-11 terminal uten OSC 8-støtte (xterm-256color): ingen OSC 8, lenketeksten vises', async ({ present }) => {
    const t = await presenterNotat(present, kanter.sti, { miljø: l.utenStotte.miljo });
    await gåTilLysbilde(t, 11);
    expect(osc8Mål(t.råstrøm())).toEqual([]);
    expect(skjøtt(t.skjerm())).toContain('presentasjonsdokumentasjonen');
  });
});

test.describe('AK-3-06 plassholdere for Mermaid, kanban og bilder', () => {
  for (const sted of f.plassholdere.steder) {
    for (const s of STANDARDSTØRRELSER) {
      test(`TC-3-06-01 ${sted.type} på ${sted.notat} lysbilde ${sted.lysbilde} ved ${navn(s)}`, async ({ present }) => {
        const notat = sted.notat === 'kanter' ? kanter : fasitNotat(sted.notat);
        const t = await presenterNotat(present, notat.sti, { størrelse: s });
        const rader = await gåTilLysbilde(t, sted.lysbilde);
        expect(skjøtt(rader)).toContain(sted.tekst);
        for (const x of sted.ikke ?? []) expect(skjøtt(rader), `ikke rå kilde «${x}»`).not.toContain(x);
        // Diskré: plassholderen er dempet eller i dekorfarge, ikke fet.
        const celler = cellerFor(t.celler(), sted.tekst.slice(0, 10)) ?? [];
        expect(celler.length).toBeGreaterThan(0);
        expect(celler.every((c) => !c.fet)).toBe(true);
        // Ingen krasj: neste/forrige virker etterpå.
        await t.trykk('k');
        await t.trykk('j');
        expect(t.exitkode()).toBeNull();
      });
    }
  }

  test('TC-3-06-02 «Høyt diagram» (25 steg) gir ingen intern rulling og ingen «(forts.)»', async ({ present }) => {
    const t = await presenterNotat(present, fasitNotat('stor').sti, { størrelse: { cols: 80, rows: 24 } });
    const før = await gåTilLysbilde(t, 5);
    expect(skjøtt(før)).not.toContain('(forts.)');
    await t.trykk('Down');
    await new Promise((r) => setTimeout(r, 100));
    expect(t.skjerm()).toEqual(før);
  });
});
