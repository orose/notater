import type { ChangedEvent, FileChange, FilePath, Revision, VaultSummary } from '../../../shared/api-types';
import { yieldToEventLoop } from '../../shared/activity';
import type { CodeHighlighter } from '../code-highlight';
import type { VaultConfig } from '../config';
import { createNoteRenderer } from '../embeds';
import type { NoteRenderer, RenderedNote } from '../embeds';
import { buildBacklinkIndex, createLinkResolver } from '../links';
import type { BacklinkIndex, LinkResolver } from '../links';
import { buildSearchIndex } from '../search';
import type { SearchDocument, SearchIndex } from '../search';
import { createDeletionHold } from '../live-events';
import type { BatchClassification, DeletionHold } from '../live-events';
import {
  buildSnapshot,
  detectRenames,
  findByDocPath,
  hashText,
  normalizeVaultPath,
  readVaultBytes,
  readVaultText,
  scanVault,
  statVaultFile,
  toVaultFile,
  updateSnapshot,
} from '../vault-index';
import type { MetaExtractor, VaultFile, VaultSnapshot } from '../vault-index';
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
  /** Ekstra skjulte property-nøkler fra konfig (PO-22). */
  readonly hiddenProperties: readonly string[];
  summary(): VaultSummary;
  /** Starter indeksering ved første kall (lat, A12) og venter til indeksen er klar. */
  ready(): Promise<VaultState>;
  /**
   * Som `ready`, men venter også på syntaksfargeleggeren (Shiki), som lastes parallelt og ikke
   * forsinker «indeks klar» (AK17). Brukes før rendering.
   */
  renderReady(): Promise<VaultState>;
  /**
   * Forhåndsrendrer notatene `docPath` lenker til (i ledig tid), slik at neste klikk treffer
   * render-cachen (BUG-008).
   */
  prefetchLinks(docPath: string): void;
  /** Kodeblokkspråk i vaultet, mest brukt først (Shiki varmer disse opp først). Tom før indeksen er klar. */
  codeLanguages(): readonly string[];
  /** Søkeindeksen bygges i bakgrunnen etter at vaultet er klart. */
  searchIndex(): Promise<{ readonly index: SearchIndex; readonly revision: Revision }>;
  /** Lytter på endringsbunter (SSE `changed`). Returnerer avmeldingsfunksjon. */
  subscribe(listener: (event: ChangedEvent) => void): () => void;
  /** Inkrementell oppdatering av vault-relative disk-stier (brukes av filovervåkeren). */
  applyChanges(diskPaths: readonly string[]): Promise<readonly FileChange[]>;
  /** Leser en indeksert fil (disk-sti = vault-rot + indeksert relativ sti, verifisert innenfor roten). */
  readFile(file: VaultFile): Promise<Uint8Array>;
  close(): Promise<void>;
}

export interface WatcherHandle {
  /** Løses når overvåkerens første skanning er ferdig (chokidar `ready`). Utelatt = klar straks. */
  readonly ready?: Promise<void>;
  close(): Promise<void>;
}

