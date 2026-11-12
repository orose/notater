// AK-3-12 Start < 3 s med 2000-notatsvault; lysbildebytte < 50 ms. Kjøres i perf-prosjektet (filnavnet slutter på
// perf.spec.ts): `E2E_PORT=4810 npx playwright test --project=perf e2e/terminal`. Testplan: TC-3-12-*.
//
// Måling (ADR-011 §8, PO-106): fra spawn av appen uten npm til «1/N» står i tmux-bufferet (start), og fra `send-keys` til nytt nummer i bufferet (bytte).
// Polling av tmux koster ~2–5 ms per avlesning, så målt bytte er en øvre grense. Hvis ADR-011 gir en tidskrok
// (Q-3-12), bytter testen til appens egne tall.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_PORT, makeTempDir, REPO, removeDir, writeConfig } from '../support/real-server';
import { median, p95 } from '../support/v2';
import { expect, fasit3, fasitNotat, hoppOverUtenforTerminal, lysbildenummer, test, Terminal } from '../support/terminal';

const mange = fasitNotat('mange');

const y = (fasit3 as unknown as { ytelse: { startMs: number; startMsContainer: number; lysbildebytteMs: number; vault: { generator: string; count: number; seed: number } } }).ytelse;
/** PO-106: < 3 s på kundens Mac, < 4,5 s i container/CI. */
const STARTGRENSE = process.platform === 'darwin' ? y.startMs : y.startMsContainer;
/** PO-106: uten npm-overhead – appen startes direkte (samme inngang som `npm run present`). */
const direkte = (args: readonly string[]) => `node node_modules/.bin/tsx src/terminal/main.ts ${args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')}`;

test.describe('AK-3-12 ytelse', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright krever objektdestrukturering av fixtures
  test.fixme('TC-3-12-01 start < 3 s (median av 5 kalde starter) og lysbildebytte p95 < 50 ms (80 bytter)', async ({}, testInfo) => {
    hoppOverUtenforTerminal(testInfo);
    test.setTimeout(240_000);
    const dir = makeTempDir('vault-leser-v3-perf-');
    const vault = join(dir, 'vault');
    const gen = spawnSync(process.execPath, [join(REPO, y.vault.generator), '--count', String(y.vault.count), '--seed', String(y.vault.seed), '--out', vault], { encoding: 'utf8' });
    expect(gen.status, gen.stderr).toBe(0);
    // Et kjent presentasjonsnotat (18 lysbilder, ingen embeds) legges i det genererte vaultet.
    mkdirSync(join(vault, 'presentasjon'), { recursive: true });
    cpSync(join(REPO, 'test-vault', `${mange.sti}.md`), join(vault, `${mange.sti}.md`));
    const konfig = writeConfig(dir, vault, E2E_PORT + 32);
    const starter: number[] = [];
    const bytter: number[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const t = await Terminal.start({ konfig: null, kommando: direkte(['--config', konfig, '--vault-id', 'test', mange.sti]), størrelse: { cols: 120, rows: 36 } });
        await expect.poll(() => lysbildenummer(t.skjerm()), { timeout: 30_000, intervals: [5] }).toEqual({ n: 1, av: mange.lysbilder.length });
        starter.push(performance.now() - t0);
        if (i === 0) {
          for (let b = 0; b < 80; b++) {
            const før = lysbildenummer(t.skjerm())!;
            const tast = b % 10 === 9 ? 'g g' : før.n === før.av ? 'k' : 'j';
            const s0 = performance.now();
            await t.trykk(tast);
            await expect.poll(() => lysbildenummer(t.skjerm())?.n !== før.n, { timeout: 2_000, intervals: [1] }).toBe(true);
            bytter.push(performance.now() - s0);
          }
        }
        await t.lukk();
      }
    } finally {
      removeDir(dir);
    }
    testInfo.annotations.push({ type: 'måling', description: `start median ${median(starter).toFixed(0)} ms (maks ${Math.max(...starter).toFixed(0)}); bytte p95 ${p95(bytter).toFixed(1)} ms` });
    expect(median(starter)).toBeLessThan(STARTGRENSE);
    expect(p95(bytter)).toBeLessThan(y.lysbildebytteMs);
  });
});
