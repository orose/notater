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

// Ikke serial: notatbytte-testen kjører selv om indekseringskravet feiler.
test.describe.configure({ mode: 'default' });
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
  const { loadavg } = await import('node:os');
  test.info().annotations.push({ type: 'last', description: `loadavg før måling: ${loadavg().map((l) => l.toFixed(2)).join(' ')}` });
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
  server ??= await startServer(dir, writeConfig(dir, vault!, port), port, 120_000);
  const base = `http://127.0.0.1:${port}`;
  const tree = (await (await page.request.get(`${base}/api/vaults/test/tree`)).json()) as { root: unknown };
  expect(tree).toBeTruthy();
  // Varm opp: første side + Shiki/mermaid-chunk.
  const vaults = (await (await page.request.get(`${base}/api/vaults/test/search?q=a&limit=50`)).json()) as { hits: { path: string }[] };
  const start = vaults.hits.find((h) => !h.path.includes('.'))?.path ?? '';
  await page.goto(`${base}/v/test/${start.split('/').map(encodeURIComponent).join('/')}`);
  await page.getByRole('heading', { level: 1 }).waitFor();

  interface Sample { ms: number; fetchMs: number; serverMs: number; from: string; to: string }

  /** Ett notatbytte. `hoverFirst` = hold musa over lenken 400 ms først (prefetch, PO-51). */
  const switchOnce = async (i: number, hoverFirst: boolean): Promise<Sample | null> => {
    const links = page.locator('main article a.wikilink[href^="/v/test/"], main article a[data-vr-link="internal"]');
    const count = await links.count();
    const link = links.nth((i * 7) % Math.max(count, 1));
    const href = count > 0 ? ((await link.getAttribute('href')) ?? '') : '';
    if (!href || href.includes('#') || href.endsWith('.base') || decodeURIComponent(href) === decodeURIComponent(new URL(page.url()).pathname)) {
      await page.goto(`${base}/v/test/${vaults.hits[(i * 3) % vaults.hits.length]!.path.split('/').map(encodeURIComponent).join('/')}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      return null;
    }
    const from = new URL(page.url()).pathname;
    await link.scrollIntoViewIfNeeded();
    if (hoverFirst) {
      await link.hover();
      await page.waitForTimeout(400);
    }
    // Måles i nettleseren: fra klikk (capture) til ny H1 og artikkel er i DOM og malt (MutationObserver + rAF).
    // Server-/nettverksdelen hentes fra Resource Timing for /document-kallet (inkl. Server-Timing, BE31).
    const measuring = page.evaluate(
      (prefetchWindow) =>
        new Promise<{ total: number; fetchMs: number; serverMs: number }>((resolve) => {
          const oldTitle = document.querySelector('main h1')?.textContent ?? '';
          let t0 = 0;
          addEventListener('click', () => (t0 = performance.now()), { capture: true, once: true });
          const check = () => {
            const h = document.querySelector('main h1');
            if (t0 && h && h.textContent !== oldTitle && document.querySelector('main article')) {
              obs.disconnect();
              requestAnimationFrame(() => {
                const total = performance.now() - t0;
                const entries = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
                  (e) => e.name.includes('/api/vaults/test/document') && e.startTime >= t0 - prefetchWindow,
                );
                const e = entries[entries.length - 1];
                // Bare den delen av hentingen som skjedde ETTER klikket teller som ventetid for brukeren.
                const fetchMs = e ? Math.max(0, e.responseEnd - Math.max(e.startTime, t0)) : 0;
                const serverMs = e ? e.serverTiming.reduce((sum, st) => sum + st.duration, 0) : 0;
                resolve({ total, fetchMs, serverMs });
              });
            }
          };
          const obs = new MutationObserver(check);
          obs.observe(document.body, { subtree: true, childList: true, characterData: true });
        }),
      hoverFirst ? 1000 : 200,
    );
    await link.click();
    const m = await measuring;
    return { ms: Math.round(m.total), fetchMs: Math.round(m.fetchMs), serverMs: Math.round(m.serverMs), from: decodeURIComponent(from), to: decodeURIComponent(new URL(page.url()).pathname) };
  };

  const collect = async (hoverFirst: boolean, n: number): Promise<Sample[]> => {
    const out: Sample[] = [];
    for (let i = 0; i < n * 2 && out.length < n; i++) {
      const sample = await switchOnce(i + (hoverFirst ? 101 : 0), hoverFirst);
      if (sample) out.push(sample);
    }
    return out;
  };

  const report = (label: string, samples: Sample[]) => {
    const total = samples.map((t) => t.ms);
    const server = samples.map((t) => t.serverMs);
    const fetch = samples.map((t) => t.fetchMs);
    const client = samples.map((t) => Math.max(0, t.ms - t.fetchMs));
    const line =
      `${label} (n=${samples.length}): totalt median ${median(total)} / p95 ${p95(total)} ms; ` +
      `server (Server-Timing) median ${median(server)} / p95 ${p95(server)} ms; ` +
      `henting etter klikk median ${median(fetch)} / p95 ${p95(fetch)} ms; ` +
      `klient (totalt − henting) median ${median(client)} / p95 ${p95(client)} ms`;
    test.info().annotations.push({ type: 'måling', description: line });
    console.log(`[perf] ${line}\n${samples.map((t) => `  ${t.ms} ms (henting ${t.fetchMs}, server ${t.serverMs})  ${t.from} → ${t.to}`).join('\n')}`);
    return total;
  };

  const plain = report('notatbytte uten prefetch', await collect(false, 20));
  const withHover = report('notatbytte med hover-prefetch', await collect(true, 10));
  expect(plain.length).toBeGreaterThanOrEqual(15);
  expect(withHover.length).toBeGreaterThanOrEqual(8);
  expect(p95(plain)).toBeLessThan(200);
});
