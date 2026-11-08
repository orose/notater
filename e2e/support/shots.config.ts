// Skjermbilder mot mock-API: SHOT_DIR=… npx playwright test -c e2e/support/shots.config.ts (krever vite preview på 4173).
import { defineConfig, devices } from '@playwright/test';
// Playwright krever default export i konfigfilen.
// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  testDir: '..',
  testMatch: /(shots|ui)\.spec\.ts$/,
  reporter: 'list',
  workers: 4,
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobil', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
