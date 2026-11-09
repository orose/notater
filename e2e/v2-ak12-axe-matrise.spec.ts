// AK-2-12 WCAG AA (axe 0 brudd) i alle 3 typesett × 4 paletter × lys/mørk = 24 kombinasjoner, med
// presentasjonens tilstander: tittel, agenda, overgang, innhold med agendalinje, kanban, Mermaid, «(forts.)»,
// oversikt (`o`), palett (`:`), ?-kortet i present-modus. Desktop 1440×900 (fargene er like på mobil;
// mobil-axe: TC-2-12-14). Testplan: TC-2-12-20. TDD: `test.fixme` til levert.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, noteUrl, test } from './support/guards';
import { fasit2, gåTilLysbilde, oversikt, startPresentasjon, ventPåLysbilde } from './support/v2';
import { hurtigtastoversikt, palett } from './support/v11';

const TYPES = ['tidsskrift', 'terminal', 'klartekst'] as const;
const PALETTES = ['papir', 'cyanotypi', 'fosfor', 'signal'] as const;
const MODES = ['light', 'dark'] as const;
const s = fasit2.statusmote;

async function axe(page: Page, hva: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return res.violations.flatMap((v) => v.nodes.map((n) => `${hva}: ${v.id} ${n.target.join(' ')} – ${(n.any[0]?.message ?? '').slice(0, 100)}`));
}

test.describe('AK-2-12 axe i alle 24 temakombinasjoner i presentasjonsmodus', () => {
  test.skip(({ isMobile }) => isMobile, 'Fargene er de samme på mobil');
  for (const type of TYPES) {
    for (const palette of PALETTES) {
      for (const mode of MODES) {
        test(`TC-2-12-20 ${type} × ${palette} × ${mode}`, async ({ page }) => {
          test.slow();
          await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: mode });
          await page.goto(`${noteUrl(s.sti)}?type=${type}&palette=${palette}&mode=${mode}`);
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
          await page.evaluate(() => window.scrollTo(0, 0));
          await startPresentasjon(page);
          const brudd: string[] = [];

          // Tittel, agenda, overgang, innhold (agendalinje + kode), kanban, Mermaid, tabell + fotnote.
          for (const [nr, hva] of [[1, 'tittel'], [2, 'agenda'], [6, 'overgang'], [5, 'innhold + kode'], [7, 'kanban'], [8, 'mermaid'], [10, 'tabell + fotnote']] as const) {
            await gåTilLysbilde(page, nr);
            if (nr === 8) await page.locator('[data-testid="lysbilde"] svg').first().waitFor({ timeout: 15_000 });
            brudd.push(...(await axe(page, hva)));
          }

          // Oversikten.
          await page.keyboard.press('o');
          await expect(oversikt(page)).toBeVisible();
          brudd.push(...(await axe(page, 'oversikt')));
          await page.keyboard.press('Escape');

          // Palett i present-modus.
          await page.keyboard.press(':');
          await expect(palett(page).getByRole('option').first()).toBeVisible();
          brudd.push(...(await axe(page, 'palett :')));
          await page.keyboard.press('Escape');

          // ?-kortet i present-modus.
          await page.keyboard.press('Shift+Slash');
          await expect(hurtigtastoversikt(page)).toBeVisible();
          brudd.push(...(await axe(page, '?-kortet')));
          await page.keyboard.press('Escape');

          // «(forts.)» i Delte lysbilder (eget notat, samme tema).
          await page.keyboard.press('Escape');
          await page.goto(`${noteUrl(fasit2.delte.sti)}?type=${type}&palette=${palette}&mode=${mode}`);
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
          await startPresentasjon(page);
          await gåTilLysbilde(page, 5);
          await ventPåLysbilde(page, 5);
          brudd.push(...(await axe(page, '(forts.)')));

          expect(brudd).toEqual([]);
        });
      }
    }
  }
});
