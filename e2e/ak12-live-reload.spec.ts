// AK12 live reload (QA-IDX-13): endringer i vaultet vises uten manuell refresh.
// Kjører mot en EGEN vault-kopi og egen server per prosjekt, så endringene ikke påvirker andre tester.
// Ingenting skrives i repoet.
import { cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_PORT, copyTestVault, removeDir, startServer, writeConfig, type RunningServer } from './support/real-server';
import { expect, test } from './support/guards';

test.describe.configure({ mode: 'serial' });

let server: RunningServer;
let dir: string;
let vault: string;
let base: string;

// eslint-disable-next-line no-empty-pattern -- Playwright krever objektdestrukturering av fixtures
test.beforeAll(async ({}, info) => {
  const port = E2E_PORT + (info.project.name === 'mobil' ? 6 : 5);
  dir = join(process.env.E2E_TMP_DIR!, `live-${info.project.name}`);
  removeDir(dir);
  mkdirSync(dir, { recursive: true });
  cpSync(join(process.env.E2E_TMP_DIR!, 'dist'), join(dir, 'dist'), { recursive: true });
  vault = copyTestVault(dir);
  server = await startServer(dir, writeConfig(dir, vault, port), port);
  base = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  await server?.stop();
  removeDir(dir);
});

async function waitForBacklinks(request: import('@playwright/test').APIRequestContext, path: string, count: number): Promise<void> {
  await expect
    .poll(async () => ((await (await request.get(`${base}/api/vaults/test/backlinks?path=${encodeURIComponent(path)}`)).json()) as { backlinks: unknown[] }).backlinks.length)
    .toBe(count);
}

const url = (docPath: string) => `${base}/v/test/${docPath.split('/').map(encodeURIComponent).join('/')}`;

