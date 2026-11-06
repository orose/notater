// BUG-014 (docs/test/bugs.md): toast, zen-hint og which-key la seg oppå hverandre, og på 360 px ble
// zen-hintet uleselig. Nå stables de i én varselsone nederst: toasts øverst, which-key alltid nederst, og en
// ny toast fjerner zen-hintet. Skrevet av frontend. Kjøres på desktop (1440 px) og mobil (360 px).
import type { Locator, Page } from '@playwright/test';
import { expect, openNote, test } from './support/guards';
import { fasit, fokusPåInnhold, kjørKommando, leaderHint, trykkSekvens } from './support/v11';

const toastLoc = (page: Page): Locator => page.locator('.notice-zone .toast');
const zenHint = (page: Page): Locator => page.getByTestId('zen-hint');

async function boks(loc: Locator) {
  const b = await loc.boundingBox();
  if (!b) throw new Error('mangler boks');
  return b;
}

/** Ingen overlapp mellom boksene (1 px slingring), og alle er innenfor vinduet. */
async function forventIkkeOverlapp(page: Page, ...locs: Locator[]): Promise<void> {
  const bokser = await Promise.all(locs.map(boks));
  const bredde = await page.evaluate(() => window.innerWidth);
  for (const b of bokser) {
    expect(b.x).toBeGreaterThanOrEqual(-1);
    expect(b.x + b.width).toBeLessThanOrEqual(bredde + 1);
  }
  for (let i = 0; i < bokser.length; i++) {
    for (let j = i + 1; j < bokser.length; j++) {
      const a = bokser[i] as NonNullable<Awaited<ReturnType<typeof boks>>>;
      const c = bokser[j] as NonNullable<Awaited<ReturnType<typeof boks>>>;
      const overlapp = a.x < c.x + c.width - 1 && c.x < a.x + a.width - 1 && a.y < c.y + c.height - 1 && c.y < a.y + a.height - 1;
      expect(overlapp, `varsel ${i} og ${j} overlapper`).toBe(false);
    }
  }
}

async function slåPåZen(page: Page): Promise<void> {
  await openNote(page, fasit.langBrodtekst.sti);
  await page.evaluate(() => localStorage.removeItem('vault-leser.hint.zen'));
  await kjørKommando(page, 'zen');
  await expect(page.locator('html')).toHaveAttribute('data-zen', 'on');
  await expect(zenHint(page)).toBeVisible();
}

test('BUG-014 zen-hint og which-key vises samtidig uten overlapp; which-key nederst', async ({ page }) => {
  await slåPåZen(page);
  await fokusPåInnhold(page);
  await page.keyboard.press('Space');
  await expect(leaderHint(page)).toBeVisible();
  await expect(zenHint(page)).toBeVisible();
  await forventIkkeOverlapp(page, zenHint(page), leaderHint(page));
  expect((await boks(leaderHint(page))).y).toBeGreaterThan((await boks(zenHint(page))).y);
  await page.keyboard.press('Escape');
});

test('BUG-014 en toast erstatter zen-hintet, og står over which-key uten overlapp', async ({ page }) => {
  await slåPåZen(page);
  await fokusPåInnhold(page);
  await trykkSekvens(page, ['Space', 'w']);
  await expect(toastLoc(page)).toContainText(/bredde/i);
  await expect(zenHint(page)).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(leaderHint(page)).toBeVisible();
  await expect(toastLoc(page)).toBeVisible();
  await forventIkkeOverlapp(page, toastLoc(page), leaderHint(page));
  expect((await boks(leaderHint(page))).y).toBeGreaterThan((await boks(toastLoc(page))).y);
  await page.keyboard.press('Escape');
});
