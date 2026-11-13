// AK-3-09 Våre paletter i truecolor som standard; `--farger terminal`/`:farger terminal` bruker terminalens 16 farger.
// Lesbar kontrast i alle paletter (lys/mørk). + NO_COLOR og en terminal uten truecolor (TERM=xterm-256color).
// Testplan: TC-3-09-*. Fasit: v3-fasit.json › farger; fargerollene: docs/design/terminal/farger.json (UX).
import {
  expect,
  fargekoder,
  fargeNøkkel,
  fargeroller,
  fasitNotat,
  finnFiglet,
  gåTilLysbilde,
  kontrast,
  presenterNotat,
  sgrIRåstrøm,
  test,
  XTERM_256,
  type Celle,
} from '../support/terminal-tmp';

const status = fasitNotat('statusmote');
const PALETTER = Object.keys(fargeroller.truecolor);
/** Lysbilder som til sammen har tittel, overgang, liste, kode, plassholder, tabell og fotnote. */
const UTVALG = [1, 3, 4, 5, 7, 10];
const koderI = (rå: string) => sgrIRåstrøm(rå).flatMap(fargekoder);

/** Kontrast for alle celler med blekk mot cellens bakgrunn (eller rollen 'bg' når bakgrunnen er terminalens). */
function kontrastbrudd(celler: readonly (readonly Celle[])[], bg: string, krav: { tekst: number; stor: number }, figletRader: Set<number>): string[] {
  const brudd: string[] = [];
  celler.forEach((rad, y) =>
    rad.forEach((c, x) => {
      if (!c.tegn.trim() || c.fg.kind !== 'rgb') return;
      const bak = c.bg.kind === 'rgb' ? c.bg.hex : bg;
      const [fg, b] = c.invertert ? [bak, c.fg.hex] : [c.fg.hex, bak];
      const erTekst = /[\p{L}\p{N}]/u.test(c.tegn) && !figletRader.has(y);
      const k = kontrast(fg, b);
      if (k < (erTekst ? krav.tekst : krav.stor)) brudd.push(`(${x},${y}) «${c.tegn}» ${fg} på ${b}: ${k.toFixed(2)}`);
    }),
  );
  return brudd;
}