const DEFAULT_PRERENDER_COUNT = 100;
/** PO-78: slettinger holdes tilbake så lenge for å kunne pares med en ny fil i neste bunt. */
const DEFAULT_RENAME_WINDOW_MS = 300;
/** Maks antall lenkemål som forhåndsrendres per åpnet notat. */
const MAX_PREFETCH_LINKS = 40;
/** Åpning av kodeblokk med språk: ```java / ~~~ts. */
const CODE_FENCE = /^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*([A-Za-z][\w+#-]*)/gm;

export interface VaultRuntimeDeps {
  readonly highlighter: () => Promise<CodeHighlighter>;
  /** Extractor for første indeksering (worker-pool); lukkes etterpå. */
  readonly createInitialExtractor: () => MetaExtractor;
  /** Extractor for inkrementelle oppdateringer (inline). */
  readonly incrementalExtractor: MetaExtractor;
  /** Starter filovervåking; `null` = ingen (tester). */
  readonly watch: ((root: string, ignore: readonly string[], onBatch: (paths: string[]) => void) => WatcherHandle) | null;
  readonly renderCacheSize?: number;
  /**
   * Løses når serveren er ledig (ingen forespørsler pågår). Bakgrunnsarbeid (søkeindeks,
   * forhåndsrendering) venter på denne mellom hver bit. Standard: neste event-loop-runde.
   */
  readonly idle?: () => Promise<void>;
  /** Antall mest lenkede notater som forhåndsrendres etter indeksering og etter endringer. Standard 100. */
  readonly prerenderCount?: number;
  /**
   * PO-78: hvor lenge en sletting fra overvåkeren holdes tilbake før `removed` sendes, slik at en
   * omdøping som deles over to debounce-bunter likevel gir `renamed`. Standard 300 ms; 0 = av.
   */
  readonly renameWindowMs?: number;
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
  let deletionHold: DeletionHold | null = null;
  /** Bunter fra overvåkeren før indeksen er klar (BUG-012); sendes videre når den er klar. */
  let earlyBatches: string[][] | null = [];
  const listeners = new Set<(event: ChangedEvent) => void>();
  const idle = deps.idle ?? yieldToEventLoop;
  // Når noen søker, skal resten av søkeindeksen bygges uten å vente på ledig tid – søket selv er jo en
  // pågående forespørsel, så å vente på «ledig» ville aldri slippe (vranglås).
  let markSearchUrgent!: () => void;
  const searchUrgent = new Promise<void>((resolve) => (markSearchUrgent = resolve));
  let isSearchUrgent = false;
  void searchUrgent.then(() => (isSearchUrgent = true));

  // Shiki lastes rett etter at indeksen er klar; «indeks klar» venter ikke på den (AK17).
  let highlighterPromise: Promise<CodeHighlighter> | null = null;
  let loadedHighlighter: CodeHighlighter | null = null;
  const loadHighlighter = (): Promise<CodeHighlighter> => {
    highlighterPromise ??= deps.highlighter().then((h) => (loadedHighlighter = h));
    return highlighterPromise;
  };
  const loaded = (): CodeHighlighter => {
    if (!loadedHighlighter) throw new Error('Syntaksfargeleggeren er ikke lastet ennå (bruk renderReady()).');
    return loadedHighlighter;
  };
  /** Delegerer til Shiki når den er lastet; rendering skjer bare etter `renderReady()`. */
  const highlighter: CodeHighlighter = {
    highlight: (code, lang) => loaded().highlight(code, lang),
    isSupported: (lang) => loaded().isSupported(lang),
    warmUp: (between) => loaded().warmUp(between),
  };

  const derive = (snapshot: VaultSnapshot, revision: Revision): VaultState => {
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
      renderCache: createLruCache(deps.renderCacheSize ?? 500),
    };
  };

  /**
   * PO-78: hva i bunten som er slettet (holdes tilbake), og hvilke slettinger som er samme fil som en ny
   * fil i bunten – samme kriterier som paringen i `updateSnapshot` (inode + størrelse eller innholdshash).
   */
  const classifyBatch = async (paths: readonly string[], held: readonly string[]): Promise<BatchClassification> => {
    const files = state?.snapshot.files ?? new Map<FilePath, VaultFile>();
    const stats = await Promise.all(paths.map((p) => statVaultFile(config.root, p)));
    const deleted: string[] = [];
    const present: string[] = [];
    const fresh: VaultFile[] = [];
    paths.forEach((path, i) => {
      const scanned = stats[i];
      if (!scanned) deleted.push(path);
      else {
        present.push(path);
        if (!files.has(normalizeVaultPath(path))) fresh.push(toVaultFile(scanned));
      }
    });
    const candidates = [...held, ...deleted];
    if (fresh.length === 0 || candidates.length === 0) return { deleted, present, release: [] };

    // Gamle filer per slettet sti (en slettet mappe dekker filene under den).
    const owner = new Map<string, string>();
    for (const path of candidates) {
      const filePath = normalizeVaultPath(path);
      const exact = files.get(filePath);
      if (exact) owner.set(exact.docPath, path);
      else {
        const prefix = `${filePath.replace(/\/+$/, '')}/`;
        for (const file of files.values()) if (file.filePath.startsWith(prefix)) owner.set(file.docPath, path);
      }
    }
    const removed = [...files.values()].filter((f) => owner.has(f.docPath));
    // Innholdshash bare for nye tekstfiler, og bare når det finnes tilbakeholdte slettinger å pare med.
    const added = await Promise.all(
      fresh.map(async (file): Promise<VaultFile> => {
        if (file.ext !== 'md' && file.kind !== 'base') return file;
        const text = await readVaultText(config.root, file.diskPath).catch(() => null);
        return text === null ? file : { ...file, contentHash: hashText(text) };
      }),
    );
    const release = new Set<string>();
    for (const pair of detectRenames(removed, added)) release.add(owner.get(pair.from!)!);
    return { deleted, present, release: [...release] };
  };

  const onWatchBatch = (paths: string[]): void => {
    if (earlyBatches) earlyBatches.push(paths);
    else deletionHold?.push(paths);
  };

  /**
   * BUG-012: det som endret seg mellom vår skanning og overvåkerens `ready`, regner chokidar som
   * «initial» og melder aldri. En rask ny skanning (bare stat) etter `ready` fanger det opp.
   */
  const reconcile = async (snapshot: VaultSnapshot): Promise<VaultSnapshot> => {
    const scanned = await scanVault(config.root, config.ignore);
    const seen = new Set<FilePath>();
    const paths: string[] = [];
    for (const s of scanned) {
      const filePath = normalizeVaultPath(s.diskPath);
      seen.add(filePath);
      const known = snapshot.files.get(filePath);
      if (!known || known.mtimeMs !== s.mtimeMs || known.size !== s.size) paths.push(s.diskPath);
    }
    for (const file of snapshot.files.values()) if (!seen.has(file.filePath)) paths.push(file.diskPath);
    if (paths.length === 0) return snapshot;
    return (await updateSnapshot(snapshot, config.root, config.ignore, paths, deps.incrementalExtractor)).snapshot;
  };

  const startIndexing = async (): Promise<VaultState> => {
    status = 'indexing';
    const started = performance.now();
    const extractor = deps.createInitialExtractor();
    try {
      // BUG-012: overvåkeren startes før skanningen (chokidars første skanning går parallelt med vår),
      // og «klar» venter på begge. Bunter som kommer underveis, samles og sendes videre etterpå.
      if (deps.watch) watcher = deps.watch(config.root, config.ignore, onWatchBatch);
      let snapshot = await buildSnapshot(config.root, config.ignore, extractor);
      if (watcher) {
        await watcher.ready;
        snapshot = await reconcile(snapshot);
      }
      state = derive(snapshot, 1);
      indexMs = Math.round(performance.now() - started);
      status = 'ready';
      deps.log?.(`Vault «${config.id}» indeksert: ${snapshot.notes.size} notater, ${snapshot.files.size} filer på ${indexMs} ms.`);
      if (watcher) {
        deletionHold = createDeletionHold({
          windowMs: deps.renameWindowMs ?? DEFAULT_RENAME_WINDOW_MS,
          classify: classifyBatch,
          apply: (paths) => void runtime.applyChanges(paths).catch((error: unknown) => deps.log?.(`Live reload feilet: ${String(error)}`)),
          ...(deps.log ? { log: deps.log } : {}),
        });
        for (const paths of earlyBatches ?? []) deletionHold.push(paths);
      }
      earlyBatches = null;
      // Shiki (~0,5 s CPU på hovedtråden) lastes etter at indeksen er klar: parallelt kostet det ~0,4 s
      // indekseringstid (workerne bruker alle kjerner). Rendering venter på den via renderReady().
      void loadHighlighter().catch((error: unknown) => deps.log?.(`Kunne ikke laste Shiki: ${String(error)}`));
      void startBackground();
      return state;
    } catch (error) {
      void watcher?.close();
      watcher = null;
      earlyBatches = null;
      status = 'error';
      errorMessage = `Kunne ikke indeksere vaultet: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage, { cause: error });
    } finally {
      // Ikke vent på at workerne avsluttes: indeksen er klar.
      void extractor.close();
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

  /** Søkeindeksen bygges i biter i ledig tid; et søk gjør den «haster» (bitene venter ikke på ledig tid). */
  const startSearchBuild = (snapshot: VaultSnapshot): Promise<SearchIndex> => {
    searchPromise ??= buildSearchIndex(searchDocuments(snapshot), () =>
      isSearchUrgent ? yieldToEventLoop() : Promise.race([idle(), searchUrgent.then(yieldToEventLoop)]),
    );
    return searchPromise;
  };

  // Forhåndsrendering (BUG-008): én note per bit, bare i ledig tid, inn i gjeldende revisjons render-cache.
  // Render-cachen tilhører en revisjon (A20), så live reload invaliderer fortsatt alt, også embeds.
  const prerenderQueue: FilePath[] = [];
  const queued = new Set<FilePath>();
  let pumping = false;

  const enqueue = (filePaths: readonly FilePath[], urgent: boolean): void => {
    const fresh = filePaths.filter((p) => !queued.has(p));
    for (const p of fresh) queued.add(p);
    if (urgent) prerenderQueue.unshift(...fresh);
    else prerenderQueue.push(...fresh);
    if (!pumping) void pump();
  };

  const pump = async (): Promise<void> => {
    pumping = true;
    try {
      await loadHighlighter();
      while (prerenderQueue.length > 0) {
        await idle();
        const filePath = prerenderQueue.shift()!;
        queued.delete(filePath);
        const current = state;
        const file = current?.snapshot.files.get(filePath);
        if (!current || !file || file.kind !== 'note' || current.renderCache.has(filePath)) continue;
        current.renderCache.set(filePath, current.renderer.renderNote(file));
      }
    } catch (error) {
      deps.log?.(`Forhåndsrendering stoppet: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      pumping = false;
    }
  };

  /** De mest lenkede notatene er de som oftest åpnes via lenker (preferential attachment). */
  const mostLinked = (current: VaultState): FilePath[] => {
    const count = deps.prerenderCount ?? DEFAULT_PRERENDER_COUNT;
    if (count <= 0) return [];
    return [...current.snapshot.notes.values()]
      .filter((n) => n.file.kind === 'note')
      .map((n) => [n.file.filePath, current.backlinks.get(n.file.filePath).length] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([filePath]) => filePath);
  };

  const startBackground = async (): Promise<void> => {
    try {
      await idle();
      await startSearchBuild(state!.snapshot);
      if (state) enqueue(mostLinked(state), false);
    } catch (error) {
      deps.log?.(`Bakgrunnsarbeid feilet: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const runtime: VaultRuntime = {
    id: config.id,
    name: config.name,
    hiddenProperties: config.hiddenProperties,
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
    async renderReady() {
      await runtime.ready();
      await loadHighlighter();
      return state!;
    },
    prefetchLinks(docPath) {
      const current = state;
      const file = current ? findByDocPath(current.snapshot, docPath) : null;
      const note = file && current ? current.snapshot.notes.get(file.filePath) : undefined;
      if (!current || !file || !note) return;
      const targets = new Set<FilePath>();
      for (const link of note.meta.links) {
        if (link.kind === 'embed' || link.kind === 'markdown-embed' || link.target === '') continue;
        const syntax = link.kind === 'markdown' ? 'markdown' : 'wiki';
        const resolved = current.links.resolve(link.target, file.filePath, syntax);
        if (resolved && resolved.file.kind === 'note' && resolved.file.filePath !== file.filePath) targets.add(resolved.file.filePath);
        if (targets.size >= MAX_PREFETCH_LINKS) break;
      }
      enqueue([...targets], true);
    },
    codeLanguages() {
      if (!state) return [];
      const counts = new Map<string, number>();
      for (const note of state.snapshot.notes.values()) {
        for (const match of note.body.matchAll(CODE_FENCE)) {
          const lang = match[1]!.toLowerCase();
          counts.set(lang, (counts.get(lang) ?? 0) + 1);
        }
      }
      return [...counts].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
    },
    async searchIndex() {
      const current = await runtime.ready();
      markSearchUrgent();
      const index = await startSearchBuild(current.snapshot);
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
        const next = derive(snapshot, current.revision + 1);
        state = next;
        // Ny revisjon = tom render-cache (A20); fyll den igjen i ledig tid.
        enqueue(mostLinked(next), false);
        if (searchPromise) {
          const docs = new Map(searchDocuments(snapshot).map((d) => [d.path, d]));
          searchPromise = searchPromise.then((index) => {
            for (const change of changes) {
              if (change.type === 'renamed') continue; // dekket av removed + added
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
    readFile: (file) => readVaultBytes(config.root, file.diskPath),
    async close() {
      deletionHold?.close();
      await watcher?.close();
      listeners.clear();
    },
  };
  return runtime;
}
