import type { ChangedEvent, FileChange, Revision, VaultSummary } from '../../../shared/api-types';
import type { CodeHighlighter } from '../code-highlight';
import type { VaultConfig } from '../config';
import { createNoteRenderer } from '../embeds';
import type { NoteRenderer, RenderedNote } from '../embeds';
import { buildBacklinkIndex, createLinkResolver } from '../links';
import type { BacklinkIndex, LinkResolver } from '../links';
import { createSearchIndex } from '../search';
import type { SearchDocument, SearchIndex } from '../search';
import { buildSnapshot, updateSnapshot } from '../vault-index';
import type { MetaExtractor, VaultSnapshot } from '../vault-index';
import { createLruCache } from './lru-cache';
import type { LruCache } from './lru-cache';

/** Alt som er avledet av ett snapshot. Uforanderlig; ny revisjon = nytt objekt (og tom render-cache, A20). */
export interface VaultState {
  readonly vaultId: string;
  readonly revision: Revision;
  readonly snapshot: VaultSnapshot;
  readonly links: LinkResolver;
  readonly backlinks: BacklinkIndex;
  readonly renderer: NoteRenderer;
  readonly renderCache: LruCache<string, RenderedNote>;
}

export interface VaultRuntime {
  readonly id: string;
  readonly name: string;
  summary(): VaultSummary;
  /** Starter indeksering ved første kall (lat, A12) og venter til indeksen er klar. */
  ready(): Promise<VaultState>;
  /** Søkeindeksen bygges i bakgrunnen etter at vaultet er klart. */
  searchIndex(): Promise<{ readonly index: SearchIndex; readonly revision: Revision }>;
  /** Lytter på endringsbunter (SSE `changed`). Returnerer avmeldingsfunksjon. */
  subscribe(listener: (event: ChangedEvent) => void): () => void;
  /** Inkrementell oppdatering av vault-relative disk-stier (brukes av filovervåkeren). */
  applyChanges(diskPaths: readonly string[]): Promise<readonly FileChange[]>;
  close(): Promise<void>;
}

export interface WatcherHandle {
  close(): Promise<void>;
}

export interface VaultRuntimeDeps {
  readonly highlighter: () => Promise<CodeHighlighter>;
  /** Extractor for første indeksering (worker-pool); lukkes etterpå. */
  readonly createInitialExtractor: () => MetaExtractor;
  /** Extractor for inkrementelle oppdateringer (inline). */
  readonly incrementalExtractor: MetaExtractor;
  /** Starter filovervåking; `null` = ingen (tester). */
  readonly watch: ((root: string, ignore: readonly string[], onBatch: (paths: string[]) => void) => WatcherHandle) | null;
  readonly renderCacheSize?: number;
  readonly log?: (message: string) => void;
}

export function createVaultRuntime(config: VaultConfig, deps: VaultRuntimeDeps): VaultRuntime {
  let status: VaultSummary['status'] = 'not-indexed';
  let errorMessage: string | undefined;
  let state: VaultState | null = null;
  let indexMs: number | null = null;
  let readyPromise: Promise<VaultState> | null = null;
  let searchPromise: Promise<SearchIndex> | null = null;
  let updateQueue: Promise<unknown> = Promise.resolve();
  let watcher: WatcherHandle | null = null;
  const listeners = new Set<(event: ChangedEvent) => void>();

  const derive = (snapshot: VaultSnapshot, revision: Revision, highlighter: CodeHighlighter): VaultState => {
    const aliases = new Map([...snapshot.notes].map(([path, note]) => [path, note.meta.aliases]));
    const links = createLinkResolver(snapshot.files.values(), aliases);
    return {
      vaultId: config.id,
      revision,
      snapshot,
      links,
      backlinks: buildBacklinkIndex(snapshot.notes.values(), links),
      renderer: createNoteRenderer({
        vaultId: config.id,
        highlighter,
        links,
        getNote: (filePath) => snapshot.notes.get(filePath) ?? null,
      }),
      renderCache: createLruCache(deps.renderCacheSize ?? 200),
    };
  };

  const startIndexing = async (): Promise<VaultState> => {
    status = 'indexing';
    const started = performance.now();
    const extractor = deps.createInitialExtractor();
    try {
      const [snapshot, highlighter] = await Promise.all([buildSnapshot(config.root, config.ignore, extractor), deps.highlighter()]);
      state = derive(snapshot, 1, highlighter);
      indexMs = Math.round(performance.now() - started);
      status = 'ready';
      deps.log?.(`Vault «${config.id}» indeksert: ${snapshot.notes.size} notater, ${snapshot.files.size} filer på ${indexMs} ms.`);
      if (deps.watch) watcher = deps.watch(config.root, config.ignore, (paths) => void runtime.applyChanges(paths));
      setImmediate(() => void runtime.searchIndex());
      return state;
    } catch (error) {
      status = 'error';
      errorMessage = `Kunne ikke indeksere vaultet: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage);
    } finally {
      await extractor.close();
    }
  };

  const searchDocuments = (snapshot: VaultSnapshot): SearchDocument[] => {
    const docs: SearchDocument[] = [];
    for (const note of snapshot.notes.values()) {
      if (note.file.kind !== 'note') continue;
      docs.push({ path: note.file.docPath, title: note.file.title, kind: 'note', aliases: note.meta.aliases, tags: note.meta.tags, text: note.meta.text });
    }
    for (const file of snapshot.files.values()) {
      if (file.kind === 'base') docs.push({ path: file.docPath, title: file.title, kind: 'base', aliases: [], tags: [], text: '' });
    }
    return docs;
  };

  const runtime: VaultRuntime = {
    id: config.id,
    name: config.name,
    summary: () => ({
      id: config.id,
      name: config.name,
      status,
      noteCount: state ? [...state.snapshot.files.values()].filter((f) => f.ext === 'md').length : null,
      revision: state?.revision ?? null,
      ...(indexMs !== null ? { indexMs } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    }),
    ready() {
      readyPromise ??= startIndexing();
      return readyPromise;
    },
    async searchIndex() {
      const current = await runtime.ready();
      searchPromise ??= Promise.resolve().then(() => createSearchIndex(searchDocuments(current.snapshot)));
      const index = await searchPromise;
      return { index, revision: state!.revision };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    applyChanges(diskPaths) {
      const run = async (): Promise<readonly FileChange[]> => {
        const current = await runtime.ready();
        const { snapshot, changes } = await updateSnapshot(current.snapshot, config.root, config.ignore, diskPaths, deps.incrementalExtractor);
        if (changes.length === 0) return changes;
        const next = derive(snapshot, current.revision + 1, await deps.highlighter());
        state = next;
        if (searchPromise) {
          const docs = new Map(searchDocuments(snapshot).map((d) => [d.path, d]));
          searchPromise = searchPromise.then((index) => {
            for (const change of changes) {
              index.remove(change.path);
              const doc = docs.get(change.path);
              if (doc && change.type !== 'removed') index.add(doc);
            }
            return index;
          });
        }
        readyPromise = Promise.resolve(next);
        const event: ChangedEvent = { vaultId: config.id, revision: next.revision, changes };
        for (const listener of listeners) listener(event);
        return changes;
      };
      const result = updateQueue.then(run, run);
      updateQueue = result.catch(() => undefined);
      return result;
    },
    async close() {
      await watcher?.close();
      listeners.clear();
    },
  };
  return runtime;
}
