import { expect, test } from '@playwright/test';

test('appen starter og viser forsiden', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Vault-leser' })).toBeVisible();
});
