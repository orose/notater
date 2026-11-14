// AK-3-08 Alle taster i tabellen virker; `?` viser dem; `:`-kommandoene virker med vim-feilkoder (E475/E486) ved feil.
// Testplan: TC-3-08-*. Fasit: v3-fasit.json › taster.
import { expect, fargekoder, fasit3, fasitNotat, forventGjenopprettet, gåTilFasit, gåTilLysbilde, lysbildenummer, presenterNotat, sgrIRåstrøm, skjøtt, test, ventPåLysbilde } from '../support/terminal';

const k = fasit3 as unknown as {
  taster: Record<'neste' | 'forrige' | 'forste' | 'siste' | 'oversikt' | 'svart' | 'hjelp' | 'avslutt', string[]> & {
    feil: { kommando: string; kode: string; notat?: string }[];
  };
};
const status = fasitNotat('statusmote');
const N = status.lysbilder.length;

test.describe('AK-3-08 taster', () => {
  for (const tast of k.taster.neste) {
    test(`TC-3-08-01 neste: «${tast}», og ingenting etter siste`, async ({ present }) => {
      const t = await presenterNotat(present, status.sti);
      await t.trykk(tast);
      await ventPåLysbilde(t, 2);
      await t.trykk('G');
      await ventPåLysbilde(t, N);
      await t.trykk(tast);
      await new Promise((r) => setTimeout(r, 150));
      expect(lysbildenummer(t.skjerm())?.n).toBe(N);
      expect(t.exitkode(), 'neste på siste lysbilde avslutter ikke').toBeNull();
    });
  }

  for (const tast of k.taster.forrige) {
    test(`TC-3-08-02 forrige: «${tast}», og ingenting før første`, async ({ present }) => {
      const t = await presenterNotat(present, status.sti);
      await t.trykk(tast);
      await new Promise((r) => setTimeout(r, 150));
      expect(lysbildenummer(t.skjerm())?.n).toBe(1);
      await t.trykk('G', tast);
      await ventPåLysbilde(t, N - 1);
    });
  }

  test('TC-3-08-03 gg og G; «g» etterfulgt av en annen tast gjør ingenting', async ({ present }) => {
    const t = await presenterNotat(present, status.sti);
    await t.trykk('G');
    await ventPåLysbilde(t, N);
    await t.trykk('g g');
    await ventPåLysbilde(t, 1);
    await t.trykk('j', 'j', 'g', 'Escape');
    await ventPåLysbilde(t, 3);
    expect(t.exitkode(), '«g Esc» avslutter ikke').toBeNull();
  });

  test.fixme('TC-3-08-04 oversikt: «o» viser alle lysbildene, j/k/↓/↑ flytter, ↵ hopper, Esc lukker uten å avslutte', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { størrelse: { cols: 120, rows: 36 } });
    await t.trykk('o');
    for (const l of status.lysbilder.filter((x) => x.type === 'innhold')) await t.ventPåTekst(l.overskrift!);
    await t.trykk('Escape');
    await ventPåLysbilde(t, 1);
    expect(t.exitkode()).toBeNull();
    await t.trykk('o');
    for (let i = 0; i < 6; i++) await t.trykk(i % 2 ? 'Down' : 'j');
    await t.trykk('Enter');
    await ventPåLysbilde(t, 7);
  });

  for (const tast of k.taster.svart) {
    test.fixme(`TC-3-08-05 svart skjerm med «${tast}»; neste/forrige gir bildet tilbake uten å bla`, async ({ present }) => {
      const t = await presenterNotat(present, status.sti);
      await gåTilFasit(t, 'statusmote', 4);
      await t.trykk(tast);
      await expect.poll(() => t.skjerm().every((r) => !r.trim()), { message: 'helt tom skjerm' }).toBe(true);
      const celler = t.celler().flat();
      expect(celler.every((c) => c.bg.kind === 'standard' || (c.bg.kind === 'rgb' && c.bg.hex === '#000000') || (c.bg.kind === 'ansi' && c.bg.n === 40))).toBe(true);
      await t.trykk('j');
      await ventPåLysbilde(t, 4);
    });
  }

  test.fixme('TC-3-08-06 «?» viser hurtigtastene (alle fra tabellen), Esc/«?» lukker', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { størrelse: { cols: 120, rows: 36 } });
    await t.trykk('?');
    const tekst = skjøtt(await t.ventPåTekst(/Neste|neste/));
    for (const navn of ['j', 'k', 'gg', 'G', 'o', 'b', ':', 'q', 'Esc', 'Ctrl c', 'PageDown', 'PageUp', 'Space']) expect(tekst, navn).toContain(navn);
    await t.trykk('Escape');
    await ventPåLysbilde(t, 1);
    expect(t.exitkode(), 'Esc lukker hjelpen først').toBeNull();
  });

  test.fixme('TC-3-08-07 «:presenter h4» i Lysbildenivå gir h4-rekkefølgen; «:agenda av» beholder lysbildet', async ({ present }) => {
    const niva = fasitNotat('niva') as unknown as { sti: string; h4: { lysbilder: unknown[] } };
    const t = await presenterNotat(present, niva.sti);
    await t.kommando('presenter h4');
    await expect.poll(() => lysbildenummer(t.skjerm())?.av).toBe(niva.h4.lysbilder.length);
    const t2 = await presenterNotat(present, status.sti);
    await gåTilLysbilde(t2, 7);
    await t2.kommando('agenda av');
    await expect.poll(() => lysbildenummer(t2.skjerm())).toEqual({ n: 5, av: 7 });
    await t2.ventPåTekst('Oppgaver');
  });

  test.fixme('TC-3-08-08 «:palett signal» og «:farger terminal» bytter farger uten å bytte lysbilde', async ({ present }) => {
    const t = await presenterNotat(present, status.sti);
    await gåTilFasit(t, 'statusmote', 5);
    const før = t.råstrøm().length;
    await t.kommando('palett signal');
    await t.kommando('farger terminal');
    await new Promise((r) => setTimeout(r, 200));
    const koder = sgrIRåstrøm(t.råstrøm().slice(før)).flatMap(fargekoder);
    expect(koder.length, 'tegnet på nytt med farger').toBeGreaterThan(0);
    expect(koder.filter((x) => x.startsWith('38;') || x.startsWith('48;')), 'bare 16 farger etter :farger terminal').toEqual([]);
    expect(lysbildenummer(t.skjerm())?.n).toBe(5);
  });

  for (const f of k.taster.feil) {
    test.fixme(`TC-3-08-09 «:${f.kommando}» gir ${f.kode} med norsk forklaring, presentasjonen fortsetter`, async ({ present }) => {
      const t = await presenterNotat(present, fasitNotat(f.notat ?? 'statusmote').sti);
      await gåTilLysbilde(t, 2);
      await t.kommando(f.kommando);
      await t.ventPåTekst(f.kode);
      expect(lysbildenummer(t.skjerm())?.n).toBe(2);
      await t.trykk('j');
      await ventPåLysbilde(t, 3);
    });
  }

  test.fixme('TC-3-08-10 «:» og Esc avbryter kommandolinjen uten å avslutte; «:q» avslutter', async ({ present }) => {
    const t = await presenterNotat(present, status.sti);
    await t.trykk(':');
    await t.skriv('presenter');
    await t.trykk('Escape');
    await new Promise((r) => setTimeout(r, 150));
    expect(t.exitkode()).toBeNull();
    await t.kommando('q');
    await forventGjenopprettet(t);
  });

  test('TC-3-08-11 statuslinjen viser notattittel, tastehint og «n/N»', async ({ present }) => {
    const t = await presenterNotat(present, status.sti);
    const rader = await gåTilFasit(t, 'statusmote', 7);
    const linje = rader.filter((r) => r.trim()).at(-1)!;
    expect(linje).toContain(status.tittel!);
    expect(linje).toContain('?');
    expect(linje).toMatch(new RegExp(`7\\s*/\\s*${N}\\s*$`));
  });
});
