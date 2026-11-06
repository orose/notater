// AK-1.1-05 Zen-modus (F4). TDD: `test.fixme` fjernes når funksjonen er levert. Testplan: TC-05-*.
// Notater: lesekomfort/Lang brødtekst (properties + lenke til Dyp struktur). Fasit: docs/test/v1.1-fasit.json.
import { expect, openNote, test } from './support/guards';
import {
  artikkel,
  brødtekstBredde,
  erZen,
  fasit,
  fokusPåInnhold,
  harHorisontalScroll,
  hurtigtastoversikt,
  høyremarg,
  kjørKommando,
  palett,
  sidepanel,
  trykkSekvens,
  velgLesebredde,
} from './support/v11';

const LANG = fasit.langBrodtekst;

test.describe('AK-1.1-05 zen på desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'Mobil: se egen blokk');

  test('TC-05-00 utgangspunkt: begge panelene vises (P1: frontmatter `zen: true` ignoreres)', async ({ page }) => {
    await openNote(page, LANG.sti);
    await expect(sidepanel(page)).toBeVisible();
    await expect(høyremarg(page)).toBeVisible();
  });

  test('TC-05-01 Space z skjuler begge paneler og krom; tittel og properties beholdes; innholdet sentreres', async ({ page }) => {
    await openNote(page, LANG.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    await expect(sidepanel(page)).toBeHidden();
    await expect(høyremarg(page)).toBeHidden();
    await expect(page.getByText(/Synkronisert|Frakoblet/)).toBeHidden(); // statuslinjen
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(LANG.tittel);
    await expect(page.getByText('forfatter', { exact: false }).first()).toBeVisible();
    const box = await artikkel(page).boundingBox();
    const midt = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    expect(Math.abs(midt - 1440 / 2)).toBeLessThan(40);
  });

  test('TC-05-02 ikke nettleserens fullskjerm, og ingen avsnittsdemping', async ({ page }) => {
    await openNote(page, LANG.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    await expect.poll(() => erZen(page, false)).toBe(true);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    const opasiteter = await artikkel(page)
      .locator('p')
      .evaluateAll((ps) => ps.map((p) => Number(getComputedStyle(p).opacity)));
    expect(opasiteter.every((o) => o === 1)).toBe(true);
  });

  test('TC-05-03 kombinerbar med full bredde', async ({ page }) => {
    await openNote(page, LANG.sti);
    const lese = await brødtekstBredde(page);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    const zenLese = await brødtekstBredde(page);
    await trykkSekvens(page, ['Space', 'w']);
    await expect.poll(() => brødtekstBredde(page)).toBeGreaterThan(Math.max(lese, zenLese) + LANG.minstBredereFullPx);
    expect(await erZen(page, false)).toBe(true);
    expect(await harHorisontalScroll(page)).toBe(false);
  });

  test('TC-05-04 overlever navigasjon: lenkeklikk, H (tilbake) og palett-søk', async ({ page }) => {
    await openNote(page, LANG.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    await artikkel(page).getByRole('link', { name: LANG.lenkeTil }).click();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(fasit.dypStruktur.tittel);
    expect(await erZen(page, false)).toBe(true);
    await fokusPåInnhold(page);
    await page.keyboard.press('Shift+H');
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(LANG.tittel);
    expect(await erZen(page, false)).toBe(true);
    await page.keyboard.press('ControlOrMeta+k');
    await palett(page).getByRole('combobox').fill('Kvartalsrapport');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(fasit.rapport.tittel);
    expect(await erZen(page, false)).toBe(true);
  });

  test('TC-05-05 hurtigtaster og palett virker i zen', async ({ page }) => {
    await openNote(page, LANG.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    await page.keyboard.press('Shift+Slash');
    await expect(hurtigtastoversikt(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(hurtigtastoversikt(page)).toBeHidden();
    expect(await erZen(page, false), 'Esc lukker oversikten, ikke zen').toBe(true);
    await page.keyboard.press('j');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('TC-05-06 avsluttes med Space z', async ({ page }) => {
    await openNote(page, LANG.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    await expect.poll(() => erZen(page, false)).toBe(true);
    await trykkSekvens(page, ['Space', 'z']);
    await expect(sidepanel(page)).toBeVisible();
    await expect(høyremarg(page)).toBeVisible();
  });

  test('TC-05-07 avsluttes med :zen', async ({ page }) => {
    await openNote(page, LANG.sti);
    await kjørKommando(page, 'zen');
    await expect.poll(() => erZen(page, false)).toBe(true);
    await kjørKommando(page, 'zen');
    await expect(sidepanel(page)).toBeVisible();
  });

  test('TC-05-08 Esc avslutter zen bare når ingen dialog er åpen', async ({ page }) => {
    await openNote(page, LANG.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    await page.keyboard.press(':');
    await expect(palett(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palett(page)).toHaveCount(0);
    expect(await erZen(page, false), 'første Esc lukker paletten').toBe(true);
    await page.keyboard.press('Escape');
    await expect(sidepanel(page)).toBeVisible();
  });

  test('TC-05-09 Esc avbryter en påbegynt sekvens før den avslutter zen', async ({ page }) => {
    await openNote(page, LANG.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    await page.keyboard.press('g');
    await page.keyboard.press('Escape');
    expect(await erZen(page, false), 'Esc avbrøt bare sekvensen (Q-07)').toBe(true);
  });

  test('TC-05-10 starter aldri aktivert: reload og ny fane', async ({ page, context }) => {
    await openNote(page, LANG.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'z']);
    await expect.poll(() => erZen(page, false)).toBe(true);
    await page.reload();
    await expect(sidepanel(page)).toBeVisible();
    const ny = await context.newPage();
    await openNote(ny, LANG.sti);
    await expect(sidepanel(ny)).toBeVisible();
    await ny.close();
  });

  test('TC-05-11 nåbar med mus: :zen klikket i paletten', async ({ page }) => {
    await openNote(page, LANG.sti);
    await page.getByRole('button', { name: 'Søk i notater' }).click();
    await palett(page).getByRole('combobox').fill(':zen');
    await palett(page).getByRole('option').first().click();
    await expect.poll(() => erZen(page, false)).toBe(true);
  });
});

test.describe('AK-1.1-05 zen på mobil og touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobil');

  test('TC-05-12 zen skjuler mobil-topplinjen; ingen horisontal scroll; avsluttes med «Avslutt zen» (touch)', async ({ page }) => {
    await openNote(page, LANG.sti);
    await expect(page.getByRole('banner')).toBeVisible();
    await kjørKommando(page, 'zen');
    await expect(page.getByRole('banner')).toBeHidden();
    expect(await harHorisontalScroll(page)).toBe(false);
    // Uten tastatur må zen kunne avsluttes med berøring (Q-09).
    await page.getByRole('button', { name: 'Avslutt zen' }).tap();
    await expect(page.getByRole('banner')).toBeVisible();
  });

  test('TC-05-13 zen + full bredde på 360 px: ingen horisontal scroll', async ({ page }) => {
    await openNote(page, LANG.sti);
    await velgLesebredde(page, 'Full bredde');
    await kjørKommando(page, 'zen');
    expect(await harHorisontalScroll(page)).toBe(false);
    // Navigasjon i appen (ikke page.goto – zen huskes ikke over full sidelasting).
    await artikkel(page).getByRole('link', { name: fasit.rapport.tittel }).tap();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(fasit.rapport.tittel);
    expect(await harHorisontalScroll(page)).toBe(false);
  });
});
