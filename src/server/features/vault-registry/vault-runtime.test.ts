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
  prerenderCount: 0,
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

describe('ytelse: lat Shiki, forhåndsrendering og ledig tid (BUG-008/009)', () => {
  const config = () => ({ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] });
  const waitFor = async (check: () => boolean): Promise<void> => {
    for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
    expect(check()).toBe(true);
  };

  it('ready() venter ikke på Shiki; renderReady() gjør det', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const vault = createVaultRuntime(config(), { ...deps, highlighter: async () => (await gate, testHighlighter()) });
    const state = await vault.ready();
    expect(state.revision).toBe(1);
    let rendered = false;
    const render = vault.renderReady().then(() => (rendered = true));
    await new Promise((r) => setTimeout(r, 20));
    expect(rendered).toBe(false);
    release();
    await render;
    expect(rendered).toBe(true);
  }, 30_000);

  it('de mest lenkede notatene forhåndsrendres etter indeksering og etter en endring', async () => {
    const vault = createVaultRuntime(config(), { ...deps, prerenderCount: 1 });
    const first = await vault.renderReady();
    await waitFor(() => first.renderCache.has('B.md'));
    expect(first.renderCache.has('A.md')).toBe(false);
    await writeFile(join(root, 'A.md'), '# A\nSe [[B]] igjen.');
    await vault.applyChanges(['A.md']);
    const next = await vault.ready();
    expect(next.renderCache.has('B.md')).toBe(false);
    await waitFor(() => next.renderCache.has('B.md'));
  }, 30_000);

  it('prefetchLinks rendrer lenkemålene i ledig tid – og venter mens serveren er opptatt', async () => {
    let busy = true;
    const waiting: Array<() => void> = [];
    const idle = () => new Promise<void>((r) => (busy ? waiting.push(r) : setImmediate(r)));
    const vault = createVaultRuntime(config(), { ...deps, idle });
    const state = await vault.renderReady();
    vault.prefetchLinks('A');
    await new Promise((r) => setTimeout(r, 30));
    expect(state.renderCache.has('B.md')).toBe(false);
    busy = false;
    for (const r of waiting.splice(0)) r();
    await waitFor(() => state.renderCache.has('B.md'));
    expect(state.renderCache.has('A.md')).toBe(false);
  }, 30_000);

  it('søk mens serveren aldri blir ledig: søkeindeksen bygges likevel ferdig (ingen vranglås)', async () => {
    for (let i = 0; i < 80; i++) await writeFile(join(root, `N${i}.md`), `# N${i}\nord${i}`);
    // Ledig de to første gangene (bakgrunnsbyggingen starter og tar første bit), deretter aldri.
    let calls = 0;
    const idle = () => (++calls <= 2 ? new Promise<void>((r) => setImmediate(r)) : new Promise<void>(() => undefined));
    const vault = createVaultRuntime(config(), { ...deps, idle });
    await vault.ready();
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBeGreaterThanOrEqual(3);
    const { index } = await vault.searchIndex();
    expect(index.search('ord79', 10).map((h) => h.path)).toContain('N79');
  }, 30_000);

  it('codeLanguages: kodeblokkspråk etter hyppighet', async () => {
    await writeFile(join(root, 'Kode.md'), '```java\na\n```\n\n```ts\nb\n```\n\n~~~java\nc\n~~~\n\n```\nuten språk\n```');
    const vault = createVaultRuntime(config(), deps);
    expect(vault.codeLanguages()).toEqual([]);
    await vault.ready();
    expect(vault.codeLanguages()).toEqual(['java', 'ts']);
  });

  it('live reload: endret embed-mål gir nytt innhold selv om verten var forhåndsrendret', async () => {
    const { getDocument } = await import('../documents');
    const { createBaseEvaluator } = await import('../bases');
    await writeFile(join(root, 'Vert.md'), '# Vert\n![[Mål]]');
    await writeFile(join(root, 'Mål.md'), '# Mål\nGammel tekst');
    const vault = createVaultRuntime(config(), { ...deps, prerenderCount: 10 });
    const first = await vault.renderReady();
    await waitFor(() => first.renderCache.has('Vert.md'));
    const text = (s: typeof first) => JSON.stringify(getDocument(s, 'Vert', createBaseEvaluator()));
    expect(text(first)).toContain('Gammel tekst');
    await writeFile(join(root, 'Mål.md'), '# Mål\nNy tekst');
    await vault.applyChanges(['Mål.md']);
    const next = await vault.renderReady();
    expect(text(next)).toContain('Ny tekst');
    expect(text(next)).not.toContain('Gammel tekst');
  }, 30_000);
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
