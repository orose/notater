// AK-3-09 (endret av PO-132): terminalens eget fargetema er STANDARD – rollene mappes til ANSI-indeksene i
// farger.json › ansi16, og bakgrunnen males ikke. Våre paletter er opt-in med `--palett <navn>`/`:palett <navn>` og gir
// truecolor med malt bakgrunn; `:farger terminal` går tilbake. Kontrastkravet gjelder bare våre paletter (mot rollen
// `bg`, PO-131). `--farger terminal` vinner over NO_COLOR (PO-130). + NO_COLOR og TERM=xterm-256color.
// Testplan: TC-3-09-*. Fasit: v3-fasit.json › farger; fargerollene: docs/design/terminal/farger.json (UX).
import {
  expect,
  fargekoder,
  fargeNøkkel,
  fargeroller,
  fasitNotat,
  finnFiglet,
  gåTilFasit,
  gåTilLysbilde,
  kontrast,
  presenterNotat,
  sgrIRåstrøm,
  test,
  XTERM_256,
  type Celle,
} from '../support/terminal';

const status = fasitNotat('statusmote');
const PALETTER = Object.keys(fargeroller.truecolor);
/** Lysbilder som til sammen har tittel, overgang, liste, kode, plassholder, tabell og fotnote. */
const UTVALG = [1, 3, 4, 5, 7, 10];
const koderI = (rå: string) => sgrIRåstrøm(rå).flatMap(fargekoder);
/** Fargekoder som ikke er de 16 ANSI-fargene eller standardfargene (38;x/48;x). */
const utenfor16 = (koder: readonly string[]) => koder.filter((x) => x.includes(';'));
/** Bakgrunnskoder (40–47, 100–107, 48;x). */
const bakgrunner = (koder: readonly string[]) => koder.filter((x) => /^(4[0-7]|10[0-7]|48;\d)$/.test(x));

