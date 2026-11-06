// AK-1.1-04 Folding av overskrifter (F3). TDD: `test.fixme` fjernes når funksjonen er levert.
// Notat: lesekomfort/Dyp struktur (H1–H6). Fasit: docs/test/v1.1-fasit.json (dypStruktur). Testplan: TC-04-*.
import { expect, openNote, test } from './support/guards';
import {
  artikkel,
  effektivOpasitet,
  fasit,
  foldKnapp,
  fokusPåInnhold,
  forventSynlig,
  forventUsynlig,
  kjørKommando,
  overskrift,
  palettInput,
  tocNav,
  trykkSekvens,
} from './support/v11';

const DS = fasit.dypStruktur;
const tekst = (page: import('@playwright/test').Page, t: string) => artikkel(page).getByText(t, { exact: false });

test.describe('AK-1.1-04 folding med pil', () => {
  for (const s of DS.seksjoner) {
    test.fixme(`TC-04-01 H${s.nivå} «${s.overskrift}»: seksjonen løper til neste overskrift på samme eller høyere nivå`, async ({ page }) => {
      await openNote(page, DS.sti);
      const knapp = foldKnapp(page, s.overskrift);
      await expect(knapp).toHaveAttribute('aria-expanded', 'true');
      await expect(knapp).toHaveAccessibleName(new RegExp(`^Fold sammen «?${s.overskrift.replace(/[.]/g, '\\.')}»?$`));
      await knapp.click();
      await expect(knapp).toHaveAttribute('aria-expanded', 'false');
      for (const t of s.skjuler) await expect(tekst(page, t), `skjult: ${t}`).toBeHidden();
      for (const t of s.beholder) await expect(tekst(page, t), `synlig: ${t}`).toBeVisible();
      // Overskriften selv er fortsatt synlig, med diskret indikator for skjult innhold.
      await expect(overskrift(page, s.overskrift)).toBeVisible();
      await expect(page.getByTestId('fold-indikator')).toHaveCount(1);
      await expect(page.getByTestId('fold-indikator')).toBeVisible();
      await knapp.click();
      await expect(knapp).toHaveAttribute('aria-expanded', 'true');
      for (const t of s.skjuler) await expect(tekst(page, t)).toBeVisible();
      await expect(page.getByTestId('fold-indikator')).toHaveCount(0);
    });
  }

  test.fixme('TC-04-02 pilen er usynlig til hover, og synlig ved hover (desktop)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Touch: se TC-04-03');
    await openNote(page, DS.sti);
    await page.mouse.move(0, 0);
    const knapp = foldKnapp(page, 'Seksjon B');
    await forventUsynlig(knapp);
    await overskrift(page, 'Seksjon B').hover();
    await forventSynlig(knapp);
  });

  test.fixme('TC-04-03 pilen er synlig ved tastaturfokus (Tab) og kan brukes med Enter og Space', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur testes på desktop');
    await openNote(page, DS.sti);
    const knapp = foldKnapp(page, 'Seksjon A');
    await knapp.focus();
    await forventSynlig(knapp);
    await page.keyboard.press('Enter');
    await expect(knapp).toHaveAttribute('aria-expanded', 'false');
    // Space på en fokusert knapp er knappens egen handling, ikke leader (Q-05).
    await page.keyboard.press('Space');
    await expect(knapp).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('leader-hint')).toBeHidden();
  });

  test.fixme('TC-04-04 touch: pilen er alltid synlig, dempet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch');
    await openNote(page, DS.sti);
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches), 'mobilprosjektet emulerer touch uten hover').toBe(true);
    const knapp = foldKnapp(page, 'Seksjon A');
    await expect(knapp).toBeVisible();
    const o = await effektivOpasitet(knapp);
    expect(o).toBeGreaterThan(0.2);
    await knapp.tap();
    await expect(knapp).toHaveAttribute('aria-expanded', 'false');
    await expect(tekst(page, 'Markør A-2.')).toBeHidden();
    // Trykkflate ≥ 24 px (WCAG 2.5.8) – designsystemet bruker 44 px på mobil.
    const box = await knapp.boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(24);
  });

  test.fixme('TC-04-05 innhold før første overskrift kan ikke foldes og forblir synlig', async ({ page }) => {
    await openNote(page, DS.sti);
    await kjørKommando(page, 'fold alle');
    await expect(artikkel(page).getByRole('link', { name: DS.dyplenke.lenketekst })).toBeVisible();
  });
});

