// AK5 mobilvennlig: ingen horisontal scroll på sidenivå på 360 px for ALLE notater i testvaultet.
// Kode, tabeller, bilder og mermaid skal scrolle internt (QA-KOD-07, QA-IMG-06, QA-MD-03/08, QA-IDX-10).
import type { TreeNode, TreeResponse } from '../src/shared/api-types';
import { expect, noteUrl, test } from './support/guards';

function flatten(node: TreeNode): string[] {
  return node.kind === 'folder' ? node.children.flatMap(flatten) : [node.path];
}

test('ingen horisontal sidescroll på 360 px – alle dokumenter i vaultet (AK5)', async ({ page, request, isMobile, guards }) => {
  test.skip(!isMobile, 'Kjøres i mobil-prosjektet (360 px)');
  test.setTimeout(180_000);
  guards.allowConsole.push(/mermaid|parse|syntax/i);
  expect(page.viewportSize()?.width).toBe(360);
  const tree = (await (await request.get('/api/vaults/test/tree')).json()) as TreeResponse;
  const paths = flatten(tree.root);
  expect(paths.length).toBeGreaterThanOrEqual(80);
  const offenders: string[] = [];
  for (const path of paths) {
    await page.goto(noteUrl(path));
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    if (path.includes('ermaid')) await page.locator('main article .diagram-svg svg').first().waitFor({ timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
    if (overflow > 0) offenders.push(`${path} (+${overflow}px)`);
  }
  expect(offenders).toEqual([]);
});

test('fil-treet med dypt nestede mapper sprenger ikke bredden (QA-IDX-10)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Kun mobil');
  await page.goto(noteUrl('edge/a/b/c/d/e/Dypt nestet notat'));
  await page.getByRole('button', { name: 'Åpne navigasjon' }).click();
  const nav = page.getByRole('navigation', { name: 'Vault' });
  await expect(nav).toBeVisible();
  for (const folder of ['edge', 'a', 'b', 'c', 'd', 'e']) {
    const button = nav.getByRole('button', { name: new RegExp(`^${folder}\\b`) }).first();
    if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
  }
  await expect(nav.getByRole('link', { name: 'Dypt nestet notat' })).toBeVisible();
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test('bredt bilde skaleres ned (QA-IMG-06)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Kun mobil');
  await page.goto(noteUrl('lenker/Bilder'));
  const img = page.locator('main article img[src*="bred.png"]').first();
  await expect(img).toBeVisible();
  const { w, vw } = await img.evaluate((el) => ({ w: el.getBoundingClientRect().width, vw: window.innerWidth }));
  expect(w).toBeLessThanOrEqual(vw);
});
