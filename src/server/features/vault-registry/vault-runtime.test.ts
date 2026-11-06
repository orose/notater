import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('omdøping gir SSE-hendelse med removed, added og renamed (PO-49)', async () => {
    const { rename } = await import('node:fs/promises');
    const vault = createVaultRuntime({ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] }, deps);
    await vault.ready();
    const events: ChangedEvent[] = [];
    vault.subscribe((e) => events.push(e));
    await rename(join(root, 'B.md'), join(root, 'B2.md'));
    await vault.applyChanges(['B.md', 'B2.md']);
    expect(events[0]!.changes).toEqual([
      { type: 'removed', path: 'B' },
      { type: 'added', path: 'B2' },
      { type: 'renamed', path: 'B2', from: 'B', to: 'B2' },
    ]);
    const { index } = await vault.searchIndex();
    expect(index.search('B2', 10).map((h) => h.path)).toContain('B2');
  });

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

/** Falsk filovervåker: testen leverer buntene selv og styrer når den er «klar». */
function fakeWatcher() {
  let onBatch: ((paths: string[]) => void) | null = null;
  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => (markReady = resolve));
  const watch: VaultRuntimeDeps['watch'] = (_root, _ignore, cb) => {
    onBatch = cb;
    return { ready, close: async () => undefined };
  };
  return {
    watch,
    markReady: () => markReady(),
    batch: (paths: string[]) => {
      if (!onBatch) throw new Error('Overvåkeren er ikke startet');
      onBatch(paths);
    },
  };
}

// Ekte setTimeout fanges før fake timers slås på, slik at testene kan vente på ekte fil-I/O.
const realSetTimeout = globalThis.setTimeout;
const realSleep = (ms: number): Promise<void> => new Promise((r) => realSetTimeout(r, ms));
const until = async (check: () => boolean): Promise<void> => {
  for (let i = 0; i < 300 && !check(); i++) await realSleep(10);
  expect(check()).toBe(true);
};

describe('omdøping delt over to debounce-bunter (PO-78)', () => {
  const config = () => ({ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] });

  afterEach(() => {
    vi.useRealTimers();
  });

  const start = async (renameWindowMs = 300) => {
    const watcher = fakeWatcher();
    watcher.markReady();
    const vault = createVaultRuntime(config(), { ...deps, watch: watcher.watch, renameWindowMs });
    await vault.ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const events: ChangedEvent[] = [];
    vault.subscribe((e) => events.push(e));
    return { vault, watcher, events };
  };

  it('removed i én bunt og added i neste gir én hendelse med removed, added og renamed', async () => {
    const { rename } = await import('node:fs/promises');
    const { watcher, events } = await start();
    await rename(join(root, 'B.md'), join(root, 'B2.md'));

    watcher.batch(['B.md']);
    await vi.advanceTimersByTimeAsync(150);
    await realSleep(50);
    expect(events).toEqual([]); // slettingen holdes tilbake

    watcher.batch(['B2.md']);
    await until(() => events.length > 0);
    expect(events).toEqual([
      {
        vaultId: 'v',
        revision: 2,
        changes: [
          { type: 'removed', path: 'B' },
          { type: 'added', path: 'B2' },
          { type: 'renamed', path: 'B2', from: 'B', to: 'B2' },
        ],
      },
    ]);

    await vi.advanceTimersByTimeAsync(1000);
    await realSleep(50);
    expect(events).toHaveLength(1);
  });

  it('sletting uten ny fil kommer frem som removed når vinduet går ut', async () => {
    const { watcher, events } = await start();
    await rm(join(root, 'B.md'));

    watcher.batch(['B.md']);
    await realSleep(50);
    await vi.advanceTimersByTimeAsync(299);
    await realSleep(50);
    expect(events).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    await until(() => events.length > 0);
    expect(events).toEqual([{ vaultId: 'v', revision: 2, changes: [{ type: 'removed', path: 'B' }] }]);
  });

  it('en annen ny fil i samme bunt som slettingen hindrer ikke paringen (ak12-scenariet)', async () => {
    const { mkdir, rename } = await import('node:fs/promises');
    const { watcher, events } = await start();
    await mkdir(join(root, 'arkiv'));
    await rename(join(root, 'B.md'), join(root, 'arkiv/B2.md'));
    await writeFile(join(root, 'Støy.md'), '# Støy');

    watcher.batch(['B.md', 'Støy.md']);
    await until(() => events.length > 0);
    expect(events[0]!.changes).toEqual([{ type: 'added', path: 'Støy' }]);

    await vi.advanceTimersByTimeAsync(150);
    watcher.batch(['arkiv/B2.md']);
    await until(() => events.length > 1);
    expect(events[1]!.changes).toEqual([
      { type: 'removed', path: 'B' },
      { type: 'added', path: 'arkiv/B2' },
      { type: 'renamed', path: 'arkiv/B2', from: 'B', to: 'arkiv/B2' },
    ]);
  });

  it('kopi + sletting (ny inode, samme innhold) pares også over to bunter', async () => {
    const { watcher, events } = await start();
    await writeFile(join(root, 'B-kopi.md'), '# B');
    await rm(join(root, 'B.md'));
    watcher.batch(['B.md']);
    await realSleep(50);
    await vi.advanceTimersByTimeAsync(200);
    watcher.batch(['B-kopi.md']);
    await until(() => events.length > 0);
    expect(events[0]!.changes).toContainEqual({ type: 'renamed', path: 'B-kopi', from: 'B', to: 'B-kopi' });
  });

  it('vanlige endringer venter ikke på vinduet', async () => {
    const { watcher, events } = await start();
    await writeFile(join(root, 'A.md'), '# A endret og lengre');
    watcher.batch(['A.md']);
    await until(() => events.length > 0); // ingen fake-tid flyttet
    expect(events[0]!.changes).toEqual([{ type: 'changed', path: 'A' }]);
  });
});