test.describe('AK-1.1-04 folding med tastatur (za, zM, zR)', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur testes på desktop');

  test.fixme('TC-04-06 zM folder alle, zR folder ut alle', async ({ page }) => {
    await openNote(page, DS.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['z', 'Shift+M']);
    for (const s of DS.seksjoner) for (const t of s.skjuler) await expect(tekst(page, t)).toBeHidden();
    // Toppnivå-overskriftene er synlige (foldet), underliggende er skjult inne i foldet forelder.
    await expect(overskrift(page, 'Seksjon A')).toBeVisible();
    await expect(overskrift(page, 'Andre del')).toBeVisible();
    await expect(overskrift(page, 'Seksjon A.1')).toBeHidden();
    await trykkSekvens(page, ['z', 'Shift+R']);
    for (const s of DS.seksjoner) for (const t of s.skjuler) await expect(tekst(page, t)).toBeVisible();
  });

  test.fixme('TC-04-07 za på fokusert overskrift', async ({ page }) => {
    await openNote(page, DS.sti);
    await foldKnapp(page, 'Seksjon A.1').focus();
    await trykkSekvens(page, ['z', 'a']);
    await expect(foldKnapp(page, 'Seksjon A.1')).toHaveAttribute('aria-expanded', 'false');
    await expect(tekst(page, 'Markør A-3.')).toBeHidden();
    await trykkSekvens(page, ['z', 'a']);
    await expect(tekst(page, 'Markør A-3.')).toBeVisible();
  });

  test.fixme('TC-04-08 za ved leseposisjon: nærmeste overskrift over toppen av visningen', async ({ page }) => {
    await openNote(page, DS.sti);
    await overskrift(page, 'Seksjon B').evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 8, behavior: 'instant' }));
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['z', 'a']);
    await expect(foldKnapp(page, 'Seksjon B')).toHaveAttribute('aria-expanded', 'false');
    await expect(foldKnapp(page, 'Seksjon A')).toHaveAttribute('aria-expanded', 'true');
  });

  test.fixme('TC-04-09 :fold alle og :utfold alle i paletten', async ({ page }) => {
    await openNote(page, DS.sti);
    await kjørKommando(page, 'fold alle');
    await expect(tekst(page, 'Markør C-2.')).toBeHidden();
    await kjørKommando(page, 'utfold alle');
    await expect(tekst(page, 'Markør C-2.')).toBeVisible();
  });
});

test.describe('AK-1.1-04 automatisk utfolding og ingen hukommelse', () => {
  test.fixme('TC-04-10 dyplenke #^blokk folder ut alle forfedre, og bare dem', async ({ page }) => {
    await openNote(page, DS.sti);
    await kjørKommando(page, 'fold alle');
    await artikkel(page).getByRole('link', { name: DS.dyplenke.lenketekst }).click();
    await expect(tekst(page, DS.dyplenke.mål)).toBeVisible();
    await expect(tekst(page, DS.dyplenke.mål)).toBeInViewport();
    for (const h of DS.dyplenke.måUtfoldes) await expect(foldKnapp(page, h), h).toHaveAttribute('aria-expanded', 'true');
    for (const h of DS.dyplenke.forblirFoldet) await expect(foldKnapp(page, h), h).toHaveAttribute('aria-expanded', 'false');
  });

  test.fixme('TC-04-11 dyplenke til #overskrift i foldet seksjon folder ut', async ({ page }) => {
    await openNote(page, DS.sti);
    await kjørKommando(page, 'fold alle');
    await artikkel(page).getByRole('link', { name: 'Nivå 6 – bunnen' }).click();
    await expect(overskrift(page, 'Nivå 6 – bunnen')).toBeInViewport();
    await expect(tekst(page, 'Markør A-6.')).toBeVisible();
  });

  test.fixme('TC-04-12 klikk i TOC folder ut', async ({ page, isMobile }) => {
    test.skip(isMobile, 'TOC i høyremargen (desktop)');
    await openNote(page, DS.sti);
    await kjørKommando(page, 'fold alle');
    await tocNav(page).getByRole('link', { name: 'Seksjon A.1.1' }).click();
    await expect(tekst(page, 'Markør A-4.')).toBeVisible();
    await expect(overskrift(page, 'Seksjon A.1.1')).toBeInViewport();
  });

  test.fixme('TC-04-13 søketreff i foldet seksjon folder ut', async ({ page }) => {
    await openNote(page, DS.sti);
    await kjørKommando(page, 'fold alle');
    await fokusPåInnhold(page);
    await page.keyboard.press('ControlOrMeta+k');
    await palettInput(page).fill(DS.søk.ord);
    await expect(page.getByRole('option').first()).toContainText(DS.tittel);
    await page.keyboard.press('Enter');
    await expect(tekst(page, DS.søk.mål)).toBeVisible();
  });

  test.fixme('TC-04-14 folding huskes ikke: reload, navigasjon bort og tilbake gir alt utfoldet', async ({ page }) => {
    await openNote(page, DS.sti);
    await kjørKommando(page, 'fold alle');
    await page.reload();
    await expect(tekst(page, 'Markør A-2.')).toBeVisible();
    await kjørKommando(page, 'fold alle');
    await openNote(page, fasit.langBrodtekst.sti);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(DS.tittel);
    for (const s of DS.seksjoner) await expect(foldKnapp(page, s.overskrift)).toHaveAttribute('aria-expanded', 'true');
  });
});
