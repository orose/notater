import { expect, test } from './support/guards';

test('appen starter og sender / til standardvaultet', async ({ page, isMobile }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/v\/test$/);
  if (isMobile) await page.getByRole('button', { name: 'Åpne navigasjon' }).click();
  await expect(page.getByRole('navigation', { name: 'Vault' })).toBeAttached();
});
