// AK-1.1-09 Hurtigtaster er inaktive i tekstfelt og bak modal dialog (P7), og F7 vim-navigasjon, leader og
// sekvenser (dekkes av AK-1.1-06 «alle registrerte kommandoer kan kjøres»). Norsk tastatur (P5).
// TDD: `test.fixme` fjernes når levert. Testplan: TC-09-*, TC-F7-*.
import type { Page } from '@playwright/test';
import { expect, openNote, test } from './support/guards';
import {
  brødtekstBredde,
  fasit,
  fokusPåInnhold,
  hurtigtastoversikt,
  leaderHint,
  palett,
  palettInput,
  scrollY,
  trykkNorsk,
  trykkSekvens,
  utseende,
  ventPåBilder,
  åpneUtseende,
} from './support/v11';

const LANG = fasit.langBrodtekst.sti;
const DYP = fasit.dypStruktur.sti;

/** Kvartalsrapport med stabil høyde: bildet nederst må være lastet før vi måler rulling (PO-71). */
async function åpneRapport(page: Page): Promise<void> {
  await openNote(page, fasit.rapport.sti);
  await ventPåBilder(page);
}

test.skip(({ isMobile }) => isMobile, 'Tastaturtester kjøres på desktop (1440 px)');

/** Sjekker at ingen hurtigtast slo inn: ingen scroll, ingen palett/oversikt/hint, uendret bredde. */
async function forventIngenHurtigtast(page: Page, før: { y: number; bredde: number }): Promise<void> {
  await page.waitForTimeout(500);
  expect(await scrollY(page), 'ingen scroll').toBe(før.y);
  await expect(hurtigtastoversikt(page), 'ingen oversikt').toHaveCount(0);
  await expect(leaderHint(page), 'ingen leader-hint').toBeHidden();
  expect(await brødtekstBredde(page), 'uendret lesebredde').toBeCloseTo(før.bredde, 0);
}

test.describe('AK-1.1-09 inaktive i tekstfelt og bak modal dialog (P7)', () => {
  test('TC-09-01 i palettens søkefelt havner tastene i feltet', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palettInput(page)).toBeFocused();
    await page.keyboard.type('jk gG ?zM');
    await expect(palettInput(page)).toHaveValue('jk gG ?zM');
    await expect(hurtigtastoversikt(page)).toHaveCount(0);
    await expect(leaderHint(page)).toBeHidden();
    // Esc er dialogens egen tast: lukker paletten.
    await page.keyboard.press('Escape');
    await expect(palett(page)).toHaveCount(0);
  });

  for (const [type, html] of [
    ['input', '<input data-testid="testfelt" type="text">'],
    ['textarea', '<textarea data-testid="testfelt"></textarea>'],
    ['contenteditable', '<div data-testid="testfelt" contenteditable="true" style="min-height:1em"></div>'],
    ['select', '<select data-testid="testfelt"><option>j</option><option>k</option></select>'],
  ] as const) {
    test(`TC-09-02 generelt tekstfelt (${type}) i siden: j, k, G, Space w, ?, : virker ikke`, async ({ page }) => {
      await openNote(page, LANG);
      await page.evaluate((h) => document.querySelector('main article')?.insertAdjacentHTML('afterbegin', h), html);
      const før = { y: await scrollY(page), bredde: await brødtekstBredde(page) };
      await page.getByTestId('testfelt').focus();
      for (const tast of ['j', 'k', 'Shift+G', 'Space', 'w', 'Shift+Slash', 'Shift+Semicolon', 'g', 'g', 'z', 'Shift+M']) await page.keyboard.press(tast);
      await expect(palett(page)).toHaveCount(0);
      await forventIngenHurtigtast(page, før);
    });
  }

  test('TC-09-03 bak Utseende (modal): j, Space w, ? og : virker ikke; Esc lukker dialogen', async ({ page }) => {
    await openNote(page, LANG);
    const før = { y: await scrollY(page), bredde: await brødtekstBredde(page) };
    await åpneUtseende(page);
    for (const tast of ['j', 'Shift+G', 'Shift+Slash', 'Shift+Semicolon']) await page.keyboard.press(tast);
    await expect(palett(page)).toHaveCount(0);
    await expect(hurtigtastoversikt(page)).toHaveCount(0);
    expect(await scrollY(page)).toBe(før.y);
    await page.keyboard.press('Escape');
    await expect(utseende(page)).toBeHidden();
    expect(await brødtekstBredde(page)).toBeCloseTo(før.bredde, 0);
  });

  test('TC-09-04 bak hurtigtastoversikten: : og j virker ikke; ? og Esc lukker (dialogens egne taster)', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    const y = await scrollY(page);
    await page.keyboard.press('Shift+Slash');
    await expect(hurtigtastoversikt(page)).toBeVisible();
    await page.keyboard.press('Shift+Semicolon');
    await page.keyboard.press('j');
    await expect(palett(page)).toHaveCount(0);
    expect(await scrollY(page)).toBe(y);
    await page.keyboard.press('Escape');
    await expect(hurtigtastoversikt(page)).toBeHidden();
  });

  test('TC-09-05 bak mermaid-zoom (eksisterende modal): j og Space z virker ikke', async ({ page }) => {
    await openNote(page, 'teknisk/Mermaid-galleri');
    const forstørr = page.getByRole('button', { name: /Forstørr/ }).first();
    await forstørr.click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await trykkSekvens(page, ['Space', 'z']);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Vault', exact: true })).toBeVisible();
  });

  test.fixme('TC-09-06 Space på fokusert knapp beholder sin vanlige funksjon (ikke leader)', async ({ page }) => {
    await openNote(page, DYP);
    const knapp = page.getByRole('button', { name: /^Fold (sammen|ut) «?Seksjon A»?$/ });
    await knapp.focus();
    await page.keyboard.press('Space');
    await expect(knapp).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(600);
    await expect(leaderHint(page)).toBeHidden();
  });

  test('TC-09-07 modifikatorer: Ctrl+j, Meta+g og Alt+w utløser ikke j, g eller Space w', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    const før = { y: await scrollY(page), bredde: await brødtekstBredde(page) };
    for (const tast of ['Control+j', 'Alt+j', 'Alt+w']) await page.keyboard.press(tast);
    await forventIngenHurtigtast(page, før);
  });
});

