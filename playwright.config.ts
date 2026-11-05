import { defineConfig, devices } from '@playwright/test';

// E2E kjører mot produksjonsbygget og den syntetiske testvaulten.
// Chromium er forhåndsinstallert (PLAYWRIGHT_BROWSERS_PATH). Kjør ALDRI `playwright install`.
const port = 4318;

// Playwright krever default export i konfigfilen (unntak fra regelen om named exports).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm start -- --vault ./test-vault --port ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
