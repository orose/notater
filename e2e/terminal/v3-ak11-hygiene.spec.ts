// AK-3-11 Terminalen gjenopprettes alltid ved avslutning (normal, `Ctrl c`, ukjent feil). Under 80×24 vises en melding.
// + v3 «Terminalhygiene»: alternativ skjermbuffer, markøren skjules, terminalen gjenopprettes alltid, også ved krasj/`Ctrl c`.
// Testplan: TC-3-11-*. Fasit: docs/test/v3-fasit.json › hygiene, storrelser.
//
// KJØRER NÅ: hygiene ved q/Esc/Ctrl c/SIGTERM/SIGHUP og meldingen under 80×24 virker allerede i skjelettet
// (src/terminal, ADR-011). Det som krever lysbilder eller `:`-kommandoer er `test.fixme` til det er levert.
import { expect, forLiteMønstre, forventGjenopprettet, presenterNotat, test, ventPåLysbilde } from '../support/terminal';

const NOTAT = 'Statusmøte uke 45';
const SKJELETT_ELLER_LYSBILDE = /presentasjon|Statusmøte uke 45/;

test.describe('AK-3-11 terminalhygiene ved avslutning', () => {
  for (const tast of ['q', 'Escape', 'C-c'] as const) {
    test(`TC-3-11-01 «${tast}» avslutter og gjenoppretter alternativ skjerm, markør og tty-modus`, async ({ present }) => {
      const t = await present({ args: [NOTAT], størrelse: { cols: 80, rows: 24 } });
      await t.ventPåTekst(SKJELETT_ELLER_LYSBILDE, 20_000);
      expect(t.tilstand()).toMatchObject({ alternativSkjerm: true, markørSynlig: false });
      await t.trykk(tast);
      await forventGjenopprettet(t, [0, 130]);
    });
  }

  test.fixme('TC-3-11-02 «:q» avslutter og gjenoppretter', async ({ present }) => {
    const t = await presenterNotat(present, NOTAT);
    await t.kommando('q');
    await forventGjenopprettet(t);
  });

  for (const sig of ['SIGTERM', 'SIGHUP'] as const) {
    test(`TC-3-11-03 ${sig} til appen gjenoppretter terminalen`, async ({ present }) => {
      const t = await present({ args: [NOTAT] });
      await t.ventPåTekst(SKJELETT_ELLER_LYSBILDE, 20_000);
      t.signal(sig, 'appen');
      await forventGjenopprettet(t, [0, 1, 129, 143]);
    });
  }

  // Funn F-1 / PO-119 (testplanen §10): i skjelettet hang prosessen når tsx og appen fikk signalet samtidig – det
  // Ghostty gjør når vinduet lukkes. Rettet i 3-a: `npm run present` kjører bunten (scripts/present.mjs) i én prosess.
  for (const sig of ['SIGHUP', 'SIGTERM'] as const) {
    test(`TC-3-11-03b ${sig} til hele forgrunnsgruppen (vinduet lukkes) gjenoppretter terminalen`, async ({ present }) => {
      const t = await present({ args: [NOTAT] });
      await t.ventPåTekst(SKJELETT_ELLER_LYSBILDE, 20_000);
      t.signal(sig, 'gruppen');
      await forventGjenopprettet(t, [0, 1, 129, 143]);
    });
  }

  test('TC-3-11-04 Ctrl c midt i en tastestorm og en resize gjenoppretter terminalen', async ({ present }) => {
    const t = await present({ args: ['Stor kodeblokk'], størrelse: { cols: 120, rows: 36 } });
    await t.ventPåTekst(/presentasjon|Stor kodeblokk/, 20_000);
    // Ingen venting mellom tastene: Ctrl c kommer mens appen fortsatt tegner.
    await t.trykk(...Array.from({ length: 20 }, () => 'j'), 'Down', 'Down', 'G');
    await t.endreStørrelse({ cols: 81, rows: 25 });
    await t.trykk('C-c');
    await forventGjenopprettet(t, [0, 130]);
  });

  test('TC-3-11-05 ukjent feil (testkroken i ADR-011 §8): gjenopprett, deretter stakk på hovedskjermen, exit 1', async ({ present }) => {
    const t = await present({ args: [NOTAT], miljø: { VAULT_READER_TEST_CRASH: 'etter-første-ramme' } });
    await forventGjenopprettet(t, [1]);
    // Feilen skal stå på hovedskjermen etter at alternativ skjerm er forlatt (ikke forsvinne med den).
    expect(t.skjerm().join('\n')).toMatch(/Error|feil/i);
    const rå = t.råstrøm();
    expect(rå.slice(rå.lastIndexOf('\u001b[?1049l')), 'stakken skrives etter at alternativ skjerm er forlatt').toMatch(/Error|feil/i);
  });

  test.fixme('TC-3-11-06 Ctrl c på lysbilde 7 (kanban-plassholder) og i oversikten gjenoppretter', async ({ present }) => {
    const t = await presenterNotat(present, NOTAT);
    await t.trykk('G');
    await ventPåLysbilde(t, 10);
    await t.trykk('o');
    await t.trykk('C-c');
    await forventGjenopprettet(t, [0, 130]);
  });
});

test.describe('AK-3-11 under 80×24 vises en melding', () => {
  for (const s of [
    { cols: 79, rows: 23 },
    { cols: 79, rows: 24 },
    { cols: 80, rows: 23 },
    { cols: 40, rows: 12 },
  ]) {
    test(`TC-3-11-10 start i ${s.cols}×${s.rows}: tydelig melding, q avslutter rent`, async ({ present }) => {
      const t = await present({ args: [NOTAT], størrelse: s });
      for (const m of forLiteMønstre(s)) await t.ventPåTekst(m, 20_000);
      await t.trykk('q');
      await forventGjenopprettet(t);
    });
  }

  test('TC-3-11-11 resize til 79×23 og tilbake midt i presentasjonen', async ({ present }) => {
    const t = await present({ args: [NOTAT], størrelse: { cols: 120, rows: 36 } });
    await t.ventPåTekst(SKJELETT_ELLER_LYSBILDE, 20_000);
    await t.endreStørrelse({ cols: 79, rows: 23 });
    for (const m of forLiteMønstre({ cols: 79, rows: 23 })) await t.ventPåTekst(m);
    await t.endreStørrelse({ cols: 80, rows: 24 });
    await expect.poll(() => t.skjerm().join('\n'), { timeout: 5_000 }).not.toMatch(/for liten/);
    await t.ventPåTekst(SKJELETT_ELLER_LYSBILDE);
    await t.trykk('q');
    await forventGjenopprettet(t);
  });

  test.fixme('TC-3-11-12 meldingen viser ikke lysbildeinnhold, og samme lysbilde kommer tilbake etter resize', async ({ present }) => {
    const t = await presenterNotat(present, NOTAT, { størrelse: { cols: 120, rows: 36 } });
    await t.trykk('j', 'j', 'j');
    await ventPåLysbilde(t, 4);
    await t.endreStørrelse({ cols: 79, rows: 23 });
    await t.ventPåTekst('for liten');
    expect(t.skjerm().join('\n')).not.toContain('STATUS-A');
    await t.trykk('j'); // taster ignoreres mens meldingen vises (unntatt avslutt)
    await t.endreStørrelse({ cols: 80, rows: 24 });
    await ventPåLysbilde(t, 4);
    await t.ventPåTekst('Leveranse A – lesekomfort');
  });
});
