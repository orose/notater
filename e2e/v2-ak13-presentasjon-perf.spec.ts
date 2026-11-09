// AK-2-13 Lysbildebytte < 100 ms (p95) etter at presentasjonen er bygget; start av presentasjon for et
// rapportnotat med 20 embeds < 500 ms. Kjøres i perf-prosjektet sammen med AK17 og folding-perf:
//   PERF_VAULT=<sti> npx playwright test --project=perf
// Lager et eget vault (rapport med 20 notatembeds med liste, kode og tabell, og en kanban-base) og egen
// server (E2E_PORT + 11). Måler i nettleseren fra tastetrykk (capture) til nytt lysbilde er i DOM og neste
// bilde er malt (to animasjonsrammer). Testplan: TC-2-13-*. TDD: `test.fixme` til levert.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { E2E_PORT, makeTempDir, removeDir, startServer, writeConfig, type RunningServer } from './support/real-server';
import { expect, test } from './support/guards';
import { fasit2, median, p95 } from './support/v2';

test.skip(!process.env.PERF_VAULT, 'Kjøres med perf-prosjektet (PERF_VAULT=<sti>)');

const EMBEDS = 20;
const port = E2E_PORT + 11;
let dir: string;
let server: RunningServer | null = null;

function kilde(i: number): string {
  const l = [`## Del ${i}.1`, '', `Avsnitt i kilde ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`, '', '- punkt en', '- punkt to', '- punkt tre', ''];
  l.push(`## Del ${i}.2`, '', '```ts', ...Array.from({ length: 12 }, (_, n) => `const verdi${n} = ${i * n}; // kilde ${i}`), '```', '');
  l.push(`## Del ${i}.3`, '', '| A | B | C |', '|---|---|---|', ...Array.from({ length: 6 }, (_, n) => `| ${i} | ${n} | ${i * n} |`), '');
  return l.join('\n');
}

function rapport(): string {
  const l = ['# Perf-rapport', '', 'Rapport med 20 innebygde notater.', ''];
  for (let i = 1; i <= EMBEDS; i++) {
    if (i % 5 === 1) l.push(`## Agendapunkt ${Math.ceil(i / 5)}`, '');
    l.push(`![[Kilde ${i}]]`, '');
  }
  l.push('## Oppgaver', '', '### Tavle', '', '```base', 'filters:', '  and:', '    - file.hasTag("task")', 'views:', '  - type: kanban', '    name: Tavle', '    groupBy:', '      property: status', '      direction: ASC', '```', '');
  return l.join('\n');
}

test.beforeAll(async () => {
  dir = makeTempDir('vault-leser-e2e-v2perf-');
  const vault = join(dir, 'vault');
  mkdirSync(join(vault, 'kilder'), { recursive: true });
  mkdirSync(join(vault, 'oppgaver'), { recursive: true });
  writeFileSync(join(vault, 'Perf-rapport.md'), rapport());
  for (let i = 1; i <= EMBEDS; i++) writeFileSync(join(vault, 'kilder', `Kilde ${i}.md`), kilde(i));
  for (let i = 1; i <= 30; i++) writeFileSync(join(vault, 'oppgaver', `Oppgave ${i}.md`), `---\ntags: [task]\nstatus: ${['todo', 'doing', 'done'][i % 3]}\n---\n# Oppgave ${i}\n`);
  server = await startServer(process.env.E2E_TMP_DIR!, writeConfig(dir, vault, port), port);
});

test.afterAll(async () => {
  await server?.stop();
  removeDir(dir);
});

/** t0 ved neste keydown (capture); slutt når `ferdig()` er sann etter en DOM-endring + to animasjonsrammer. */
function målFraTast(page: Page, ferdig: string): Promise<number> {
  return page.evaluate(
    (kropp) =>
      new Promise<number>((resolve, reject) => {
        const sjekk = new Function(`return (${kropp})`) as () => boolean;
        let t0 = 0;
        addEventListener('keydown', () => (t0 = performance.now()), { capture: true, once: true });
        const obs = new MutationObserver(() => {
          if (!t0 || !sjekk()) return;
          obs.disconnect();
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
        });
        obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        setTimeout(() => reject(new Error('tidsavbrudd')), 10_000);
      }),
    ferdig,
  );
}

