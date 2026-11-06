import { expect, test } from './support/guards';

test('appen starter og sender / til standardvaultet', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/v\/test$/);
  await expect(page.getByRole('navigation', { name: 'Vault' })).toBeAttached();
});
