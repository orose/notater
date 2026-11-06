// AK8 temasystem i to akser: 3 typesett × 4 paletter × lys/mørk = 24 kombinasjoner, alle WCAG AA-kontrast
// (axe `color-contrast`) på sidene med flest farger (Callouts, Kodeblokker – syntaksfarger). Teststrategi §2.4.
// Kjøres bare i desktop-prosjektet (fargene er like på mobil; layout dekkes av AK5/AK19-testene).
import AxeBuilder from '@axe-core/playwright';
import { expect, noteUrl, openNote, test } from './support/guards';

const TYPES = ['tidsskrift', 'terminal', 'klartekst'] as const;
const PALETTES = ['papir', 'cyanotypi', 'fosfor', 'signal'] as const;
const MODES = ['light', 'dark'] as const;
const PAGES = ['teknisk/Callouts', 'teknisk/Kodeblokker – alle språk'];

test.describe('AK8 kontrast i alle 24 kombinasjoner', () => {
  test.skip(({ isMobile }) => isMobile, 'Fargene er de samme på mobil');
  for (const type of TYPES) {
    for (const palette of PALETTES) {
      for (const mode of MODES) {
        test(`${type} × ${palette} × ${mode}`, async ({ page }) => {
          test.slow();
          await page.emulateMedia({ reducedMotion: 'reduce' });
          for (const path of PAGES) {
            await page.goto(`${noteUrl(path)}?type=${type}&palette=${palette}&mode=${mode}`);
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
            await expect(page.locator('html')).toHaveAttribute('data-type', type);
            await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
            await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
            await page.waitForTimeout(200);
            const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
            const nodes = result.violations.flatMap((v) => v.nodes.map((n) => `${path}: ${n.target.join(' ')} – ${n.any[0]?.message.slice(0, 120) ?? ''}`));
            expect(nodes).toEqual([]);
          }
        });
      }
    }
  }
});

test.describe('AK8/AK3 valg av typesett og palett huskes', () => {
  test('velg Klartekst + Signal + Mørk i Utseende → reload → fortsatt valgt', async ({ page, isMobile }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openNote(page, 'Velkommen');
    const openPicker = async () => {
      const button = page.getByRole('button', { name: 'Utseende' });
      if (isMobile || !(await button.isVisible())) {
        const menu = page.getByRole('button', { name: 'Åpne navigasjon' });
        if (await menu.isVisible()) await menu.click();
      }
      await page.getByRole('button', { name: 'Utseende' }).first().click();
    };
    await openPicker();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('group', { name: 'Typografi' }).getByRole('radio', { name: /Klartekst/ }).check();
    await dialog.getByRole('group', { name: 'Palett' }).getByRole('radio', { name: /Signal/ }).check();
    await dialog.getByRole('group', { name: 'Modus' }).getByRole('radio', { name: 'Mørk' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-type', 'klartekst');
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'signal');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-type', 'klartekst');
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'signal');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    // Gjelder også ved navigasjon til et annet notat.
    await page.goto(noteUrl('domene/Ordre'));
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'signal');
  });
});
