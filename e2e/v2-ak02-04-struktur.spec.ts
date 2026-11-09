// AK-2-02 Lysbilderekkefølgen følger S1–S7 for eksempelnotatet og for et rapportnotat bygget av embeds.
// AK-2-03 `:presenter h<n>` endrer lysbildenivå, huskes per notat i nettleseren, og ingenting skrives til notatet.
// AK-2-04 `---` deler lysbilder innen samme agendapunkt med «(forts.)».
// Fasit: docs/test/v2-fasit.json (README-QA §20). Testplan: TC-2-02-*, TC-2-03-*, TC-2-04-*.
// TC-2-02-00 (fasitens egen konsistens mot testvaultet) kjører nå; resten er `test.fixme` til levert.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './support/real-server';
import { expect, openNote, test } from './support/guards';
import {
  avsluttPresentasjon,
  fasit2,
  feilkode,
  lesAlleLysbilder,
  lysbilde,
  presentasjon,
  presenter,
  sjekksum,
  somFasit,
  startPresentasjon,
  type FasitLysbilde,
  type FasitNotat,
} from './support/v2';

const NOTATER: readonly (readonly [string, FasitNotat])[] = [
  ['statusmøte (eksempelnotatet)', fasit2.statusmote],
  ['rapport bygget av diskré embeds', fasit2.rapport],
  ['--- -delinger', fasit2.delte],
  ['enkeltblokker som er for store', fasit2.stor],
  ['uten overskrifter (S7)', fasit2.uten],
  ['kort innhold før agenda (S6)', fasit2.forKort],
  ['langt innhold før agenda (S6)', fasit2.forLang],
  ['8 agendapunkter', fasit2.mange],
];

// ---------------------------------------------------------------------------------------------
// TC-2-02-00 fasiten mot testvaultet (kjører nå, ren logikk)
// ---------------------------------------------------------------------------------------------

function presentasjonsfiler(): string {
  const rot = join(REPO, 'test-vault/presentasjon');
  const ut: string[] = [];
  const gå = (dir: string) => {
    for (const navn of readdirSync(dir)) {
      const fil = join(dir, navn);
      if (statSync(fil).isDirectory()) gå(fil);
      else ut.push(readFileSync(fil, 'utf8'));
    }
  };
  gå(rot);
  return ut.join('\n');
}

