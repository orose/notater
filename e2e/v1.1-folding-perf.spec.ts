// v1.1 ytelse for folding (F3) i et langt notat (AK-1.1-11: AK17 skal fortsatt holde; ADR-009 krever
// memoisering per toppnivåblokk). Kjøres i perf-prosjektet sammen med AK17:
//   PERF_VAULT=<sti> npx playwright test --project=perf
// Lager et eget vault med ett langt notat (300 seksjoner H2/H3/H4, ~1200 avsnitt) og egen server.
// Måler i nettleseren fra tastetrykk/klikk til endringen er i DOM og neste bilde er malt.
// Budsjett (QA-forslag, ingen tall i spesifikasjonen): enkeltfold og zM/zR < 200 ms (som notatbytte, AK17).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { E2E_PORT, makeTempDir, removeDir, startServer, writeConfig, type RunningServer } from './support/real-server';
import { expect, test } from './support/guards';

test.skip(!process.env.PERF_VAULT, 'Kjøres med perf-prosjektet (PERF_VAULT=<sti>)');

const SEKSJONER = 300;
const port = E2E_PORT + 10;
const BUDSJETT_MS = 200;
let dir: string;
let server: RunningServer | null = null;

function langtNotat(): string {
  const linjer = ['# Langt notat', '', 'Et generert notat for å måle folding.', ''];
  for (let i = 1; i <= SEKSJONER; i++) {
    const nivå = i % 5 === 1 ? 2 : i % 5 === 0 ? 4 : 3;
    linjer.push(`${'#'.repeat(nivå)} Seksjon ${i}`, '');
    for (let p = 0; p < 4; p++) {
      linjer.push(`Avsnitt ${p + 1} i seksjon ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua; ut enim ad minim veniam, quis nostrud exercitation.`, '');
    }
  }
  return linjer.join('\n');
}

test.beforeAll(async () => {
  dir = makeTempDir('vault-leser-e2e-foldperf-');
  const vault = join(dir, 'vault');
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, 'Langt notat.md'), langtNotat());
  // cwd = globalSetups temp-mappe (dist/web bygget der).
  server = await startServer(process.env.E2E_TMP_DIR!, writeConfig(dir, vault, port), port);
});

test.afterAll(async () => {
  await server?.stop();
  removeDir(dir);
});

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)]!;

/**
 * Starter en måling i siden: t0 ved neste keydown/click (capture), slutt når `ferdig()` er sann etter en
 * DOM-endring, pluss to animasjonsrammer (malt). `ferdig` er en funksjonskropp som evalueres i siden.
 */
function målIStart(page: Page, ferdig: string): Promise<number> {
  return page.evaluate(
    (kropp) =>
      new Promise<number>((resolve, reject) => {
        const sjekk = new Function(`return (${kropp})`) as () => boolean;
        let t0 = 0;
        const start = () => (t0 = performance.now());
        addEventListener('keydown', start, { capture: true, once: true });
        addEventListener('click', start, { capture: true, once: true });
        const obs = new MutationObserver(() => {
          if (!t0 || !sjekk()) return;
          obs.disconnect();
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
        });
        obs.observe(document.body, { subtree: true, childList: true, attributes: true });
        setTimeout(() => reject(new Error('tidsavbrudd')), 10_000);
      }),
    ferdig,
  );
}

test('F3 ytelse: folding i langt notat (300 seksjoner) < 200 ms', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`http://127.0.0.1:${port}/v/test/${encodeURIComponent('Langt notat')}`);
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Langt notat');
  await expect(page.locator('main article h2, main article h3, main article h4')).toHaveCount(SEKSJONER);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });

  // Enkeltfold via pil (klikk), 20 seksjoner spredt i notatet, fold + utfold.
  const enkelt: number[] = [];
  for (let i = 0; i < 20; i++) {
    const n = 1 + ((i * 37) % SEKSJONER);
    const knapp = page.getByRole('button', { name: new RegExp(`^Fold (sammen|ut) «?Seksjon ${n}»?$`) });
    await knapp.scrollIntoViewIfNeeded();
    for (const mål of ['false', 'true']) {
      const m = målIStart(page, `document.querySelector('[aria-label$="Seksjon ${n}»"][aria-expanded]')?.getAttribute('aria-expanded') === '${mål}'`);
      await page.waitForTimeout(20);
      await knapp.click();
      enkelt.push(await m);
    }
  }

  // zM / zR, 5 ganger hver.
  const alle: { zM: number[]; zR: number[] } = { zM: [], zR: [] };
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    let m = målIStart(page, `[...document.querySelectorAll('main article [aria-expanded]')].every((b) => b.getAttribute('aria-expanded') === 'false' || b.closest('[hidden]'))`);
    await page.keyboard.press('z');
    await page.keyboard.press('Shift+M');
    alle.zM.push(await m);
    m = målIStart(page, `[...document.querySelectorAll('main article [aria-expanded]')].every((b) => b.getAttribute('aria-expanded') === 'true')`);
    await page.keyboard.press('z');
    await page.keyboard.press('Shift+R');
    alle.zR.push(await m);
  }

  const rapport = `enkeltfold median ${median(enkelt).toFixed(0)} ms / p95 ${p95(enkelt).toFixed(0)} ms (n=${enkelt.length}); ` +
    `zM median ${median(alle.zM).toFixed(0)} ms / maks ${Math.max(...alle.zM).toFixed(0)} ms; zR median ${median(alle.zR).toFixed(0)} ms / maks ${Math.max(...alle.zR).toFixed(0)} ms`;
  test.info().annotations.push({ type: 'måling', description: rapport });
  console.log(`[perf] folding: ${rapport}`);
  expect(p95(enkelt), rapport).toBeLessThan(BUDSJETT_MS);
  // zM/zR måles fra første tast (z) i sekvensen, dvs. inkl. ventetid til andre tast.
  expect(median(alle.zM), rapport).toBeLessThan(BUDSJETT_MS);
  expect(median(alle.zR), rapport).toBeLessThan(BUDSJETT_MS);
});
