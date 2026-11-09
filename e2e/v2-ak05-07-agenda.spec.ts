// AK-2-05 Tittel-, agenda- og overgangslysbilder vises som beskrevet; overganger alltid, `:agenda av` slår dem av
//         for gjeldende presentasjon.
// AK-2-06 Agendalinjen på alle innholdslysbilder med riktig utheving og progresjon, skjult på tittel/agenda/
//         overgang, avkortet til forrige · nåværende · neste ved plassmangel.
// AK-2-07 Endring av en agendaoverskrift i vaultet under presentasjon oppdaterer agenda og agendalinje uten å
//         miste posisjonen (egen vault-kopi og server per test).
// Testplan: TC-2-05-*, TC-2-06-*, TC-2-07-*. TDD: `test.fixme` til levert.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './support/guards';
import {
  agendaEllipse,
  agendalinje,
  agendaliste,
  agendaProgresjon,
  avsluttPresentasjon,
  fasit2,
  gåTilLysbilde,
  kontrast,
  lesAlleLysbilder,
  lesLysbilde,
  liveTest,
  lysbilde,
  lysbildeOverskrift,
  nummer,
  presenter,
  somFasit,
  startPresentasjon,
  ventPåLysbilde,
  ventPåPresentasjon,
} from './support/v2';
import { kjørKommando } from './support/v11';

const s = fasit2.statusmote;

