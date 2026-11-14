// AK-3-07 For mye innhold deles i «(forts.)»; for stor blokk ruller internt; intet innhold kuttes usynlig; endret
// terminalstørrelse tegnes riktig på nytt. Testplan: TC-3-07-*. Fasit: v2-fasit.json › mye, stor; v3-fasit.json › storrelser.
import {
  antallLysbilder,
  expect,
  fasitNotat,
  geometri,
  gåTilLysbilde,
  lysbildenummer,
  presenterNotat,
  rullHeleBlokken,
  skjøtt,
  statuslinje,
  test,
  ventPåLysbilde,
  visningsbredde,
} from '../support/terminal';

const mye = fasitNotat('mye') as unknown as { sti: string; markorer: string[]; listepunktPrefiks: string };
const stor = fasitNotat('stor');
const status = fasitNotat('statusmote');

test.describe('AK-3-07 tilpasning', () => {
  test.fixme('TC-3-07-01 listepunkter deles aldri mellom to deler (80×24)', async ({ present }) => {
    const t = await presenterNotat(present, mye.sti, { størrelse: { cols: 80, rows: 24 } });
    const av = await antallLysbilder(t);
    const sett = new Map<string, number>();
    for (let n = 1; n <= av; n++) {
      const tekst = skjøtt(await gåTilLysbilde(t, n));
      for (const m of tekst.matchAll(/Punkt MYE-L(\d{2})/g)) sett.set(m[1]!, (sett.get(m[1]!) ?? 0) + 1);
    }
    expect([...sett.values()].every((x) => x === 1), 'hvert listepunkt på nøyaktig ett lysbilde').toBe(true);
    expect(sett.size).toBe(20);
  });

  test.fixme('TC-3-07-02 for stor kodeblokk ruller internt med ↑/↓ og hint; alle 120 linjer kan ses (80×24)', async ({ present }) => {
    const t = await presenterNotat(present, stor.sti, { størrelse: { cols: 80, rows: 24 } });
    const først = await gåTilLysbilde(t, 4);
    expect(skjøtt(først), 'hint om rulling').toMatch(/[↓↑]/);
    const sett = new Set<string>();
    for (const s of await rullHeleBlokken(t)) for (const m of s.join(' ').matchAll(/STOR-KODE (\d{3})/g)) sett.add(m[1]!);
    expect(sett.size).toBe(120);
    expect(lysbildenummer(t.skjerm())?.n, 'rulling bytter ikke lysbilde').toBe(4);
    await t.trykk('Up');
    await t.trykk('j');
    await ventPåLysbilde(t, 5);
  });

  test('TC-3-07-03 intet innhold kuttes usynlig: ingen rad er bredere enn terminalen, og innholdet slutter over statuslinjen', async ({ present }) => {
    for (const nøkkel of ['statusmote', 'rapport', 'kanter']) {
      const notat = fasitNotat(nøkkel);
      const t = await presenterNotat(present, notat.sti, { størrelse: { cols: 80, rows: 24 } });
      const av = await antallLysbilder(t);
      for (let n = 1; n <= av; n++) {
        const rader = await gåTilLysbilde(t, n);
        for (const r of rader) expect(visningsbredde(r)).toBeLessThanOrEqual(80);
        expect(statuslinje(rader), `${nøkkel} ${n}: statuslinjen er nederst`).toBe(rader.filter((r) => r.trim()).at(-1));
        expect(lysbildenummer(rader)).toEqual({ n, av: n === 1 ? null : av });
      }
    }
  });

  test.fixme('TC-3-07-04 resize midt i presentasjonen: samme lysbilde, tegnet for ny størrelse', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { størrelse: { cols: 120, rows: 36 } });
    await gåTilLysbilde(t, 7);
    for (const s of [
      { cols: 80, rows: 24 },
      { cols: 200, rows: 50 },
      { cols: 100, rows: 30 },
    ]) {
      await t.endreStørrelse(s);
      await t.ventPåTekst('Oppgaver');
      await expect.poll(() => t.skjerm().length).toBe(s.rows);
      const rader = t.skjerm();
      // Samme lysbilde (id): nummeret kan endre seg når «(forts.)»-delene før det endres med størrelsen.
      expect(skjøtt(rader), 'samme lysbilde').toContain('Kanban: Kanban – vises i web-leseren');
      expect(statuslinje(rader)).toBe(rader.filter((r) => r.trim()).at(-1));
      // Tegnet for den nye bredden: folioen står høyrejustert mot satsen (design §1.1/§2.7, maks 160, PO-126).
      expect(statuslinje(rader).trimEnd().length).toBe(geometri(s.cols).høyre);
    }
  });

  test.fixme('TC-3-07-05 resize på en «(forts.)»-del: innholdet øverst på delen er fortsatt synlig etterpå', async ({ present }) => {
    const t = await presenterNotat(present, mye.sti, { størrelse: { cols: 80, rows: 24 } });
    const rader = await gåTilLysbilde(t, 5);
    const markør = /MYE-(L?\d{2})/.exec(skjøtt(rader))![0];
    await t.endreStørrelse({ cols: 200, rows: 50 });
    await expect.poll(() => skjøtt(t.skjerm()).includes(markør), { message: `${markør} synlig etter resize` }).toBe(true);
  });

  test.fixme('TC-3-07-06 mange raske resize-hendelser (vindu dras) gir riktig sluttilstand og ingen krasj', async ({ present }) => {
    const t = await presenterNotat(present, status.sti, { størrelse: { cols: 120, rows: 36 } });
    await gåTilLysbilde(t, 10);
    for (let c = 120; c >= 80; c -= 2) await t.endreStørrelse({ cols: c, rows: 24 + (c % 7) });
    await t.endreStørrelse({ cols: 90, rows: 28 });
    await expect.poll(() => t.skjerm().length).toBe(28);
    await t.ventPåTekst('Plan Q1');
    expect(lysbildenummer(t.skjerm())?.n).toBe(10);
    expect(t.exitkode()).toBeNull();
  });
});
