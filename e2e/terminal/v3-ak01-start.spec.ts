// AK-3-01 `npm run present -- "<notat>"` starter presentasjonen; uten argument vises en søkbar notatliste.
// Frittstående (web-serveren kjører ikke). Testplan: TC-3-01-*. Fasit: docs/test/v3-fasit.json › notatvalg.
//
// Konfigurasjonen peker på en port der ingenting lytter (support/terminal.ts › vault), og nettvakten logger alle
// TCP-forsøk fra appen – også mot 127.0.0.1. TC-3-01-11/-12 (ikke en terminal, --hjelp) kjører nå mot skjelettet.
import { spawnSync } from 'node:child_process';
import { REPO } from '../support/real-server';
import { sjekksum } from '../support/v2';
import { expect, fasit3, fasitNotat, forventGjenopprettet, lysbildenummer, presenterNotat, test, ventPåLysbilde } from '../support/terminal';

const valg = fasit3 as unknown as {
  notatvalg: {
    eksakt: { arg: string; notat: string }[];
    fuzzyEttTreff: { arg: string; notat: string }[];
    flereTreff: { arg: string; treff: string[] };
    ukjent: { arg: string };
    listeUtenArgument: { inneholder: string[]; filter: string; treffEtterFilter: string };
    nfd: { arg: string };
  };
};
const tittel = (nøkkel: string) => fasitNotat(nøkkel).lysbilder[0]!.overskrift!;
const antall = (nøkkel: string) => fasitNotat(nøkkel).lysbilder.length;

