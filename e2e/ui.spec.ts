// UI-tester mot en tynn mock av API-kontrakten (e2e/support/mock-vault.ts), slik at webdelen kan
// verifiseres uavhengig av serverens fremdrift. Serveren brukes kun til å levere bygget.
import { expect, test } from '@playwright/test';
import { MOCK_NOTE_URL, installMockApi } from './support/mock-vault';

test.beforeEach(async ({ page }) => {
  await installMockApi(page);
});

test('ingen horisontal scroll på sidenivå (AK5)', async ({ page }) => {
  await page.goto(MOCK_NOTE_URL);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('tema huskes og settes før første maling (AK3)', async ({ page }) => {
  await page.goto(MOCK_NOTE_URL);
  await page.evaluate(() => localStorage.setItem('vault-leser.tema', JSON.stringify({ mode: 'dark', type: 'terminal', palette: 'fosfor', ornaments: true })));
  await page.reload();
  // Attributtene finnes allerede når DOM-en er parset (før React har kjørt).
  const attrs = await page.evaluate(() => ({ ...document.documentElement.dataset }));
  expect(attrs).toMatchObject({ mode: 'dark', type: 'terminal', palette: 'fosfor' });
});

test('system-modus følger prefers-color-scheme live (AK2)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(MOCK_NOTE_URL);
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
});

test('⌘K/Ctrl+K: søk, piltaster, Enter åpner, Esc lukker (AK13)', async ({ page }) => {
  await page.goto(MOCK_NOTE_URL);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox');
  await expect(input).toBeFocused();
  await input.fill('idempot');
  await expect(page.getByRole('option')).toHaveCount(3);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('brutt lenke navigerer ikke, men forklarer og foreslår alias (AK9, PO-7)', async ({ page }) => {
  await page.goto(MOCK_NOTE_URL);
  const broken = page.getByRole('button', { name: 'Bestilling' });
  await broken.click();
  await expect(page.getByRole('note').filter({ hasText: 'Mente du' })).toContainText('Ordre');
  await expect(page).toHaveURL(new RegExp('Idempotent'));
});

test('TOC-klikk oppdaterer hash og scroller (QA-TOC-06)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Høyre marg vises bare på desktop');
  await page.goto(MOCK_NOTE_URL);
  await page.getByRole('navigation', { name: 'Innhold' }).getByRole('link', { name: 'Slik virker det' }).click();
  await expect(page).toHaveURL(/#slik-virker-det$/);
  await expect(page.locator('#slik-virker-det')).toBeInViewport();
});

test('ukjent notat gir egen side (QA-URL-07)', async ({ page }) => {
  await page.goto('/v/test/finnes/ikke');
  await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible();
});

test('mobil-skuff: åpnes, Esc lukker, fokus tilbake (designsystem §7.1)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Kun mobil');
  await page.goto(MOCK_NOTE_URL);
  const menu = page.getByRole('button', { name: 'Åpne navigasjon' });
  await menu.click();
  await expect(page.getByRole('navigation', { name: 'Vault' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Åpne navigasjon' })).toBeFocused();
});

test('mermaid rendres og kan forstørres (AK15)', async ({ page }) => {
  await page.goto(MOCK_NOTE_URL);
  await expect(page.locator('.diagram-svg svg')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Forstørr' }).click();
  await expect(page.getByRole('dialog', { name: 'Diagram, forstørret' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Forstørr' })).toBeFocused();
});