test.describe('AK-3-09 farger', () => {
  test('TC-3-09-01 standard: truecolor med standardpaletten fra farger.json, bakgrunnen males', async ({ present }) => {
    const t = await presenterNotat(present, status.sti);
    const koder = koderI(t.råstrøm());
    expect(koder.some((x) => x === '38;2')).toBe(true);
    expect(koder.some((x) => x === '48;2'), 'lysbildets bakgrunn males (Q-3-06)').toBe(true);
    const { palett } = fargeroller.standard;
    const lov = new Set((['light', 'dark'] as const).flatMap((m) => [fargeroller.truecolor[palett]![m].roller.hode!, fargeroller.truecolor[palett]![m].roller.hode_skygge!]));
    const blokk = finnFiglet(t.celler())[0]!;
    for (const f of blokk.farger) expect(lov).toContain(f);
  });

  for (const palett of PALETTER) {
    test(`TC-3-09-02 --palett ${palett}: kontrast ≥ 4,5:1 for tekst og ≥ 3:1 for figlet/rammer på ${UTVALG.length} lysbilder`, async ({ present }) => {
      const t = await presenterNotat(present, status.sti, { args: ['--palett', palett], størrelse: { cols: 120, rows: 36 } });
      const brudd: string[] = [];
      for (const n of UTVALG) {
        await gåTilLysbilde(t, n);
        const celler = t.celler();
        const bgFarger = celler.flat().filter((c) => c.bg.kind === 'rgb').map((c) => fargeNøkkel(c.bg));
        const bg = bgFarger.sort((a, b) => bgFarger.filter((x) => x === b).length - bgFarger.filter((x) => x === a).length)[0]!;
        const modus = (['light', 'dark'] as const).find((m) => fargeroller.truecolor[palett]![m].roller.bg === bg);
        expect(modus, `bakgrunnen ${bg} er rollen bg i ${palett} (lys eller mørk)`).toBeDefined();
        const figlet = new Set(finnFiglet(celler).flatMap((b) => Array.from({ length: b.til - b.fra + 1 }, (_, i) => b.fra + i)));
        brudd.push(...kontrastbrudd(celler, bg, { tekst: 4.5, stor: 3 }, figlet).map((b) => `lysbilde ${n}: ${b}`));
      }
      expect(brudd).toEqual([]);
    });
  }

  test('TC-3-09-03 ukjent palett: --palett regnbue gir feilmelding med gyldige navn, exit ≠ 0, terminalen urørt', async ({ present }) => {
    const t = await present({ args: ['Statusmøte uke 45', '--palett', 'regnbue'] });
    expect(await t.ventPåExit(20_000)).not.toBe(0);
    for (const p of PALETTER) expect(t.skjerm().join('\n')).toContain(p);
    expect(t.tilstand()).toMatchObject({ alternativSkjerm: false, markørSynlig: true });
  });

  test('TC-3-09-04 --farger terminal: bare de 16 ANSI-fargene (30–37, 90–97, 40–47, 100–107), ingen 38/48', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { args: ['--farger', 'terminal'] });
    for (const n of UTVALG) await gåTilLysbilde(t, n);
    const koder = koderI(t.råstrøm());
    expect(koder.length).toBeGreaterThan(0);
    expect(koder.filter((x) => x.includes(';'))).toEqual([]);
    // Aksenten følger paletten (farger.json › ansi16.aksentAvPalett).
    const forventet = fargeroller.ansi16.aksentAvPalett[fargeroller.standard.palett]!;
    const ansi = (n: number) => (n < 8 ? 30 + n : 82 + n);
    await gåTilLysbilde(t, 1);
    const figlet = finnFiglet(t.celler())[0];
    expect([`ansi:${ansi(forventet.light)}`, `ansi:${ansi(forventet.dark)}`]).toEqual(expect.arrayContaining([figlet?.farger.find((f) => f.startsWith('ansi:'))]));
  });

  test('TC-3-09-05 NO_COLOR=1: ingen fargekoder i det hele tatt, men fet/invertert/understrek er lov og lysbildene er lesbare (Q-3-07)', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { miljø: { NO_COLOR: '1' } });
    for (const n of UTVALG) await gåTilLysbilde(t, n);
    expect(koderI(t.råstrøm())).toEqual([]);
    await gåTilLysbilde(t, 4);
    // Gjeldende agendapunkt må fortsatt skille seg ut uten farge.
    expect(t.celler()[0]!.some((c) => c.fet || c.invertert || c.understrek)).toBe(true);
  });

  test('TC-3-09-06 NO_COLOR + --farger terminal: NO_COLOR vinner (Q-3-07)', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { miljø: { NO_COLOR: '1' }, args: ['--farger', 'terminal'] });
    expect(koderI(t.råstrøm())).toEqual([]);
  });

  test('TC-3-09-07 TERM=xterm-256color uten COLORTERM: ingen 38;2/48;2 – 256 farger eller 16 (Q-3-07)', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { miljø: XTERM_256 });
    for (const n of UTVALG) await gåTilLysbilde(t, n);
    const koder = koderI(t.råstrøm());
    expect(koder.length).toBeGreaterThan(0);
    expect(koder.filter((x) => x.endsWith(';2'))).toEqual([]);
  });

  test('TC-3-09-08 «:farger terminal» under presentasjonen gir samme resultat som flagget, og lysbildet beholdes', async ({ present }) => {
    const t = await presenterNotat(present, status.sti);
    await gåTilLysbilde(t, 5);
    const før = t.råstrøm().length;
    await t.kommando('farger terminal');
    await new Promise((r) => setTimeout(r, 200));
    expect(koderI(t.råstrøm().slice(før)).filter((x) => x.includes(';'))).toEqual([]);
  });
});
