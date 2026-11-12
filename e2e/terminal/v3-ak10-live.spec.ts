// AK-3-10 Live endring av overskrift eller Bases-data i vaultet oppdaterer presentasjonen uten å miste posisjonen.
// + live sletting av lysbildet man står på. Hver test har sin egen vault-kopi (fixture `vault`), aldri test-vault/.
// Testplan: TC-3-10-*. Fasit: v3-fasit.json › live (speiler v2-fasit.json › statusmote.live, ADR-010 §5).
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agendalinje, expect, fasit3, fasitNotat, forventGjenopprettet, gåTilLysbilde, lysbildenummer, presenterNotat, skjøtt, test } from '../support/terminal';

const live = (fasit3 as unknown as { live: Record<string, Record<string, unknown> & { forvent: Record<string, unknown> }> & { maksMs: number } }).live;
const status = fasitNotat('statusmote');
const fil = (vaultDir: string, sti: string) => join(vaultDir, `${sti}.md`);
/** Obsidian skriver atomisk (temp-fil + rename); vi gjør det samme. */
function skrivAtomisk(path: string, innhold: string): void {
  writeFileSync(`${path}.tmp`, innhold);
  renameSync(`${path}.tmp`, path);
}

test.describe('AK-3-10 live oppdatering', () => {
  test.fixme('TC-3-10-01 endret agendaoverskrift: agendalinjen får nytt navn, samme lysbilde og nummer', async ({ present, vault }) => {
    const e = live.overskrift as { fra: string; til: string; lysbilde: number; forvent: { lysbilde: number; av: number; agendalinje: string } };
    const t = await presenterNotat(present, status.sti, { størrelse: { cols: 120, rows: 36 } });
    await gåTilLysbilde(t, e.lysbilde);
    const sti = fil(vault.dir, status.sti);
    skrivAtomisk(sti, readFileSync(sti, 'utf8').replace(e.fra, e.til));
    await expect.poll(() => agendalinje(t.skjerm(), [...status.agenda!, 'Pågår nå']) ?? '', { timeout: live.maksMs }).toContain(e.forvent.agendalinje);
    expect(lysbildenummer(t.skjerm())).toEqual({ n: e.forvent.lysbilde, av: e.forvent.av });
    expect(skjøtt(t.skjerm())).toContain('Oppgaver');
  });

  test.fixme('TC-3-10-02 sletting av lysbildet man står på: nærmeste nabo, etterfølger først (ADR-010 §5)', async ({ present, vault }) => {
    const e = live.slett as { seksjon: string; lysbilde: number; forvent: { lysbilde: number; av: number; agendapunkt: string } };
    const t = await presenterNotat(present, status.sti, { størrelse: { cols: 120, rows: 36 } });
    await gåTilLysbilde(t, e.lysbilde);
    const sti = fil(vault.dir, status.sti);
    const kilde = readFileSync(sti, 'utf8');
    const fra = kilde.indexOf(e.seksjon);
    const til = kilde.indexOf('\n## ', fra);
    skrivAtomisk(sti, kilde.slice(0, fra) + kilde.slice(til + 1));
    await expect.poll(() => lysbildenummer(t.skjerm()), { timeout: live.maksMs }).toEqual({ n: e.forvent.lysbilde, av: e.forvent.av });
    expect(skjøtt(t.skjerm())).toContain(e.forvent.agendapunkt);
    expect(skjøtt(t.skjerm())).not.toContain('STATUS-B');
  });

  test.fixme('TC-3-10-03 endrede Bases-data: raden i Bases-tabellen oppdateres, samme lysbilde', async ({ present, vault }) => {
    const e = live.base as { fil: string; fra: string; til: string; lysbilde: number; rad: string; forvent: { lysbilde: number; verdi: string } };
    const t = await presenterNotat(present, fasit3.kanter.sti, { størrelse: { cols: 120, rows: 36 } });
    await gåTilLysbilde(t, e.lysbilde);
    expect(skjøtt(t.skjerm())).not.toContain(e.forvent.verdi);
    const sti = join(vault.dir, e.fil);
    skrivAtomisk(sti, readFileSync(sti, 'utf8').replace(e.fra, e.til));
    await expect.poll(() => t.skjerm().find((r) => r.includes(e.rad)) ?? '', { timeout: live.maksMs }).toContain(e.forvent.verdi);
    expect(lysbildenummer(t.skjerm())?.n).toBe(e.forvent.lysbilde);
  });

  test.fixme('TC-3-10-04 nytt lysbilde før gjeldende: samme overskrift vises, nummeret øker', async ({ present, vault }) => {
    const t = await presenterNotat(present, status.sti, { størrelse: { cols: 120, rows: 36 } });
    await gåTilLysbilde(t, 10);
    const sti = fil(vault.dir, status.sti);
    skrivAtomisk(sti, readFileSync(sti, 'utf8').replace('### Plan Q1', '### Nytt lysbilde\n\nMarkør QA-NY.\n\n### Plan Q1'));
    await expect.poll(() => lysbildenummer(t.skjerm()), { timeout: live.maksMs }).toEqual({ n: 11, av: 11 });
    expect(skjøtt(t.skjerm())).toContain('Plan Q1');
  });

  test.fixme('TC-3-10-05 notatet slettes: «Notatet finnes ikke lenger»; kommer det tilbake, vises det igjen; q avslutter rent', async ({ present, vault }) => {
    const melding = (live.notatSlettet as unknown as { melding: string }).melding;
    const t = await presenterNotat(present, status.sti);
    await gåTilLysbilde(t, 4);
    const sti = fil(vault.dir, status.sti);
    const kilde = readFileSync(sti, 'utf8');
    rmSync(sti);
    await t.ventPåTekst(melding, live.maksMs);
    expect(t.exitkode(), 'avslutter ikke av seg selv (ADR-011 §7)').toBeNull();
    writeFileSync(sti, kilde);
    await expect.poll(() => lysbildenummer(t.skjerm()), { timeout: live.maksMs }).not.toBeNull();
    expect(skjøtt(t.skjerm())).not.toContain(melding);
    await t.trykk('q');
    await forventGjenopprettet(t);
  });

  test.fixme('TC-3-10-06 mange raske lagringer (debounce) gir riktig sluttilstand og ingen flimring av feilmeldinger', async ({ present, vault }) => {
    const t = await presenterNotat(present, status.sti, { størrelse: { cols: 120, rows: 36 } });
    await gåTilLysbilde(t, 7);
    const sti = fil(vault.dir, status.sti);
    const kilde = readFileSync(sti, 'utf8');
    for (let i = 0; i < 15; i++) skrivAtomisk(sti, kilde.replace('## Jobbes med nå', `## Jobbes med nå ${i}`));
    await expect.poll(() => agendalinje(t.skjerm(), ['Jobbes med nå']) ?? '', { timeout: live.maksMs }).toContain('Jobbes med nå 14');
    expect(lysbildenummer(t.skjerm())?.n).toBe(7);
  });
});