async function agendaTekster(page: Page): Promise<string[]> {
  return (await agendaliste(page).getByRole('listitem').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
}

// ---------------------------------------------------------------------------------------------
// AK-2-05
// ---------------------------------------------------------------------------------------------

test.describe('AK-2-05 tittel, agenda og overganger', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');

  test('TC-2-05-01 tittellysbildet: tittel, ingress, properties (ikke skjulte), endringsdato, ingen agendalinje', async ({ page }) => {
    await presenter(page, s.sti);
    await expect(lysbilde(page)).toHaveAttribute('data-slide-type', 'tittel');
    await expect(lysbildeOverskrift(page)).toHaveText(s.tittel!);
    await expect(lysbilde(page)).toContainText(s.tittellysbilde.ingress);
    for (const p of s.tittellysbilde.properties) await expect(lysbilde(page)).toContainText(p);
    for (const p of s.tittellysbilde.skjult) await expect(lysbilde(page)).not.toContainText(p);
    await expect(lysbilde(page)).toContainText(/2026/);
    await expect(lysbilde(page).locator('time')).toHaveAttribute('datetime', new RegExp(`^${s.tittellysbilde.endret}`));
    await expect(agendalinje(page)).toBeHidden();
  });

  test('TC-2-05-09 tagger vises ikke på tittellysbildet (PO-90)', async ({ page }) => {
    await presenter(page, fasit2.tagger.sti);
    await expect(lysbilde(page)).toHaveAttribute('data-slide-type', 'tittel');
    await expect(lysbilde(page)).not.toContainText(fasit2.tagger.tagg);
  });

  test('TC-2-05-02 kort innhold før første agendaoverskrift vises på tittellysbildet (S6)', async ({ page }) => {
    await presenter(page, fasit2.forKort.sti);
    for (const m of fasit2.forKort.lysbilder[0]!.inneholder ?? []) await expect(lysbilde(page)).toContainText(m);
  });

  test('TC-2-05-03 langt innhold før første agendaoverskrift blir eget lysbilde før agendaen (S6)', async ({ page }) => {
    await presenter(page, fasit2.forLang.sti);
    await expect(lysbilde(page)).not.toContainText('LANGFØR-1');
    await page.keyboard.press('j');
    await expect(lysbilde(page)).toHaveAttribute('data-slide-type', 'innhold');
    for (const m of fasit2.forLang.lysbilder[1]!.inneholder ?? []) await expect(lysbilde(page)).toContainText(m);
    await expect(agendalinje(page)).toBeHidden();
    await page.keyboard.press('j');
    await expect(lysbilde(page)).toHaveAttribute('data-slide-type', 'agenda');
  });

  test('TC-2-05-04 agendalysbildet rett etter tittel: alle agendapunkter, ingen utheving, ingen agendalinje', async ({ page }) => {
    await presenter(page, s.sti);
    await page.keyboard.press('j');
    await expect(lysbilde(page)).toHaveAttribute('data-slide-type', 'agenda');
    expect(await agendaTekster(page)).toEqual(s.agenda);
    await expect(agendaliste(page).locator('[aria-current="step"]')).toHaveCount(0);
    await expect(agendalinje(page)).toBeHidden();
  });

  test('TC-2-05-05 overgang før hvert agendapunkt: gjeldende uthevet, tidligere dempet («du er her»)', async ({ page }) => {
    await presenter(page, s.sti);
    const overganger = s.lysbilder.map((l, i) => [l, i + 1] as const).filter(([l]) => l.type === 'overgang');
    expect(overganger).toHaveLength(s.agenda!.length);
    for (const [l, nr] of overganger) {
      await gåTilLysbilde(page, nr);
      await expect(lysbilde(page)).toHaveAttribute('data-slide-type', 'overgang');
      expect(await agendaTekster(page)).toEqual(s.agenda);
      const nå = agendaliste(page).locator('[aria-current="step"]');
      await expect(nå).toHaveText(l.agendapunkt!);
      const idx = s.agenda!.indexOf(l.agendapunkt!);
      const punkter = agendaliste(page).getByRole('listitem');
      for (let i = 0; i < idx; i++) {
        await expect(punkter.nth(i)).toHaveAttribute('data-state', 'tidligere');
        // Dempet = --color-agenda-past (muted), aldri opasitet (designsystem §12.4/§11.9, WCAG-kontrast). Endret av frontend.
        const farge = (l: typeof nå) => l.evaluate((el) => getComputedStyle(el).color);
        expect(await farge(punkter.nth(i)), 'tidligere punkt er dempet (annen farge enn gjeldende)').not.toBe(await farge(nå));
        // QA (sluttest): «dempet» = lavere kontrast enn gjeldende punkt, men fortsatt AA.
        const [kTidligere, kNå] = [await kontrast(punkter.nth(i)), await kontrast(nå)];
        expect(kTidligere, `kontrast tidligere ${kTidligere.toFixed(2)} < gjeldende ${kNå.toFixed(2)}`).toBeLessThan(kNå);
        expect(kTidligere, 'tidligere punkt har fortsatt AA-kontrast').toBeGreaterThanOrEqual(4.5);
      }
      await expect(agendalinje(page)).toBeHidden();
    }
  });

  test('TC-2-05-06 `:agenda av` fjerner overgangene i gjeldende presentasjon og beholder lysbildet', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 7); // Oppgaver
    await kjørKommando(page, 'agenda av');
    await expect(lysbildeOverskrift(page)).toHaveText('Oppgaver');
    const uten = s.lysbilder.filter((l) => l.type !== 'overgang');
    expect(await lesAlleLysbilder(page)).toEqual(uten.map(somFasit));
  });

  test('TC-2-05-07 `:agenda av` huskes ikke: ny presentasjon og reload har overganger igjen (ADR-010 §4)', async ({ page }) => {
    await presenter(page, s.sti);
    await kjørKommando(page, 'agenda av');
    await avsluttPresentasjon(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await startPresentasjon(page);
    expect((await nummer(page)).av).toBe(s.lysbilder.length);
    await kjørKommando(page, 'agenda av');
    await page.reload();
    await ventPåPresentasjon(page);
    expect((await nummer(page)).av).toBe(s.lysbilder.length);
  });

  test('TC-2-05-08 notat uten overskrifter: ingen agenda og ingen overganger (S7)', async ({ page }) => {
    await presenter(page, fasit2.uten.sti);
    const lest = await lesAlleLysbilder(page);
    expect(lest.filter((l) => l.type === 'agenda' || l.type === 'overgang')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// AK-2-06
// ---------------------------------------------------------------------------------------------

test.describe('AK-2-06 agendalinjen', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');

  test('TC-2-06-01 vises på alle innholdslysbilder med gjeldende punkt uthevet og progresjon; skjult ellers', async ({ page }) => {
    await presenter(page, s.sti);
    for (let i = 0; i < s.lysbilder.length; i++) {
      const l = s.lysbilder[i]!;
      await ventPåLysbilde(page, i + 1);
      if (l.type === 'innhold') {
        await expect(agendalinje(page)).toBeVisible();
        expect((await agendalinje(page).getByRole('listitem').allInnerTexts()).map((t) => t.replace(/\s*\d+\s*\/\s*\d+\s*$/, '').trim())).toEqual(s.agenda);
        await expect(agendalinje(page).locator('[aria-current="step"]')).toContainText(l.agendapunkt!);
        await expect(agendaProgresjon(page)).toHaveText(new RegExp(`^\\s*${l.progresjon!.replace('/', '\\s*/\\s*')}\\s*$`));
        await expect(agendaEllipse(page)).toHaveCount(0);
      } else {
        await expect(agendalinje(page)).toBeHidden();
      }
      if (i < s.lysbilder.length - 1) await page.keyboard.press('j');
    }
  });

  test('TC-2-06-02 agendalinjen er diskré: øverst på lysbildet, mindre og svakere enn overskriften', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 4);
    const linje = await agendalinje(page).boundingBox();
    const h = await lysbildeOverskrift(page).boundingBox();
    expect(linje!.y).toBeLessThan(h!.y);
    const fs = async (sel: 'agendalinje' | 'overskrift') =>
      (sel === 'agendalinje' ? agendalinje(page) : lysbildeOverskrift(page)).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await fs('agendalinje')).toBeLessThan(await fs('overskrift'));
  });

  test('TC-2-06-03 8 agendapunkter ved 1280×720: avkortet til forrige · nåværende · neste med «…»', async ({ page }) => {
    const m = fasit2.mange;
    await page.setViewportSize(m.avkortingViewport);
    await presenter(page, m.sti);
    for (const [overskrift, forventet] of Object.entries(m.avkortet)) {
      const nr = m.lysbilder.findIndex((l) => l.overskrift === overskrift) + 1;
      await gåTilLysbilde(page, nr);
      const synlige = (await agendalinje(page).getByRole('listitem').filter({ visible: true }).allInnerTexts()).map((t) => t.replace(/\s*\d+\s*\/\s*\d+\s*$/, '').trim());
      expect(synlige, overskrift).toEqual(forventet.synlige);
      await expect(agendaEllipse(page).and(page.locator('[data-side="før"]'))).toHaveCount(forventet.før ? 1 : 0);
      await expect(agendaEllipse(page).and(page.locator('[data-side="etter"]'))).toHaveCount(forventet.etter ? 1 : 0);
      // Avkortet linje får plass på én linje innenfor lerretet.
      const b = await agendalinje(page).boundingBox();
      const lh = await agendalinje(page).evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.5);
      expect(b!.height).toBeLessThan(lh * 1.8);
    }
  });

  test('TC-2-06-04 agendalysbildet viser alle 8 punkter uavkortet', async ({ page }) => {
    await presenter(page, fasit2.mange.sti);
    await page.keyboard.press('j');
    expect(await agendaTekster(page)).toEqual(fasit2.mange.agenda);
  });

  test('TC-2-06-05 rapport: agendapunkter fra innebygde notater og vertens egen H2 vises likt', async ({ page }) => {
    await presenter(page, fasit2.rapport.sti);
    await gåTilLysbilde(page, 4);
    expect((await agendalinje(page).getByRole('listitem').allInnerTexts()).map((t) => t.replace(/\s*\d+\s*\/\s*\d+\s*$/, '').trim())).toEqual(fasit2.rapport.agenda);
  });
});