describe('oppstart venter på filovervåkeren (BUG-012)', () => {
  it('«ready» kommer først når overvåkeren er klar, og endringer fra vinduet før det er med', async () => {
    const watcher = fakeWatcher();
    // Endringene skjer etter at skanningen er ferdig, men før overvåkeren er klar (= chokidar regner dem som «initial»).
    const createInitialExtractor = () => {
      const inner = createInlineMetaExtractor();
      return {
        ...inner,
        extractMany: async (sources: readonly string[]) => {
          await writeFile(join(root, 'C.md'), '# C');
          await writeFile(join(root, 'A.md'), '# A er endret etter skanningen');
          await rm(join(root, 'B.md'));
          return inner.extractMany(sources);
        },
      };
    };
    const vault = createVaultRuntime({ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] }, { ...deps, watch: watcher.watch, createInitialExtractor });
    let resolved = false;
    const ready = vault.ready().then((s) => ((resolved = true), s));
    await realSleep(200);
    expect(resolved).toBe(false);
    expect(vault.summary().status).toBe('indexing');

    watcher.markReady();
    const state = await ready;
    expect(state.revision).toBe(1);
    expect([...state.snapshot.files.keys()].sort()).toEqual(['A.md', 'C.md']);
    expect(state.snapshot.notes.get('A.md')!.body).toContain('endret etter skanningen');
    expect(vault.summary()).toMatchObject({ status: 'ready', noteCount: 2, revision: 1 });
  });

  it('hendelser fra overvåkeren under indekseringen tas med', async () => {
    const watcher = fakeWatcher();
    const vault = createVaultRuntime({ id: 'v', name: 'V', root, ignore: [], hiddenProperties: [] }, { ...deps, watch: watcher.watch, renameWindowMs: 0 });
    const ready = vault.ready();
    await until(() => vault.summary().status === 'indexing');
    watcher.batch(['D.md']); // bunt før «ready»: må ikke kaste eller gå tapt
    watcher.markReady();
    await ready;
    const events: ChangedEvent[] = [];
    vault.subscribe((e) => events.push(e));
    await writeFile(join(root, 'D.md'), '# D');
    watcher.batch(['D.md']);
    await until(() => events.length > 0);
    expect(events[0]!.changes).toEqual([{ type: 'added', path: 'D' }]);
  });
});