/** Kontrast for alle celler med blekk mot cellens bakgrunn, eller mot rollen `bg` der cellen ikke har egen (PO-131). */
function kontrastbrudd(celler: readonly (readonly Celle[])[], bg: string, krav: { tekst: number; stor: number }, figletRader: Set<number>, unntatt: ReadonlySet<string>): string[] {
  const brudd: string[] = [];
  celler.forEach((rad, y) =>
    rad.forEach((c, x) => {
      // Design §6.2: rollen `dekor` (ledere, tittelstrek, skillestreker, fremdriftsspor) er bare dekor og har ikke krav.
      if (!c.tegn.trim() || c.fg.kind !== 'rgb' || unntatt.has(c.fg.hex)) return;
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
  test('TC-3-09-01 standard (PO-132): terminalens eget tema – bare ANSI-indekser, bakgrunnen males ikke', async ({ present }) => {
    const t = await presenterNotat(present, status.sti);
    for (const n of UTVALG) await gåTilFasit(t, 'statusmote', n);
    const koder = koderI(t.råstrøm());
    expect(koder.length, 'roller i ANSI-farger').toBeGreaterThan(0);
    expect(utenfor16(koder), 'ingen 38;x/48;x').toEqual([]);
    expect(bakgrunner(koder), 'bakgrunnen males ikke (invertering med SGR 7 er lov)').toEqual([]);
    // Aksenten (figlet-hodet) er ANSI-indeksen fra farger.json › ansi16.aksentAvPalett.
    await gåTilLysbilde(t, 1);
    const forventet = fargeroller.ansi16.aksentAvPalett[fargeroller.standard.palett]!;
    const ansi = (n: number) => `ansi:${n < 8 ? 30 + n : 82 + n}`;
    const figlet = finnFiglet(t.celler())[0];
    expect([ansi(forventet.light), ansi(forventet.dark)]).toContain(figlet?.farger[0]);
  });

  for (const palett of PALETTER) {
    test(`TC-3-09-02 --palett ${palett}: truecolor, malt bakgrunn (rollen bg), kontrast ≥ 4,5:1 / ≥ 3:1 på ${UTVALG.length} lysbilder`, async ({ present }) => {
      const t = await presenterNotat(present, status.sti, { args: ['--palett', palett], størrelse: { cols: 120, rows: 36 } });
      const brudd: string[] = [];
      for (const n of UTVALG) {
        await gåTilFasit(t, 'statusmote', n);
        const celler = t.celler();
        // PO-131: mål mot lysbildets bakgrunn = rollen bg i paletten (lys eller mørk etter OSC 11; tmux svarer ikke → mørk).
        const bgFarger = new Set(celler.flat().map((c) => fargeNøkkel(c.bg)));
        const modus = (['dark', 'light'] as const).find((m) => bgFarger.has(fargeroller.truecolor[palett]![m].roller.bg!));
        expect(modus, `lysbilde ${n}: bakgrunnen er malt med rollen bg i ${palett}`).toBeDefined();
        const bg = fargeroller.truecolor[palett]![modus!].roller.bg!;
        const figlet = new Set(finnFiglet(celler).flatMap((b) => Array.from({ length: b.til - b.fra + 1 }, (_, i) => b.fra + i)));
        const roller = fargeroller.truecolor[palett]![modus!].roller;
        const dekor = new Set([roller.dekor!, roller.fremdrift_spor!].filter(Boolean));
        brudd.push(...kontrastbrudd(celler, bg, { tekst: 4.5, stor: 3 }, figlet, dekor).map((b) => `lysbilde ${n}: ${b}`));
      }
      expect(koderI(t.råstrøm())).toContain('38;2');
      expect(brudd).toEqual([]);
    });
  }

  test('TC-3-09-03 ukjent palett: --palett regnbue gir feilmelding med gyldige navn, exit ≠ 0, terminalen urørt', async ({ present }) => {
    const t = await present({ args: ['Statusmøte uke 45', '--palett', 'regnbue'] });
    expect(await t.ventPåExit(20_000)).not.toBe(0);
    for (const p of PALETTER) expect(t.skjerm().join('\n')).toContain(p);
    expect(t.tilstand()).toMatchObject({ alternativSkjerm: false, markørSynlig: true });
  });

  test('TC-3-09-04 --palett fosfor --farger terminal: terminalens farger vinner, bare 16 ANSI-farger', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { args: ['--palett', 'fosfor', '--farger', 'terminal'] });
    for (const n of UTVALG) await gåTilFasit(t, 'statusmote', n);
    const koder = koderI(t.råstrøm());
    expect(koder.length).toBeGreaterThan(0);
    expect(utenfor16(koder)).toEqual([]);
  });

  test('TC-3-09-05 NO_COLOR=1: ingen fargekoder, men fet/invertert/understrek bærer uthevingen', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { miljø: { NO_COLOR: '1' } });
    for (const n of UTVALG) await gåTilFasit(t, 'statusmote', n);
    expect(koderI(t.råstrøm())).toEqual([]);
    await gåTilFasit(t, 'statusmote', 4);
    // Gjeldende agendapunkt må fortsatt skille seg ut uten farge.
    expect(t.celler()[0]!.some((c) => c.fet || c.invertert || c.understrek)).toBe(true);
  });

  test('TC-3-09-06 NO_COLOR + --farger terminal: --farger terminal vinner, 16 farger (PO-130)', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { miljø: { NO_COLOR: '1' }, args: ['--farger', 'terminal'] });
    for (const n of UTVALG) await gåTilFasit(t, 'statusmote', n);
    const koder = koderI(t.råstrøm());
    expect(koder.length, 'farger tross NO_COLOR').toBeGreaterThan(0);
    expect(utenfor16(koder)).toEqual([]);
  });

  test('TC-3-09-07 --palett fosfor i TERM=xterm-256color uten COLORTERM: 256 farger, ingen 38;2/48;2', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { miljø: XTERM_256, args: ['--palett', 'fosfor'] });
    for (const n of UTVALG) await gåTilFasit(t, 'statusmote', n);
    const koder = koderI(t.råstrøm());
    expect(koder.filter((x) => x === '38;5' || x === '48;5').length, 'nærmeste 256-farge').toBeGreaterThan(0);
    expect(koder.filter((x) => x.endsWith(';2'))).toEqual([]);
  });

  test.fixme('TC-3-09-08 «:palett signal» gir truecolor, «:farger terminal» går tilbake; lysbildet beholdes', async ({ present }) => {
    const t = await presenterNotat(present, status.sti);
    const rader = await gåTilFasit(t, 'statusmote', 5);
    const nr = rader.at(-1);
    let før = t.råstrøm().length;
    await t.kommando('palett signal');
    await expect.poll(() => koderI(t.råstrøm().slice(før)).includes('38;2')).toBe(true);
    før = t.råstrøm().length;
    await t.kommando('farger terminal');
    await new Promise((r) => setTimeout(r, 200));
    const etter = koderI(t.råstrøm().slice(før));
    expect(etter.length).toBeGreaterThan(0);
    expect(utenfor16(etter)).toEqual([]);
    expect(t.skjerm().at(-1)).toBe(nr);
  });
});