function sjekkLysbilder(navn: string, lysbilder: readonly FasitLysbilde[], agenda: readonly string[], kilde: string): string[] {
  const feil: string[] = [];
  const innhold = lysbilder.filter((l) => l.type === 'innhold');
  const overganger = lysbilder.filter((l) => l.type === 'overgang').map((l) => l.agendapunkt);
  if (lysbilder[0]?.type !== 'tittel') feil.push(`${navn}: første lysbilde er ikke tittel`);
  if (JSON.stringify(overganger) !== JSON.stringify(agenda)) feil.push(`${navn}: overganger ${JSON.stringify(overganger)} ≠ agenda`);
  if (agenda.length > 0 && lysbilder.filter((l) => l.type === 'agenda').length !== 1) feil.push(`${navn}: skal ha ett agendalysbilde`);
  if (agenda.length === 0 && lysbilder.some((l) => l.type === 'agenda')) feil.push(`${navn}: agenda uten agendapunkter`);
  for (const p of agenda) {
    const iPunkt = innhold.filter((l) => l.agendapunkt === p);
    iPunkt.forEach((l, i) => {
      if (l.progresjon !== `${i + 1}/${iPunkt.length}`) feil.push(`${navn}: «${l.overskrift}» har progresjon ${l.progresjon}, forventet ${i + 1}/${iPunkt.length}`);
    });
  }
  for (const l of lysbilder) {
    const h = l.overskrift?.replace(fasit2.forts, '');
    if (h && !new RegExp(`^#{1,6} ${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm').test(kilde) && !kilde.includes(`[[${h}]]`))
      if (l.type !== 'tittel' && !agenda.includes(h)) feil.push(`${navn}: overskriften «${h}» finnes ikke i testvaultet`);
    for (const m of l.inneholder ?? []) if (!kilde.includes(m)) feil.push(`${navn}: markøren «${m}» finnes ikke i testvaultet`);
  }
  return feil;
}

test.describe('AK-2-02 fasiten (kjører nå)', () => {
  test.skip(({ isMobile }) => isMobile, 'Ren logikk – kjøres én gang');

  test('TC-2-02-00 v2-fasit.json stemmer med test-vault/presentasjon/', () => {
    const kilde = presentasjonsfiler();
    const feil: string[] = [];
    for (const [navn, n] of NOTATER) {
      feil.push(...sjekkLysbilder(navn, n.lysbilder, n.agenda ?? [], kilde));
      const fil = join(REPO, 'test-vault', `${n.sti}.md`);
      if (!statSync(fil, { throwIfNoEntry: false })) feil.push(`${navn}: ${n.sti}.md finnes ikke`);
    }
    for (const nivå of ['h2', 'h3', 'h4'] as const) feil.push(...sjekkLysbilder(`nivå ${nivå}`, fasit2.niva[nivå].lysbilder, fasit2.niva[nivå].agenda, kilde));
    for (const m of [...fasit2.mye.markorer, ...fasit2.rapport.aldriSynlig]) if (!kilde.includes(m)) feil.push(`markøren ${m} mangler`);
    // P1-fellene står faktisk i frontmatter.
    expect(readFileSync(join(REPO, 'test-vault', `${fasit2.statusmote.sti}.md`), 'utf8')).toMatch(/^---\n[\s\S]*lysbildeniva: h4[\s\S]*agenda: av[\s\S]*\n---\n/);
    expect(feil).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// AK-2-02 rekkefølge
// ---------------------------------------------------------------------------------------------

test.describe('AK-2-02 lysbilderekkefølge (S1–S7)', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastaturnavigasjon på desktop; mobil: TC-2-12-*');

  for (const [navn, n] of NOTATER) {
    test(`TC-2-02-01 ${navn}: ${n.sti}`, async ({ page }) => {
      test.slow();
      await presenter(page, n.sti);
      expect(await lesAlleLysbilder(page)).toEqual(n.lysbilder.map(somFasit));
    });
  }

  test('TC-2-02-02 innhold og markører står på riktig lysbilde (statusmøte og rapport)', async ({ page }) => {
    for (const n of [fasit2.statusmote, fasit2.rapport, fasit2.delte, fasit2.forKort, fasit2.forLang]) {
      await presenter(page, n.sti);
      for (let i = 0; i < n.lysbilder.length; i++) {
        const forventet = n.lysbilder[i]!;
        await expect(lysbilde(page)).toHaveAttribute('data-slide-index', String(i + 1));
        for (const m of forventet.inneholder ?? []) await expect(lysbilde(page), `${n.sti} #${i + 1}`).toContainText(m);
        if (i < n.lysbilder.length - 1) await page.keyboard.press('j');
      }
      await avsluttPresentasjon(page);
    }
  });

  test('TC-2-02-03 rapport: diskré embedding brukes alltid i presentasjonen (S1), også når notatet vises med rammer', async ({ page }) => {
    await openNote(page, fasit2.rapport.sti);
    // Rammevisning i lesevisningen (standard).
    await expect(page.locator('main article').getByText('Innebygd fra', { exact: true }).first()).toBeVisible();
    await startPresentasjon(page);
    await expect(presentasjon(page).getByText('Innebygd fra', { exact: true })).toHaveCount(0);
    await expect(presentasjon(page).getByText('Åpne notat', { exact: false })).toHaveCount(0);
    await avsluttPresentasjon(page);
    // Lesevisningen er uendret etterpå.
    await expect(page.locator('main article').getByText('Innebygd fra', { exact: true }).first()).toBeVisible();
  });

  test('TC-2-02-04 rapport: seksjonsembed tar bare seksjonen (ingen «Utenfor rapporten»)', async ({ page }) => {
    await presenter(page, fasit2.rapport.sti);
    for (let i = 0; i < fasit2.rapport.lysbilder.length; i++) {
      for (const m of fasit2.rapport.aldriSynlig) await expect(lysbilde(page)).not.toContainText(m);
      await page.keyboard.press('j');
    }
  });

  test('TC-2-02-05 foldetilstand ignoreres (S8): foldede seksjoner presenteres', async ({ page }) => {
    await openNote(page, fasit2.statusmote.sti);
    await page.keyboard.press('z');
    await page.keyboard.press('Shift+M');
    await page.evaluate(() => window.scrollTo(0, 0));
    await startPresentasjon(page);
    expect(await lesAlleLysbilder(page)).toEqual(fasit2.statusmote.lysbilder.map(somFasit));
    await page.keyboard.press('Shift+G');
    await expect(lysbilde(page)).toContainText('STATUS-PLAN');
  });
});