const SYNLIG_INDEKS = (n: number) =>
  `[...document.querySelectorAll('[data-testid="lysbilde"]')].some((el) => el.offsetParent !== null && el.getAttribute('data-slide-index') === '${n}')`;

async function åpne(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`http://127.0.0.1:${port}/v/test/${encodeURIComponent('Perf-rapport')}`);
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Perf-rapport');
  await expect(page.locator('main article')).toContainText('Del 20.3');
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
    window.scrollTo(0, 0);
  });
}

test('TC-2-13-01 start av presentasjon for rapport med 20 embeds < 500 ms (median av 5)', async ({ page }) => {
  test.setTimeout(180_000);
  const målinger: number[] = [];
  for (let i = 0; i < 5; i++) {
    await åpne(page);
    // Måles fra Enter i paletten (`:presenter`), så leader-sekvensen ikke er med i tiden.
    await page.keyboard.press(':');
    await page.locator('dialog[open]').getByRole('combobox').pressSequentially('presenter');
    const m = målFraTast(page, SYNLIG_INDEKS(1));
    await page.keyboard.press('Enter');
    målinger.push(await m);
    await page.keyboard.press('Escape');
  }
  const rapport = `start median ${median(målinger).toFixed(0)} ms / maks ${Math.max(...målinger).toFixed(0)} ms (n=${målinger.length})`;
  test.info().annotations.push({ type: 'måling', description: rapport });
  console.log(`[perf] presentasjon: ${rapport}`);
  expect(median(målinger), rapport).toBeLessThan(fasit2.ytelse.startRapport20EmbedsMs);
});

test('TC-2-13-02 lysbildebytte p95 < 100 ms (neste/forrige/første/siste, 80 bytter)', async ({ page }) => {
  test.setTimeout(180_000);
  await åpne(page);
  await page.keyboard.press(':');
  await page.locator('dialog[open]').getByRole('combobox').pressSequentially('presenter');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="lysbilde"][data-slide-index="1"]')).toBeVisible();
  const antall = Number((/\/\s*(\d+)/.exec(await page.getByTestId('lysbildenummer').innerText()) ?? [])[1]);
  // Tittel + agenda + 5 overganger + 20 embed-lysbilder (+ «(forts.)») + tavle.
  expect(antall).toBeGreaterThanOrEqual(28);
  const bytter: number[] = [];
  let nå = 1;
  for (let i = 0; i < 80; i++) {
    const tast = i % 20 === 19 ? 'Shift+G' : i % 20 === 18 ? 'g' : i % 3 === 2 ? 'k' : 'j';
    if (tast === 'g') {
      await page.keyboard.press('g');
      const m = målFraTast(page, SYNLIG_INDEKS(1));
      await page.keyboard.press('g');
      bytter.push(await m);
      nå = 1;
      continue;
    }
    const mål = tast === 'Shift+G' ? antall : tast === 'k' ? Math.max(1, nå - 1) : Math.min(antall, nå + 1);
    if (mål === nå) continue;
    const m = målFraTast(page, SYNLIG_INDEKS(mål));
    await page.keyboard.press(tast);
    bytter.push(await m);
    nå = mål;
    await page.waitForTimeout(30);
  }
  const rapport = `lysbildebytte median ${median(bytter).toFixed(0)} ms / p95 ${p95(bytter).toFixed(0)} ms (n=${bytter.length})`;
  test.info().annotations.push({ type: 'måling', description: rapport });
  console.log(`[perf] presentasjon: ${rapport}`);
  expect(p95(bytter), rapport).toBeLessThan(fasit2.ytelse.lysbildebytteP95Ms);
});