test.describe('AK-3-01 start og notatvalg', () => {
  test.fixme('TC-3-01-01 starter på tittellysbildet, frittstående: ingen TCP-tilkoblinger, heller ikke til web-serveren', async ({ present }) => {
    const t = await presenterNotat(present, 'Statusmøte uke 45');
    expect(lysbildenummer(t.skjerm())).toEqual({ n: 1, av: antall('statusmote') });
    await t.ventPåTekst(tittel('statusmote'));
    await t.trykk('j', 'j', 'j', 'G');
    await ventPåLysbilde(t, antall('statusmote'));
    await t.trykk('q');
    await forventGjenopprettet(t);
    expect(t.nettforsøk(), 'ingen nettverkskall (T7, B10)').toEqual([]);
  });

  for (const { arg, notat } of valg.notatvalg.eksakt) {
    test.fixme(`TC-3-01-02 eksakt treff: «${arg}»`, async ({ present }) => {
      const t = await presenterNotat(present, arg);
      expect(lysbildenummer(t.skjerm())).toEqual({ n: 1, av: antall(notat) });
    });
  }

  test.fixme('TC-3-01-03 navn uten anførselstegn (flere posisjonsargumenter) settes sammen', async ({ present }) => {
    const t = await present({ args: ['Statusmøte', 'uke', '45'] });
    await ventPåLysbilde(t, 1, 20_000);
    await t.ventPåTekst(tittel('statusmote'));
  });

  for (const { arg, notat } of valg.notatvalg.fuzzyEttTreff) {
    test.fixme(`TC-3-01-04 fuzzy med ett treff starter direkte: «${arg}»`, async ({ present }) => {
      const t = await presenterNotat(present, arg);
      await t.ventPåTekst(tittel(notat));
    });
  }

  test.fixme('TC-3-01-05 flere treff ved fuzzy: søkbar liste forhåndsfylt, ingen presentasjon før valg (Q-3-09)', async ({ present }) => {
    const { arg, treff } = valg.notatvalg.flereTreff;
    const t = await present({ args: [arg] });
    for (const navn of treff) await t.ventPåTekst(navn, 20_000);
    expect(lysbildenummer(t.skjerm()), 'ingen lysbildenummer i lista').toBeNull();
    expect(t.skjerm().join('\n')).toContain(arg);
    await t.skriv(' okt');
    await t.ventPåTekst('Månedsrapport oktober');
    await expect.poll(() => t.skjerm().join('\n').includes('Kvartalsrapport')).toBe(false);
    await t.trykk('Enter');
    await ventPåLysbilde(t, 1);
    expect(lysbildenummer(t.skjerm())).toEqual({ n: 1, av: antall('rapport') });
  });

  test.fixme('TC-3-01-06 ukjent notat: melding med argumentet, exit-kode ≠ 0, terminalen urørt (Q-3-09)', async ({ present }) => {
    const t = await present({ args: [valg.notatvalg.ukjent.arg] });
    const kode = await t.ventPåExit(20_000);
    expect(kode).not.toBe(0);
    expect(t.skjerm().join('\n')).toContain(valg.notatvalg.ukjent.arg);
    expect(t.tilstand()).toMatchObject({ alternativSkjerm: false, markørSynlig: true });
    expect(t.stty().etter).toBe(t.stty().før);
  });

  // PO-122: lista sorterer nyeste først, deretter alfabetisk; vault-kopien har mange like mtime, så testen søker
  // seg fram til notatene i stedet for å anta hva som står øverst.
  test('TC-3-01-07 uten argument: søkbar notatliste, søk finner notatene, Enter starter, Esc i lista avslutter rent', async ({ present }) => {
    const { inneholder, filter, treffEtterFilter } = valg.notatvalg.listeUtenArgument;
    const t = await present();
    await t.ventPåTekst('Notater', 20_000);
    expect(lysbildenummer(t.skjerm()), 'ingen presentasjon før valg').toBeNull();
    for (const navn of inneholder) {
      await t.skriv(navn);
      await t.ventPåTekst(navn);
      await t.trykk('C-u');
    }
    await t.skriv(filter);
    await t.ventPåTekst(treffEtterFilter);
    await t.trykk('Enter');
    await ventPåLysbilde(t, 1, 20_000);
    await t.ventPåTekst(tittel('kanter'));
    const t2 = await present();
    await t2.ventPåTekst('Notater', 20_000);
    await t2.trykk('Escape');
    await forventGjenopprettet(t2);
  });

  test.fixme('TC-3-01-08 NFC-argument treffer NFD-filnavnet (QA-IDX-09)', async ({ present }) => {
    const t = await presenterNotat(present, valg.notatvalg.nfd.arg.normalize('NFC'));
    await t.ventPåTekst('Årsrapport');
  });

  test.fixme('TC-3-01-09 --vault <mappe> i stedet for --config', async ({ present, vault }) => {
    const t = await present({ konfig: null, args: ['--vault', vault.dir, 'Statusmøte uke 45'] });
    await ventPåLysbilde(t, 1, 20_000);
  });

  test.fixme('TC-3-01-10 read-only: ingenting i vaultet endres av en hel presentasjon (sjekksum)', async ({ present, vault }) => {
    const før = sjekksum(vault.dir, '.');
    const t = await presenterNotat(present, 'Statusmøte uke 45');
    await t.trykk('G', ':');
    await t.skriv('presenter h4');
    await t.trykk('Enter', 'q');
    await t.ventPåExit();
    expect(sjekksum(vault.dir, '.')).toEqual(før);
  });

  test('TC-3-01-11 ikke en terminal (stdout omdirigert): tydelig feil, exit-kode ≠ 0, ingen escape-sekvenser', ({ vault }) => {
    const r = spawnSync('npm', ['run', '--silent', 'present', '--', '--config', vault.konfig, '--vault-id', 'test', 'Statusmøte uke 45'], {
      cwd: REPO,
      encoding: 'utf8',
      input: '',
      timeout: 30_000,
      env: { ...process.env, npm_config_update_notifier: 'false' },
    });
    expect(r.status).not.toBe(0);
    expect(`${r.stdout}${r.stderr}`).toMatch(/terminal/i);
    expect(r.stdout).not.toContain('\u001b[?1049h');
  });

  test('TC-3-01-12 --hjelp viser bruk og alle flaggene i spesifikasjonen', ({ vault }) => {
    void vault;
    const r = spawnSync('npm', ['run', '--silent', 'present', '--', '--hjelp'], { cwd: REPO, encoding: 'utf8', timeout: 30_000 });
    expect(r.status).toBe(0);
    for (const flagg of (fasit3 as unknown as { kommando: { flagg: string[] } }).kommando.flagg) expect(r.stdout + r.stderr).toContain(flagg);
  });
});
