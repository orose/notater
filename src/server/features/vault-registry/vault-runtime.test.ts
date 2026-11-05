import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChangedEvent } from '../../../shared/api-types';
import { testHighlighter } from '../../test-support/render-fixtures';
import { createInlineMetaExtractor } from '../vault-index';
import { createLruCache } from './lru-cache';
import { createVaultRegistry } from './vault-registry';
import { createVaultRuntime } from './vault-runtime';
import type { VaultRuntimeDeps } from './vault-runtime';

let root: string;
const deps: VaultRuntimeDeps = {
  highlighter: testHighlighter,
  createInitialExtractor: createInlineMetaExtractor,
  incrementalExtractor: createInlineMetaExtractor(),
  watch: null,
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vr-runtime-'));
  await writeFile(join(root, 'A.md'), '---\naliases: [Alfa]\n---\n# A\nSe [[B]].');
  await writeFile(join(root, 'B.md'), '# B');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('createVaultRuntime', () => {
  it('indekserer lat og rapporterer status', async () => {
    const vault = createVaultRuntime({ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] }, deps);
    expect(vault.summary()).toMatchObject({ id: 'v', name: 'V', status: 'not-indexed', noteCount: null, revision: null });
    const state = await vault.ready();
    expect(state.revision).toBe(1);
    expect(vault.summary()).toMatchObject({ status: 'ready', noteCount: 2, revision: 1 });
    expect(vault.summary().indexMs).toEqual(expect.any(Number));
    expect(state.backlinks.get('B.md').map((b) => b.source.filePath)).toEqual(['A.md']);
  }, 30_000);

  it('feil ved ukjent rot gir status error med norsk melding', async () => {
    const vault = createVaultRuntime({ id: 'x', name: 'X', root: join(root, 'finnes-ikke'), ignore: [], hiddenProperties: [] }, deps);
    await expect(vault.ready()).rejects.toThrow(/Kunne ikke indeksere/);
    expect(vault.summary()).toMatchObject({ status: 'error', errorMessage: expect.stringMatching(/Kunne ikke indeksere/) });
  });

  it('inkrementell endring: ny revisjon, ny render-cache, hendelse og oppdatert søk og backlinks', async () => {
    const vault = createVaultRuntime({ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] }, deps);
    const first = await vault.ready();
    first.renderCache.set('A.md', { content: { type: 'root', children: [] }, toc: [], bases: {} });
    await vault.searchIndex();
    const events: ChangedEvent[] = [];
    vault.subscribe((e) => events.push(e));

    await writeFile(join(root, 'C.md'), '# C\nUnikord og [[B]]');
    const changes = await vault.applyChanges(['C.md']);

    expect(changes).toEqual([{ type: 'added', path: 'C' }]);
    expect(events).toEqual([{ vaultId: 'v', revision: 2, changes }]);
    const next = await vault.ready();
    expect(next.revision).toBe(2);
    expect(next.renderCache.size).toBe(0);
    expect(next.backlinks.get('B.md').map((b) => b.source.filePath).sort()).toEqual(['A.md', 'C.md']);
    const { index, revision } = await vault.searchIndex();
    expect(revision).toBe(2);
    expect(index.search('unikord', 10)[0]!.path).toBe('C');
  }, 30_000);

  it('ingen endring gir ingen ny revisjon', async () => {
    const vault = createVaultRuntime({ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] }, deps);
    await vault.ready();
    expect(await vault.applyChanges(['A.md'])).toEqual([]);
    expect((await vault.ready()).revision).toBe(1);
  });
});

describe('createVaultRegistry', () => {
  it('slår opp vaults på id', () => {
    const registry = createVaultRegistry({ defaultVaultId: 'v', vaults: [{ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] }] }, deps);
    expect(registry.get('v')?.name).toBe('V');
    expect(registry.get('nei')).toBeNull();
    expect(registry.list()).toHaveLength(1);
  });
});

describe('createLruCache', () => {
  it('kaster ut minst nylig brukte', () => {
    const cache = createLruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.size).toBe(2);
  });
});
