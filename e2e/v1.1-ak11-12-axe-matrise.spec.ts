// AK-1.1-11/12: WCAG AA (axe 0 brudd) i alle 3 typesett × 4 paletter × lys/mørk = 24 kombinasjoner, med
// v1.1-tilstandene aktive: diskré rapport, foldet seksjon, zen + full bredde, palett i kommandomodus og ?-kortet.
// Desktop (fargene er like på mobil; mobil-axe dekkes av TC-12-01). Akseptansetest v1.1.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, noteUrl, test } from './support/guards';
import { artikkel, fasit, foldKnapp, fokusPåInnhold, hurtigtastoversikt, palett, trykkSekvens } from './support/v11';

const TYPES = ['tidsskrift', 'terminal', 'klartekst'] as const;
const PALETTES = ['papir', 'cyanotypi', 'fosfor', 'signal'] as const;
const MODES = ['light', 'dark'] as const;

async function axe(page: Page, hva: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return res.violations.flatMap((v) => v.nodes.map((n) => `${hva}: ${v.id} ${n.target.join(' ')} – ${(n.any[0]?.message ?? '').slice(0, 100)}`));
}

test.describe('AK-1.1-12 axe i alle 24 temakombinasjoner med v1.1-kontrollene', () => {
  test.skip(({ isMobile }) => isMobile, 'Fargene er de samme på mobil');
  for (const type of TYPES) {
    for (const palette of PALETTES) {
      for (const mode of MODES) {
        test(`${type} × ${palette} × ${mode}`, async ({ page }) => {
          test.slow();
          await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: mode });
          await page.goto(`${noteUrl(fasit.rapport.sti)}?type=${type}&palette=${palette}&mode=${mode}`);
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
          const brudd: string[] = [];

          // Diskré embedding + foldet seksjon (kildelenke synlig via hover, fold-indikator synlig).
          await fokusPåInnhold(page);
          await trykkSekvens(page, ['Space', 'd']);
          await expect(artikkel(page).getByText('Innebygd fra', { exact: true })).toHaveCount(0);
          await foldKnapp(page, 'Nøkkeltall').click();
          await artikkel(page).getByText('Driften i kvartalet var stabil.').hover();
          await page.waitForTimeout(150);
          brudd.push(...(await axe(page, 'diskré + foldet')));

          // Zen + full bredde.
          await fokusPåInnhold(page);
          await trykkSekvens(page, ['Space', 'z']);
          await trykkSekvens(page, ['Space', 'w']);
          await expect(page.locator('html')).toHaveAttribute('data-zen', 'on');
          brudd.push(...(await axe(page, 'zen + full bredde')));

          // Palett i kommandomodus.
          await page.keyboard.press(':');
          await expect(palett(page).getByRole('option').first()).toBeVisible();
          brudd.push(...(await axe(page, 'palett :')));
          await page.keyboard.press('Escape');
          await expect(palett(page)).toHaveCount(0);

          // ?-kortet.
          await fokusPåInnhold(page);
          await page.keyboard.press('Shift+Slash');
          await expect(hurtigtastoversikt(page)).toBeVisible();
          brudd.push(...(await axe(page, '?-kortet')));

          expect(brudd).toEqual([]);
        });
      }
    }
  }
});