// ---------------------------------------------------------------------------------------------
// AK-2-07 live endring under presentasjon (egen server per test)
// ---------------------------------------------------------------------------------------------

liveTest.describe('AK-2-07 live oppdatering', () => {
  liveTest.skip(({ isMobile }) => isMobile, 'Desktop');
  const fil = (vault: string) => join(vault, `${s.sti}.md`);

  liveTest('TC-2-07-01 endret agendaoverskrift: agendalinje og agenda oppdateres, lysbildet beholdes', async ({ page, live }) => {
    await page.goto(live.url(s.sti));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await startPresentasjon(page);
    await gåTilLysbilde(page, 7); // Oppgaver
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
    writeFileSync(fil(live.vault), readFileSync(fil(live.vault), 'utf8').replace(s.live.agendaFra, s.live.agendaTil));
    const ny = s.live.agendaTil.replace(/^#+\s*/, '');
    await expect(agendalinje(page).locator('[aria-current="step"]')).toContainText(ny, { timeout: 5000 });
    await expect(lysbildeOverskrift(page)).toHaveText('Oppgaver');
    expect((await nummer(page)).n).toBe(7);
    // Ingen full sidelasting.
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
    // Agenda og overgang er også oppdatert.
    await gåTilLysbilde(page, 2);
    expect(await agendaTekster(page)).toContain(ny);
    await gåTilLysbilde(page, 6);
    await expect(agendaliste(page).locator('[aria-current="step"]')).toHaveText(ny);
  });

  liveTest('TC-2-07-02 sletting av lysbildet man står på: nærmeste nabo vises, etterfølger før forgjenger (ADR-010 §5)', async ({ page, live }) => {
    await page.goto(live.url(s.sti));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await startPresentasjon(page);
    await gåTilLysbilde(page, 5); // Leveranse B
    const innhold = readFileSync(fil(live.vault), 'utf8');
    const start = innhold.indexOf(s.live.slettSeksjon);
    const slutt = innhold.indexOf('## Jobbes med nå');
    writeFileSync(fil(live.vault), innhold.slice(0, start) + innhold.slice(slutt));
    const e = s.live.etterSletting;
    await expect.poll(async () => (await nummer(page)).av, { timeout: 5000 }).toBe(e.av);
    expect(await nummer(page)).toEqual({ n: e.n, av: e.av });
    const l = await lesLysbilde(page);
    expect([l.type, l.agendapunkt]).toEqual([e.type, e.agendapunkt]);
    // Progresjonen i «Siden sist» er nå 1/1.
    await page.keyboard.press('k');
    await expect(agendaProgresjon(page)).toHaveText(/1\s*\/\s*1/);
  });

  liveTest('TC-2-07-03 nytt lysbilde før gjeldende: samme overskrift vises, nummeret øker', async ({ page, live }) => {
    await page.goto(live.url(s.sti));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await startPresentasjon(page);
    await gåTilLysbilde(page, 7);
    writeFileSync(fil(live.vault), readFileSync(fil(live.vault), 'utf8').replace('### Leveranse B', '### Leveranse A2\n\nNytt lysbilde.\n\n### Leveranse B'));
    await expect.poll(async () => (await nummer(page)).n, { timeout: 5000 }).toBe(8);
    await expect(lysbildeOverskrift(page)).toHaveText('Oppgaver');
    expect((await lesLysbilde(page)).agendapunkt).toBe('Jobbes med nå');
  });

  liveTest('TC-2-07-04 endret innhold på gjeldende lysbilde vises uten å flytte posisjonen', async ({ page, live }) => {
    await page.goto(live.url(s.sti));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await startPresentasjon(page);
    await gåTilLysbilde(page, 10);
    writeFileSync(fil(live.vault), readFileSync(fil(live.vault), 'utf8').replace('Markør STATUS-PLAN.', 'Markør STATUS-PLAN-ENDRET.'));
    await expect(lysbilde(page)).toContainText('STATUS-PLAN-ENDRET', { timeout: 5000 });
    expect((await nummer(page)).n).toBe(10);
  });

  liveTest('TC-2-07-05 notatet slettes under presentasjon: presentasjonen avsluttes med en forklaring', async ({ page, live, guards }) => {
    // Refetch etter sletting gir 404 i konsollen (som ak12-live-reload). Lagt til av frontend.
    guards.allowConsole.push(/status of 404/);
    await page.goto(live.url(s.sti));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await startPresentasjon(page);
    const { rmSync } = await import('node:fs');
    rmSync(fil(live.vault));
    await expect(page.getByText(/ikke skrevet ennå|finnes ikke|slettet/i).first()).toBeVisible({ timeout: 8000 });
  });
});
