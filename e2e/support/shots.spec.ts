// Skjermbilder for visuell sammenligning med docs/design/skjermbilder/. Kjøres kun med SHOT_DIR satt.
import { test } from '@playwright/test';
import { MOCK_NOTE_URL, installMockApi } from './mock-vault';

const dir = process.env.SHOT_DIR;
const combos = [
  ['tidsskrift', 'papir', 'light'],
  ['tidsskrift', 'papir', 'dark'],
  ['terminal', 'fosfor', 'dark'],
  ['terminal', 'signal', 'light'],
  ['tidsskrift', 'cyanotypi', 'dark'],
] as const;

test.skip(!dir, 'Sett SHOT_DIR for å ta skjermbilder');

for (const [type, palette, mode] of combos) {
  test(`notat ${type}-${palette}-${mode}`, async ({ page }, info) => {
    await installMockApi(page);
    await page.goto(`${MOCK_NOTE_URL}?type=${type}&palette=${palette}&mode=${mode}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${dir}/notat-${type}-${palette}-${mode}-${info.project.name}.png` });
    await page.screenshot({ path: `${dir}/helside-${type}-${palette}-${mode}-${info.project.name}.png`, fullPage: true });
  });
}

test('tilstander', async ({ page }, info) => {
  await installMockApi(page);
  await page.goto('/v/test/domene/Outbox-m%C3%B8nster?type=tidsskrift&palette=papir&mode=light');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.screenshot({ path: `${dir}/ukjent-${info.project.name}.png` });
  await page.goto(`${MOCK_NOTE_URL}?type=terminal&palette=signal&mode=dark`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('idempot');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/sok-${info.project.name}.png` });
  await page.keyboard.press('Escape');
  await page.goto(`${MOCK_NOTE_URL}?type=tidsskrift&palette=papir&mode=light`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  if (info.project.name === 'mobil') {
    await page.getByRole('button', { name: 'Åpne navigasjon' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/skuff-${info.project.name}.png` });
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Utseende' }).filter({ visible: true }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/temavelger-${info.project.name}.png` });
});
