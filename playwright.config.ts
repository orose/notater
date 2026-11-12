import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// E2E (PO-17): globalSetup kopierer test-vault/ til en temp-mappe, setter fixture-mtimes, bygger web til
// temp og starter den EKTE serveren mot kopien på 127.0.0.1:4318. Testene skriver aldri i repoet.
//
// Prosjekter:
//   mock-desktop / mock-mobil – frontendens UI-tester (e2e/ui.spec.ts) mot mock-API (page.route).
//                                Serveren brukes bare til å levere bygget.
//   desktop / mobil           – QA-akseptansetester mot den ekte serveren og vault-kopien.
//   terminal                  – v3-akseptansetester i e2e/terminal/ (tmux-pty, PO-118).
//   perf                      – AK17 mot generert 2000-vault (kjøres kun med PERF_VAULT=<sti>).
//
// Chromium er forhåndsinstallert (PLAYWRIGHT_BROWSERS_PATH). Kjør ALDRI `playwright install`.
const port = Number(process.env.E2E_PORT ?? 4318);
const mockSpecs = /ui\.spec\.ts$/;
const perfSpecs = /perf\.spec\.ts$/;
// v3 (PO-118): terminaltestene kjører i en ekte pty i headless tmux (ADR-011 §8), i et eget prosjekt.
const terminalSpecs = /terminal\/v3-.*\.spec\.ts$/;

// Playwright krever default export i konfigfilen (unntak fra regelen om named exports).
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['support/**'],
  // Rapporter/traces havner utenfor repoet (PO-17); overstyr med E2E_OUTPUT_DIR.
  outputDir: process.env.E2E_OUTPUT_DIR ?? join(tmpdir(), `vault-leser-e2e-results-${port}`),
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  // Live reload-testene endrer vault-kopien; flere workere er ok fordi de bare rører egne filer.
  workers: process.env.CI ? 2 : 4,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    timezoneId: 'Europe/Oslo',
    locale: 'nb-NO',
  },
  projects: [
    { name: 'mock-desktop', testMatch: mockSpecs, use: { ...devices['Desktop Chrome'] } },
    { name: 'mock-mobil', testMatch: mockSpecs, use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      testIgnore: [mockSpecs, perfSpecs, terminalSpecs, /support\//],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobil',
      testIgnore: [mockSpecs, perfSpecs, terminalSpecs, /support\//],
      // Teststrategi §2.3: 360 px bredde (AK5-minimum), touch.
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } },
    },
    // Ingen nettleser trengs, bortsett fra TC-3-02-00w (fasiten mot web-presentasjonen), derfor Desktop Chrome.
    { name: 'terminal', testMatch: terminalSpecs, testIgnore: perfSpecs, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'perf', testMatch: perfSpecs, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