// ---------------------------------------------------------------------------------------------
// AK-2-03 lysbildenivå
// ---------------------------------------------------------------------------------------------

test.describe('AK-2-03 lysbildenivå (S4)', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');
  const n = fasit2.niva;

  test('TC-2-03-01 standard: agenda H2, lysbilder H3', async ({ page }) => {
    await presenter(page, n.sti);
    expect(await lesAlleLysbilder(page)).toEqual(n.h3.lysbilder.map(somFasit));
  });

  for (const nivå of ['h4', 'h2'] as const) {
    test(`TC-2-03-02 \`:presenter ${nivå}\` gir fasitens lysbilder`, async ({ page }) => {
      await presenter(page, n.sti, nivå);
      expect(await lesAlleLysbilder(page)).toEqual(n[nivå].lysbilder.map(somFasit));
    });
  }

  test('TC-2-03-03 nivået huskes per notat: ny start, reload og etter navigasjon', async ({ page }) => {
    await presenter(page, n.sti, 'h4');
    await avsluttPresentasjon(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await startPresentasjon(page, 'leader');
    expect(await lesAlleLysbilder(page)).toEqual(n.h4.lysbilder.map(somFasit));
    await avsluttPresentasjon(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await startPresentasjon(page, 'leader');
    expect(await lesAlleLysbilder(page)).toEqual(n.h4.lysbilder.map(somFasit));
    await avsluttPresentasjon(page);
    // Andre notater er upåvirket.
    await presenter(page, fasit2.statusmote.sti);
    expect(await lesAlleLysbilder(page)).toEqual(fasit2.statusmote.lysbilder.map(somFasit));
  });

  test('TC-2-03-04 valget lagres i localStorage (vault-id + sti), ikke i URL eller notat', async ({ page, vaultDir }) => {
    const før = sjekksum(vaultDir);
    const metoder = new Set<string>();
    page.on('request', (r) => metoder.add(r.method()));
    await presenter(page, n.sti, 'h4');
    expect(page.url()).not.toMatch(/h4|niva|nivå|level/i);
    const lagret = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(lagret).toMatch(/Lysbildenivå|Lysbildeniv%C3%A5/);
    expect(lagret).toMatch(/h?4/);
    expect([...metoder].filter((m) => m !== 'GET' && m !== 'HEAD')).toEqual([]);
    expect(sjekksum(vaultDir)).toEqual(før);
  });

  test('TC-2-03-05 `:presenter auto` fjerner det lagrede nivået (ADR-010 §7)', async ({ page }) => {
    await presenter(page, n.sti, 'h4');
    await avsluttPresentasjon(page);
    await presenter(page, n.sti, 'auto');
    await avsluttPresentasjon(page);
    expect(await page.evaluate(() => localStorage.getItem('vault-leser.presentasjon') ?? '')).not.toMatch(/Lysbildeniv/);
    await presenter(page, n.sti);
    expect(await lesAlleLysbilder(page)).toEqual(n.h3.lysbilder.map(somFasit));
  });

  /** Skriver `:presenter <arg>` i paletten og trykker Enter. */
  async function presenterMed(page: import('@playwright/test').Page, sti: string, arg: string): Promise<void> {
    await openNote(page, sti);
    await page.keyboard.press(':');
    await page.getByRole('combobox').pressSequentially(`presenter ${arg}`);
    await page.keyboard.press('Enter');
  }

  for (const ugyldig of n.ugyldige) {
    test(`TC-2-03-06 ugyldig argument \`:presenter ${ugyldig}\` gir ${n.feilkoder.ugyldig} og norsk forklaring (PO-101)`, async ({ page }) => {
      await presenterMed(page, n.sti, ugyldig);
      await expect(feilkode(page, n.feilkoder.ugyldig)).toBeVisible();
      await expect(feilkode(page, n.feilkoder.ugyldig)).toContainText(ugyldig);
      await expect(feilkode(page, n.feilkoder.ugyldig)).toContainText(/nivå/i);
      await expect(feilkode(page, n.feilkoder.tomt)).toHaveCount(0);
      await expect(presentasjon(page)).toBeHidden();
    });
  }

  for (const tomt of n.tomme) {
    test(`TC-2-03-07 nivå som ikke finnes \`:presenter ${tomt}\` gir ${n.feilkoder.tomt}, gyldige nivåer listes, valget huskes ikke (PO-101)`, async ({ page }) => {
      await presenterMed(page, n.sti, tomt);
      await expect(feilkode(page, n.feilkoder.tomt)).toBeVisible();
      await expect(feilkode(page, n.feilkoder.tomt)).toContainText(tomt);
      // Meldingen nevner de gyldige nivåene (ADR-010 §3: «Gyldige nivåer: h2, h3, h4.»).
      await expect(feilkode(page, n.feilkoder.tomt)).toContainText(/h2.*h3.*h4/);
      await expect(feilkode(page, n.feilkoder.ugyldig)).toHaveCount(0);
      await expect(presentasjon(page)).toBeHidden();
      await page.keyboard.press('Escape');
      await presenter(page, n.sti);
      expect(await lesAlleLysbilder(page)).toEqual(n.h3.lysbilder.map(somFasit));
    });
  }

  test(`TC-2-03-08 \`:presenter h4\` i statusmøtet (ingen H4) gir ${n.tomIAnnetNotat.feilkode} (PO-101)`, async ({ page }) => {
    await presenterMed(page, n.tomIAnnetNotat.sti, n.tomIAnnetNotat.niva);
    await expect(feilkode(page, n.tomIAnnetNotat.feilkode)).toBeVisible();
    await expect(presentasjon(page)).toBeHidden();
  });
});

// ---------------------------------------------------------------------------------------------
// AK-2-04 `---`
// ---------------------------------------------------------------------------------------------

test.describe('AK-2-04 tematisk skille deler lysbilder (S5)', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');
  const d = fasit2.delte;

  test('TC-2-04-01 `---` og `***` deler innen samme agendapunkt; første del beholder overskriften, resten «(forts.)»', async ({ page }) => {
    await presenter(page, d.sti);
    const lest = await lesAlleLysbilder(page);
    expect(lest).toEqual(d.lysbilder.map(somFasit));
    expect(lest.filter((l) => l.overskrift?.endsWith(fasit2.forts.trim()))).toHaveLength(3);
  });

  test('TC-2-04-02 `---` i en kodeblokk deler ikke; skillelinjen vises ikke som <hr> på lysbildet', async ({ page }) => {
    await presenter(page, d.sti);
    const grensesnitt = d.lysbilder.findIndex((l) => l.overskrift === 'Grensesnitt') + 1;
    for (let i = 1; i < grensesnitt; i++) await page.keyboard.press('j');
    // `pre` (ikke `pre, code`): avsnittet før kodeblokken har inline-koden `---` (endret av frontend).
    await expect(lysbilde(page).locator('pre').first()).toContainText('tittel: eksempel');
    await expect(lysbilde(page).locator('pre').first()).toContainText('---');
    await expect(presentasjon(page).locator('hr')).toHaveCount(0);
  });

  test('TC-2-04-03 `---` sist i en seksjon og to `---` på rad gir ikke tomme lysbilder', async ({ page }) => {
    await presenter(page, d.sti);
    const { length } = d.lysbilder;
    for (let i = 1; i <= length; i++) {
      const tekst = (await lysbilde(page).getByTestId('lysbilde-innhold').innerText().catch(() => 'tittel/agenda')).trim();
      expect(tekst.length, `lysbilde ${i} er ikke tomt`).toBeGreaterThan(0);
      if (i < length) await page.keyboard.press('j');
    }
  });

  test('TC-2-04-04 `---` i notat uten overskrifter deler bare innholdet (S7)', async ({ page }) => {
    await presenter(page, fasit2.uten.sti);
    expect(await lesAlleLysbilder(page)).toEqual(fasit2.uten.lysbilder.map(somFasit));
    await expect(presentasjon(page).getByTestId('agendalinje')).toBeHidden();
  });
});