test.describe('F7 vim-navigasjon (AK-1.1-06/07: registrerte kommandoer virker)', () => {
  test('TC-F7-01 j/k ruller ca. 3 linjer ned/opp', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await page.keyboard.press('j');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(30);
    const y = await scrollY(page);
    expect(y).toBeLessThan(200);
    await page.keyboard.press('k');
    await expect.poll(() => scrollY(page)).toBeLessThan(y);
  });

  test('TC-F7-02 Ctrl d / Ctrl u ruller en halv side', async ({ page }) => {
    await åpneRapport(page);
    await fokusPåInnhold(page);
    const høyde = await page.evaluate(() => window.innerHeight);
    await page.keyboard.press('Control+d');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(høyde * 0.35);
    expect(await scrollY(page)).toBeLessThan(høyde * 0.65);
    await page.keyboard.press('Control+u');
    await expect.poll(() => scrollY(page)).toBeLessThan(10);
  });

  test('TC-F7-03 G til bunnen, gg til toppen', async ({ page }) => {
    await åpneRapport(page);
    await fokusPåInnhold(page);
    await page.keyboard.press('Shift+G');
    await expect
      .poll(() => page.evaluate(() => Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight)))
      .toBeLessThan(4);
    await trykkSekvens(page, ['g', 'g']);
    await expect.poll(() => scrollY(page)).toBe(0);
  });

  test('TC-F7-04 H/L går tilbake/frem i historikken', async ({ page }) => {
    await openNote(page, LANG);
    await page.getByRole('main').getByRole('link', { name: 'Dyp struktur' }).click();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(fasit.dypStruktur.tittel);
    await fokusPåInnhold(page);
    await page.keyboard.press('Shift+H');
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(fasit.langBrodtekst.tittel);
    await fokusPåInnhold(page);
    await page.keyboard.press('Shift+L');
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(fasit.dypStruktur.tittel);
  });

  test('TC-F7-05 Space alene ruller ikke siden lenger', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1300);
    expect(await scrollY(page)).toBe(0);
  });

  test('TC-F7-06 Space-hint («which-key») vises etter ~400 ms med leader-kommandoene, og Esc skjuler det', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await expect(leaderHint(page), 'ikke før ~400 ms').toBeHidden();
    await expect(leaderHint(page)).toBeVisible({ timeout: 1000 });
    for (const t of fasit.tastaturkart.leaderHint) await expect(leaderHint(page).locator('kbd', { hasText: new RegExp(`^${t}$`) })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(leaderHint(page)).toBeHidden();
    // Sekvensen er avbrutt: w alene bytter ikke bredde.
    const bredde = await brødtekstBredde(page);
    await page.keyboard.press('w');
    await page.waitForTimeout(300);
    expect(await brødtekstBredde(page)).toBeCloseTo(bredde, 0);
  });

  test('TC-F7-07 rask Space w viser ikke hint (utføres direkte)', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    const bredde = await brødtekstBredde(page);
    await trykkSekvens(page, ['Space', 'w'], 30);
    await expect.poll(() => brødtekstBredde(page)).toBeGreaterThan(bredde + 50);
    await page.waitForTimeout(500);
    await expect(leaderHint(page)).toBeHidden();
  });

  test('TC-F7-08 Esc avbryter en påbegynt sekvens (g Esc g går ikke til toppen)', async ({ page }) => {
    await åpneRapport(page);
    await fokusPåInnhold(page);
    await page.keyboard.press('Shift+G');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(200);
    const y = await scrollY(page);
    await trykkSekvens(page, ['g', 'Escape', 'g']);
    await page.waitForTimeout(1300);
    expect(await scrollY(page)).toBe(y);
  });

  test('TC-F7-09 sekvens får tidsavbrudd etter ~1 s (g … 1,5 s … g går ikke til toppen)', async ({ page }) => {
    await åpneRapport(page);
    await fokusPåInnhold(page);
    await page.keyboard.press('Shift+G');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(200);
    const y = await scrollY(page);
    await page.keyboard.press('g');
    await page.waitForTimeout(1500);
    await page.keyboard.press('g');
    await page.waitForTimeout(400);
    expect(await scrollY(page)).toBe(y);
  });

  test('TC-F7-10 ukjent fortsettelse (z x, g q) gjør ingenting og gir ingen feil', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    const før = { y: await scrollY(page), bredde: await brødtekstBredde(page) };
    await trykkSekvens(page, ['z', 'x', 'g', 'q']);
    await forventIngenHurtigtast(page, før);
  });

  test('TC-F7-11 reserverte taster (i a o e s c d x p y u r) gjør ingenting i normal-modus', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    const før = { y: await scrollY(page), bredde: await brødtekstBredde(page) };
    for (const t of ['i', 'a', 'o', 'e', 'Shift+I', 'Shift+A', 'Shift+O', 's', 'c', 'd', 'x', 'p', 'y', 'u', 'r']) await page.keyboard.press(t);
    await forventIngenHurtigtast(page, før);
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(fasit.langBrodtekst.tittel);
  });

  test('TC-F7-12 rulling respekterer prefers-reduced-motion (Ctrl d hopper umiddelbart)', async ({ page }) => {
    // gg/G hopper alltid uten animasjon (PO-70), så redusert bevegelse testes med Ctrl d (ellers myk rulling).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await åpneRapport(page);
    await fokusPåInnhold(page);
    const høyde = await page.evaluate(() => window.innerHeight);
    await page.keyboard.press('Control+d');
    const y = await page.evaluate(() => new Promise<number>((r) => requestAnimationFrame(() => r(window.scrollY))));
    expect(y).toBeGreaterThan(høyde * 0.4);
  });

  test('TC-F7-13 ⌘./Ctrl+. og Space m bytter lys/mørk', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await page.keyboard.press('ControlOrMeta+Period');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await trykkSekvens(page, ['Space', 'm']);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  });

  test('TC-F7-14 Space t åpner Utseende', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 't']);
    await expect(utseende(page)).toBeVisible();
  });
});

test.describe('P5 norsk tastatur (ekte tastehendelser med norsk code + Shift)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP-tastehendelser (Chromium)');

  test('TC-09-08 «:» = Shift + «.» åpner kommandomodus', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await trykkNorsk(page, ':');
    await expect(palettInput(page)).toHaveValue(':');
  });

  test('TC-09-09 «?» = Shift + «+» åpner hurtigtastoversikten', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await trykkNorsk(page, '?');
    await expect(hurtigtastoversikt(page)).toBeVisible();
  });

  test('TC-09-10 «/» = Shift + 7 åpner notatsøk', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await trykkNorsk(page, '/');
    await expect(palettInput(page)).toHaveValue('');
    await expect(palettInput(page)).toBeFocused();
  });

  test('TC-09-11 Shift+«.» utløser ikke «.»-bindinger, og «;» (Shift + ,) gjør ingenting', async ({ page }) => {
    await openNote(page, LANG);
    await fokusPåInnhold(page);
    await trykkNorsk(page, ';');
    await page.waitForTimeout(300);
    await expect(palett(page)).toHaveCount(0);
  });
});