test('endring i åpent notat vises uten refresh, innen ~1 s (QA-IDX-13)', async ({ page }) => {
  await page.goto(url('domene/avtale'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
  const file = join(vault, 'domene/avtale.md');
  const original = (await import('node:fs')).readFileSync(file, 'utf8');
  const started = Date.now();
  writeFileSync(file, `${original}\n\nLIVE-ENDRING-${started}\n`);
  await expect(page.locator('main article')).toContainText(`LIVE-ENDRING-${started}`, { timeout: 5000 });
  const elapsed = Date.now() - started;
  test.info().annotations.push({ type: 'måling', description: `live reload: ${elapsed} ms` });
  // Fasit: ~1 s. Grensen har slingringsmonn for delt/belastet testmaskin (debounce 150 ms + awaitWriteFinish).
  expect(elapsed).toBeLessThan(3000);
  // Ingen full sidelasting.
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
});

test('scrollposisjon bevares ved live reload', async ({ page }) => {
  await page.goto(url('edge/Veldig langt notat'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('[id="5-sikkerhet"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(500);
  const file = join(vault, 'edge/Veldig langt notat.md');
  writeFileSync(file, `${(await import('node:fs')).readFileSync(file, 'utf8')}\n\nScroll-test ${Date.now()}\n`);
  await page.waitForTimeout(1500);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThan(100);
});

test('nytt notat dukker opp, og tilbakelenker oppdateres (QA-IDX-13)', async ({ page }) => {
  await page.goto(url('domene/avtale'));
  const backlinks = page.getByRole('region', { name: 'Tilbakelenker' });
  await expect(backlinks.locator('a.bl-title')).toHaveCount(3);
  writeFileSync(join(vault, 'domene/Live ny.md'), '# Live ny\n\nLenker til [[avtale]].\n');
  await expect(backlinks.locator('a.bl-title')).toHaveCount(4, { timeout: 5000 });
  await expect(backlinks).toContainText('Live ny');
});

test('atomisk skriving (tmp + rename, som Obsidian) fanges opp', async ({ page }) => {
  await page.goto(url('domene/Live ny'));
  await expect(page.locator('main article')).toContainText('Lenker til');
  const tmp = join(vault, 'domene/.Live ny.md.tmp');
  writeFileSync(tmp, '# Live ny\n\nATOMISK-OPPDATERT\n');
  renameSync(tmp, join(vault, 'domene/Live ny.md'));
  await expect(page.locator('main article')).toContainText('ATOMISK-OPPDATERT', { timeout: 5000 });
});

test('mange raske endringer debounces og siste versjon vises', async ({ page }) => {
  await page.goto(url('domene/Live ny'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (let i = 0; i < 20; i++) writeFileSync(join(vault, 'domene/Live ny.md'), `# Live ny\n\nVersjon ${i}\n`);
  await expect(page.locator('main article')).toContainText('Versjon 19', { timeout: 5000 });
});

test('slettet notat som er åpent → «ikke skrevet ennå» uten refresh', async ({ page, guards }) => {
  test.fail(true, 'BUG-006: åpent notat blir stående (utdatert) når fila slettes/omdøpes; refetch med 404 viser ikke «ikke skrevet ennå»');
  guards.allowConsole.push(/status of 404/);
  writeFileSync(join(vault, 'domene/Live slett.md'), '# Live slett\n\nLenker til [[avtale]].\n');
  await page.goto(url('domene/Live slett'));
  await expect(page.locator('main article')).toContainText('Lenker til');
  rmSync(join(vault, 'domene/Live slett.md'));
  await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible({ timeout: 5000 });
});

test('slettet notat: tilbakelenken forsvinner og notatet er borte ved ny navigasjon', async ({ page, guards }) => {
  guards.allowConsole.push(/status of 404/);
  writeFileSync(join(vault, 'domene/Live ny.md'), '# Live ny\n\nLenker til [[avtale]] igjen.\n');
  await waitForBacklinks(page.request, 'domene/avtale', 4);
  await page.goto(url('domene/avtale'));
  const backlinks = page.getByRole('region', { name: 'Tilbakelenker' });
  await expect(backlinks.locator('a.bl-title')).toHaveCount(4, { timeout: 5000 });
  rmSync(join(vault, 'domene/Live ny.md'));
  await expect(backlinks.locator('a.bl-title')).toHaveCount(3, { timeout: 5000 });
  await page.goto(url('domene/Live ny'));
  await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible();
});

test('omdøpt notat: ny sti virker, gammel gir «ikke skrevet ennå»', async ({ page, guards }) => {
  guards.allowConsole.push(/status of 404/);
  await page.goto(url('domene/_MOC'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const lagerLink = page.locator('main article a[href$="/domene/Lager"]').first();
  await expect(lagerLink).toBeVisible();
  renameSync(join(vault, 'domene/Lager.md'), join(vault, 'domene/Lagerstyring.md'));
  // Lenken [[Lager]] i det åpne notatet blir brutt live.
  await expect(page.locator('main article button.broken', { hasText: 'Lager' }).first()).toBeVisible({ timeout: 5000 });
  await page.goto(url('domene/Lagerstyring'));
  // Fila starter med «# Lager», som blir visningstittel (PO-35).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lager');
  await page.goto(url('domene/Lager'));
  await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible();
});

test('endring mellom første lasting og SSE-tilkobling går ikke tapt', async ({ page }) => {
  test.fail(true, 'BUG-007: klienten ignorerer revisjonsavvik i første «ready»-hendelse, så endringer før SSE-tilkobling går tapt');
  // Hold igjen SSE-tilkoblingen til endringen er indeksert, slik at den kommer «mellom» lasting og tilkobling.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/api/events**', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(url('domene/avtale'));
  await expect(page.getByRole('region', { name: 'Tilbakelenker' }).locator('a.bl-title')).toHaveCount(3);
  writeFileSync(join(vault, 'domene/Live race.md'), '# Live race\n\nLenker til [[avtale]].\n');
  await waitForBacklinks(page.request, 'domene/avtale', 4);
  release();
  await expect(page.getByRole('region', { name: 'Tilbakelenker' }).locator('a.bl-title')).toHaveCount(4, { timeout: 5000 });
});
