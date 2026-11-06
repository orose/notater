// AK12 live reload (QA-IDX-13): endringer i vaultet vises uten manuell refresh.
// PO-76: HVER test får sin EGEN vault-kopi og egen server på en ledig port (fixturen `live`), så testene
// ikke deler tilstand og tåler `--repeat-each`, parallelle workere og vilkårlig rekkefølge.
// Webbygget deles (read-only) fra globalSetup. Ingenting skrives i repoet.
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { copyTestVault, makeTempDir, removeDir, startServer, writeConfig } from './support/real-server';
import { expect, test as base } from './support/guards';

/** Ledig port på 127.0.0.1 (OS-et velger; lukkes før serveren binder). */
function ledigPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

const status = async (base: string, docPath: string): Promise<number> =>
  (await fetch(`${base}/api/vaults/test/document?path=${encodeURIComponent(docPath)}`)).status;

/**
 * Serveren melder «ready» før chokidar er ferdig med første skanning (BUG-012): en fil som skrives i det
 * vinduet regnes som «initial» og går tapt. Vi skriver derfor nye probe-filer til én blir indeksert
 * (= overvåkeren er klar), og sletter dem igjen før testen starter.
 */
async function ventPåOvervåker(vault: string, base: string): Promise<void> {
  const prober: string[] = [];
  const start = Date.now();
  for (let i = 0; ; i++) {
    const navn = `zz-probe-${i}`;
    writeFileSync(join(vault, `${navn}.md`), '# Probe\n');
    prober.push(navn);
    const frist = Date.now() + 1000;
    let sett = false;
    while (!sett && Date.now() < frist) {
      sett = (await status(base, navn)) === 200;
      if (!sett) await new Promise((r) => setTimeout(r, 50));
    }
    if (sett) break;
    if (Date.now() - start > 20_000) throw new Error('Fil-overvåkeren ble ikke klar innen 20 s');
  }
  for (const navn of prober) rmSync(join(vault, `${navn}.md`), { force: true });
  await expect.poll(async () => Promise.all(prober.map((n) => status(base, n))), { timeout: 10_000 }).toEqual(prober.map(() => 404));
}

interface Live {
  /** Vault-kopien bare denne testen bruker. */
  readonly vault: string;
  /** `http://127.0.0.1:<port>` for testens egen server. */
  readonly base: string;
}

const test = base.extend<{ live: Live }>({
  // Avhenger av `page`, så siden lukker SSE-strømmen (about:blank) før serveren stoppes – ellers gir
  // brutt strøm «ERR_INCOMPLETE_CHUNKED_ENCODING» i konsollen, som konsollvakten regner som feil.
  live: async ({ page }, use) => {
    const dir = makeTempDir('vault-leser-e2e-live-');
    const vault = copyTestVault(dir);
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    // Porten kan i sjeldne tilfeller bli tatt mellom ledigPort() og oppstart: prøv på nytt.
    for (let forsøk = 0; !server; forsøk++) {
      const port = await ledigPort();
      try {
        // cwd = globalSetups temp-mappe, der dist/web ligger (delt, bare lesing).
        server = await startServer(process.env.E2E_TMP_DIR!, writeConfig(dir, vault, port), port);
      } catch (error) {
        if (forsøk >= 2) throw error;
      }
    }
    const baseUrl = `http://127.0.0.1:${server.port}`;
    await ventPåOvervåker(vault, baseUrl);
    await use({ vault, base: baseUrl });
    await page.goto('about:blank');
    await server.stop();
    removeDir(dir);
  },
});

async function waitForBacklinks(request: import('@playwright/test').APIRequestContext, base: string, path: string, count: number): Promise<void> {
  await expect
    .poll(async () => ((await (await request.get(`${base}/api/vaults/test/backlinks?path=${encodeURIComponent(path)}`)).json()) as { backlinks: unknown[] }).backlinks.length)
    .toBe(count);
}

const url = (base: string, docPath: string) => `${base}/v/test/${docPath.split('/').map(encodeURIComponent).join('/')}`;

