// AK1 ulike vaults via konfigfil + indeksfasit (README-QA §1) mot den ekte serveren.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SearchResponse, TreeNode, TreeResponse, VaultsResponse } from '../src/shared/api-types';
import { E2E_PORT, removeDir, startServer } from './support/real-server';
import { expect, noteUrl, openNote, test } from './support/guards';

function flatten(node: TreeNode): string[] {
  return node.kind === 'folder' ? node.children.flatMap(flatten) : [node.path];
}

test.describe('Indeks (QA-IDX-01..04)', () => {
  test('80 notater, 9 andre filer, ingen dot-mapper', async ({ request }) => {
    const vaults = (await (await request.get('/api/vaults')).json()) as VaultsResponse;
    expect(vaults.vaults[0]).toMatchObject({ id: 'test', status: 'ready', noteCount: 80 });
    const tree = (await (await request.get('/api/vaults/test/tree')).json()) as TreeResponse;
    const paths = flatten(tree.root);
    expect(paths.filter((p) => p.startsWith('.') || p.includes('/.'))).toEqual([]);
    const others = paths.filter((p) => /\.(base|canvas|png|svg)$/.test(p)).sort();
    expect(others).toEqual(
      [
        'Domene.base',
        'Oppgaver.base',
        'Tegning.canvas',
        'attachments/arkitektur.png',
        'attachments/bred.png',
        'attachments/diagram med mellomrom.png',
        'attachments/logo.svg',
        'attachments/ondsinnet.svg',
        'domene/domenemodell.svg',
      ].sort(),
    );
  });

  test('.obsidian og .trash finnes ikke i søk eller tagger (QA-IDX-03/04, QA-SOK-07)', async ({ request }) => {
    const search = (await (await request.get(`/api/vaults/test/search?q=${encodeURIComponent('Slettet notat')}`)).json()) as SearchResponse;
    expect(search.hits.map((h) => h.path).filter((p) => p.startsWith('.'))).toEqual([]);
    const tagged = (await (await request.get(`/api/vaults/test/search?q=${encodeURIComponent('#task')}`)).json()) as SearchResponse;
    expect(tagged.hits.map((h) => h.path).filter((p) => p.startsWith('.'))).toEqual([]);
  });

  test('vault-sti på disk eksponeres ikke (api.md)', async ({ request, vaultDir }) => {
    const body = await (await request.get('/api/vaults')).text();
    expect(body).not.toContain(vaultDir);
  });

  test('NFD-filnavn finnes én gang, i NFC (QA-IDX-09)', async ({ request }) => {
    const tree = (await (await request.get('/api/vaults/test/tree')).json()) as TreeResponse;
    const hits = flatten(tree.root).filter((p) => p.normalize('NFC').includes('Årsrapport'));
    expect(hits).toEqual(['edge/Årsrapport (NFD)'.normalize('NFC')]);
  });
});

test.describe('AK1 flere vaults via konfigfil', () => {
  test('to vaults i én konfig: begge listes, begge kan åpnes, / går til defaultVault', async ({ page, request, vaultDir }) => {
    test.slow();
    const base = process.env.E2E_TMP_DIR!;
    const dir = join(base, `ak1-${test.info().project.name}`);
    removeDir(dir);
    mkdirSync(join(dir, 'annet'), { recursive: true });
    cpSync(join(base, 'dist'), join(dir, 'dist'), { recursive: true });
    writeFileSync(join(dir, 'annet', 'Hjem.md'), '# Annet vault\n\nLenke til [[Notat to]].\n');
    writeFileSync(join(dir, 'annet', 'Notat to.md'), 'Hei fra vault nummer to.\n');
    const port = E2E_PORT + (test.info().project.name === 'mobil' ? 4 : 3);
    const config = join(dir, 'to-vaults.json');
    writeFileSync(
      config,
      JSON.stringify({ port, defaultVault: 'annet', vaults: [{ id: 'test', name: 'Testvault', path: vaultDir }, { id: 'annet', name: 'Annet vault', path: join(dir, 'annet') }] }),
    );
    const server = await startServer(dir, config, port, 60_000, 'annet');
    try {
      const res = await request.get(`http://127.0.0.1:${port}/api/vaults`);
      const body = (await res.json()) as VaultsResponse;
      expect(body.defaultVaultId).toBe('annet');
      expect(body.vaults.map((v) => v.id).sort()).toEqual(['annet', 'test']);
      await page.goto(`http://127.0.0.1:${port}/`);
      await expect(page).toHaveURL(/\/v\/annet/);
      await page.goto(`http://127.0.0.1:${port}/v/annet/Hjem`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Annet vault');
      await page.locator('main article').getByRole('link', { name: 'Notat to' }).click();
      await expect(page.locator('main article')).toContainText('Hei fra vault nummer to');
      await page.goto(`http://127.0.0.1:${port}${noteUrl('Velkommen')}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Velkommen til testvaultet');
    } finally {
      // Lukk sidens tilkoblinger (SSE, prefetch, fonter) til hjelpeserveren FØR den stoppes. Ellers logger Chromium
      // ERR_INCOMPLETE_CHUNKED_ENCODING/ERR_CONNECTION_REFUSED fordi testen dreper serveren midt i en strøm (testfeil).
      await page.goto('about:blank');
      await server.stop();
      removeDir(dir);
    }
  });

  test('vaultnavnet fra konfig vises i appen', async ({ page, isMobile }) => {
    await openNote(page, 'Velkommen');
    if (isMobile) await page.getByRole('button', { name: 'Åpne navigasjon' }).click();
    await expect(page.getByRole('navigation', { name: 'Vault' })).toContainText('Testvault (e2e-kopi)');
  });
});
