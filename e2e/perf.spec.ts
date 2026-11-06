// AK17 ytelse mot generert 2000-notatsvault (teststrategi §2.6). Kjøres kun med PERF_VAULT=<sti>:
//   node test-vault-tools/generate-large-vault.mjs --out <sti> --count 2000 --seed 42
//   PERF_VAULT=<sti> npx playwright test --project=perf
// Måler (1) indekseringstid fra serverstart til indeks klar (5 kalde starter, median; PO-4: eksklusiv vite build)
// og (2) notatbytte i nettleseren (klikk på lenke → ny H1 + innhold synlig), p95 over 20 bytter.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildWeb, E2E_PORT, makeTempDir, removeDir, startServer, writeConfig, type RunningServer } from './support/real-server';
import { expect, test } from './support/guards';

const vault = process.env.PERF_VAULT;
const RUNS = Number(process.env.PERF_RUNS ?? 5);
const port = E2E_PORT + 9;

test.describe.configure({ mode: 'serial' });
test.skip(!vault, 'Sett PERF_VAULT til et generert 2000-vault');

let dir: string;
let server: RunningServer | null = null;

test.beforeAll(() => {
  dir = makeTempDir('vault-leser-perf-');
  mkdirSync(join(dir, 'dist'), { recursive: true });
  buildWeb(dir);
});

test.afterAll(async () => {
  await server?.stop();
  removeDir(dir);
});

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)]!;

test('AK17: indeksering av 2000 notater < 3 s (median av kalde starter)', async () => {
  test.setTimeout(300_000);
  const config = writeConfig(dir, vault!, port);
  const ready: number[] = [];
  const indexMs: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const s = await startServer(dir, config, port, 120_000);
    ready.push(Math.round(s.readyAfterMs));
    if (s.indexMs !== null) indexMs.push(s.indexMs);
    if (i < RUNS - 1) await s.stop();
    else server = s;
  }
  const result = `fra prosess-start til klar: ${ready.join(', ')} ms (median ${median(ready)}); serverens indexMs: ${indexMs.join(', ')} (median ${median(indexMs)})`;
  test.info().annotations.push({ type: 'måling', description: result });
  console.log(`[perf] ${result}`);
  // Kravet gjelder fra serverstart til indeks klar (PO-4). CI-container: < 4,5 s (teststrategi §2.6).
  expect(median(indexMs)).toBeLessThan(3000);
  expect(median(ready)).toBeLessThan(4500);
});

test('AK17: notatbytte < 200 ms (p95 over 20 klikk på interne lenker)', async ({ page }) => {
  test.setTimeout(180_000);
  expect(server, 'serveren fra forrige test').not.toBeNull();
  const base = `http://127.0.0.1:${port}`;
  const tree = (await (await page.request.get(`${base}/api/vaults/test/tree`)).json()) as { root: unknown };
  expect(tree).toBeTruthy();
  // Varm opp: første side + Shiki/mermaid-chunk.
  const vaults = (await (await page.request.get(`${base}/api/vaults/test/search?q=a&limit=50`)).json()) as { hits: { path: string }[] };
  const start = vaults.hits.find((h) => !h.path.includes('.'))?.path ?? '';
  await page.goto(`${base}/v/test/${start.split('/').map(encodeURIComponent).join('/')}`);
  await page.getByRole('heading', { level: 1 }).waitFor();

  const timings: { ms: number; from: string; to: string }[] = [];
  for (let i = 0; i < 25 && timings.length < 20; i++) {
    const links = page.locator('main article a[data-vr-link="internal"], main article a.wikilink[href^="/v/test/"]');
    const count = await links.count();
    if (count === 0) {
      await page.goto(`${base}/v/test/${vaults.hits[i % vaults.hits.length]!.path.split('/').map(encodeURIComponent).join('/')}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      continue;
    }
    const link = links.nth((i * 7) % count);
    const href = (await link.getAttribute('href')) ?? '';
    if (!href || href.includes('#') || href.endsWith('.base') || decodeURIComponent(href) === decodeURIComponent(new URL(page.url()).pathname)) {
      await page.goto(`${base}/v/test/${vaults.hits[(i * 3) % vaults.hits.length]!.path.split('/').map(encodeURIComponent).join('/')}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      continue;
    }
    const from = new URL(page.url()).pathname;
    const oldTitle = await page.getByRole('heading', { level: 1 }).first().innerText();
    await link.scrollIntoViewIfNeeded();
    const t0 = await page.evaluate(() => performance.now());
    await link.click();
    // Synlig: URL endret, ny H1 og artikkelinnhold rendret.
    await page.waitForFunction(
      ([oldPath]) => location.pathname !== oldPath && !!document.querySelector('main article') && !document.querySelector('main [aria-busy="true"]'),
      [from],
    );
    await page.waitForFunction(([title]) => {
      const h = document.querySelector('main h1');
      return !!h && h.textContent !== title;
    }, [oldTitle]).catch(() => undefined);
    const ms = (await page.evaluate(() => performance.now())) - t0;
    timings.push({ ms: Math.round(ms), from: decodeURIComponent(from), to: decodeURIComponent(new URL(page.url()).pathname) });
  }
  const values = timings.map((t) => t.ms);
  const result = `notatbytte (n=${values.length}): median ${median(values)} ms, p95 ${p95(values)} ms, maks ${Math.max(...values)} ms`;
  test.info().annotations.push({ type: 'måling', description: result });
  console.log(`[perf] ${result}\n${timings.map((t) => `  ${t.ms} ms  ${t.from} → ${t.to}`).join('\n')}`);
  expect(values.length).toBeGreaterThanOrEqual(15);
  expect(p95(values)).toBeLessThan(200);
});