test('endring i åpent notat vises uten refresh, innen ~1 s (QA-IDX-13)', async ({ page, live: { vault, base } }) => {
  await page.goto(url(base, 'domene/avtale'));
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

test('scrollposisjon bevares ved live reload', async ({ page, live: { vault, base } }) => {
  await page.goto(url(base, 'edge/Veldig langt notat'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('[id="5-sikkerhet"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(500);
  const file = join(vault, 'edge/Veldig langt notat.md');
  writeFileSync(file, `${(await import('node:fs')).readFileSync(file, 'utf8')}\n\nScroll-test ${Date.now()}\n`);
  await page.waitForTimeout(1500);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThan(100);
});

test('nytt notat dukker opp, og tilbakelenker oppdateres (QA-IDX-13)', async ({ page, live: { vault, base } }) => {
  await page.goto(url(base, 'domene/avtale'));
  const backlinks = page.getByRole('region', { name: 'Tilbakelenker' });
  await expect(backlinks.locator('a.bl-title')).toHaveCount(3);
  writeFileSync(join(vault, 'domene/Live ny.md'), '# Live ny\n\nLenker til [[avtale]].\n');
  await expect(backlinks.locator('a.bl-title')).toHaveCount(4, { timeout: 5000 });
  await expect(backlinks).toContainText('Live ny');
});

test('atomisk skriving (tmp + rename, som Obsidian) fanges opp', async ({ page, live: { vault, base } }) => {
  writeFileSync(join(vault, 'domene/Live ny.md'), '# Live ny\n\nLenker til [[avtale]].\n');
  await expect.poll(async () => (await page.request.get(`${base}/api/vaults/test/document?path=${encodeURIComponent('domene/Live ny')}`)).status()).toBe(200);
  await page.goto(url(base, 'domene/Live ny'));
  await expect(page.locator('main article')).toContainText('Lenker til');
  const tmp = join(vault, 'domene/.Live ny.md.tmp');
  writeFileSync(tmp, '# Live ny\n\nATOMISK-OPPDATERT\n');
  renameSync(tmp, join(vault, 'domene/Live ny.md'));
  await expect(page.locator('main article')).toContainText('ATOMISK-OPPDATERT', { timeout: 5000 });
});

test('mange raske endringer debounces og siste versjon vises', async ({ page, live: { vault, base } }) => {
  writeFileSync(join(vault, 'domene/Live ny.md'), '# Live ny\n\nStart.\n');
  await expect.poll(async () => (await page.request.get(`${base}/api/vaults/test/document?path=${encodeURIComponent('domene/Live ny')}`)).status()).toBe(200);
  await page.goto(url(base, 'domene/Live ny'));
  await expect(page.locator('main article')).toContainText('Start.');
  for (let i = 0; i < 20; i++) writeFileSync(join(vault, 'domene/Live ny.md'), `# Live ny\n\nVersjon ${i}\n`);
  await expect(page.locator('main article')).toContainText('Versjon 19', { timeout: 5000 });
});

test('slettet notat som er åpent → «ikke skrevet ennå» uten refresh', async ({ page, guards, live: { vault, base } }) => {
  guards.allowConsole.push(/status of 404/);
  writeFileSync(join(vault, 'domene/Live slett.md'), '# Live slett\n\nLenker til [[avtale]].\n');
  await expect.poll(async () => (await page.request.get(`${base}/api/vaults/test/document?path=${encodeURIComponent('domene/Live slett')}`)).status()).toBe(200);
  await page.goto(url(base, 'domene/Live slett'));
  await expect(page.locator('main article')).toContainText('Lenker til');
  rmSync(join(vault, 'domene/Live slett.md'));
  await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible({ timeout: 5000 });
});

test('slettet notat: tilbakelenken forsvinner og notatet er borte ved ny navigasjon', async ({ page, guards, live: { vault, base } }) => {
  guards.allowConsole.push(/status of 404/);
  writeFileSync(join(vault, 'domene/Live ny.md'), '# Live ny\n\nLenker til [[avtale]] igjen.\n');
  await waitForBacklinks(page.request, base, 'domene/avtale', 4);
  await page.goto(url(base, 'domene/avtale'));
  const backlinks = page.getByRole('region', { name: 'Tilbakelenker' });
  await expect(backlinks.locator('a.bl-title')).toHaveCount(4, { timeout: 5000 });
  rmSync(join(vault, 'domene/Live ny.md'));
  await expect(backlinks.locator('a.bl-title')).toHaveCount(3, { timeout: 5000 });
  await page.goto(url(base, 'domene/Live ny'));
  await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible();
});

test('omdøpt notat: ny sti virker, gammel gir «ikke skrevet ennå»', async ({ page, guards, live: { vault, base } }) => {
  guards.allowConsole.push(/status of 404/);
  await page.goto(url(base, 'domene/_MOC'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const lagerLink = page.locator('main article a[href$="/domene/Lager"]').first();
  await expect(lagerLink).toBeVisible();
  renameSync(join(vault, 'domene/Lager.md'), join(vault, 'domene/Lagerstyring.md'));
  // Lenken [[Lager]] i det åpne notatet blir brutt live.
  await expect(page.locator('main article button.broken', { hasText: 'Lager' }).first()).toBeVisible({ timeout: 5000 });
  await page.goto(url(base, 'domene/Lagerstyring'));
  // Fila starter med «# Lager», som blir visningstittel (PO-35).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lager');
  await page.goto(url(base, 'domene/Lager'));
  await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible();
});

test('endring mellom første lasting og SSE-tilkobling går ikke tapt', async ({ page, live: { vault, base } }) => {
  // Hold igjen SSE-tilkoblingen til endringen er indeksert, slik at den kommer «mellom» lasting og tilkobling.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/api/events**', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(url(base, 'domene/avtale'));
  await expect(page.getByRole('region', { name: 'Tilbakelenker' }).locator('a.bl-title')).toHaveCount(3);
  writeFileSync(join(vault, 'domene/Live race.md'), '# Live race\n\nLenker til [[avtale]].\n');
  await waitForBacklinks(page.request, base, 'domene/avtale', 4);
  release();
  await expect(page.getByRole('region', { name: 'Tilbakelenker' }).locator('a.bl-title')).toHaveCount(4, { timeout: 5000 });
});

test('omdøping/flytting sender «renamed» med from/to, og åpent notat peker til ny plass (PO-49, BE32)', async ({ page, guards, live: { vault, base } }) => {
  guards.allowConsole.push(/status of 404/);
  writeFileSync(join(vault, 'domene/Flytt kilde.md'), '# Flytt kilde\n\nSkal flyttes.\n');
  await expect.poll(async () => (await page.request.get(`${base}/api/vaults/test/document?path=${encodeURIComponent('domene/Flytt kilde')}`)).status()).toBe(200);
  await page.goto(url(base, 'domene/Flytt kilde'));
  await expect(page.locator('main article')).toContainText('Skal flyttes');
  // Lytt på SSE i siden og samle «changed»-hendelser.
  await page.evaluate((vaultId) => {
    const w = window as unknown as { __changes: unknown[] };
    w.__changes = [];
    new EventSource(`/api/events?vault=${vaultId}`).addEventListener('changed', (e) => w.__changes.push(JSON.parse((e as MessageEvent).data)));
  }, 'test');
  await page.waitForTimeout(300);
  // Flytt til annen mappe og nytt navn, og legg til en annen fil i samme bunt – da kan ikke
  // klientens reserveheuristikk (1 fjernet + 1 lagt til / samme filnavn) gjette flyttingen.
  mkdirSync(join(vault, 'arkiv/flyttet'), { recursive: true });
  renameSync(join(vault, 'domene/Flytt kilde.md'), join(vault, 'arkiv/flyttet/Helt nytt navn.md'));
  writeFileSync(join(vault, 'domene/Støy.md'), '# Støy\n');
  await expect
    .poll(async () => JSON.stringify(await page.evaluate(() => (window as unknown as { __changes: unknown[] }).__changes)), { timeout: 5000 })
    .toContain('"type":"renamed"');
  const changes = (await page.evaluate(() => (window as unknown as { __changes: { changes: { type: string; from?: string; to?: string }[] }[] }).__changes)).flatMap((c) => c.changes);
  expect(changes).toContainEqual(expect.objectContaining({ type: 'renamed', from: 'domene/Flytt kilde', to: 'arkiv/flyttet/Helt nytt navn' }));
  await expect(page.locator('main')).toContainText('Notatet er flyttet til', { timeout: 5000 });
  await page.locator('main').getByRole('link', { name: 'Helt nytt navn' }).click();
  await expect(page).toHaveURL(/arkiv\/flyttet\/Helt%20nytt%20navn$/);
  await expect(page.locator('main article')).toContainText('Skal flyttes');
});
