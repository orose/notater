// Vaultet for terminalen (ADR-011 §2, AR-3-05): server-featurene direkte, uten HTTP. Ett vault, worker-pool for første
// indeksering, chokidar i prosessen, ingen bakgrunnsarbeid (SV1), fremdrift (SV3), og Shiki startet ved t0 med bare
// språkene notatet trenger (M1, SV2).

import type { NoteDocument } from '../../../shared/api-types';
import { createBaseEvaluator } from '../../../server/features/bases';
import { createCodeHighlighter, type CodeHighlighter } from '../../../server/features/code-highlight';
import type { VaultConfig } from '../../../server/features/config';
import { getDocument } from '../../../server/features/documents';
import { watchVault } from '../../../server/features/live-events';
import { createInlineMetaExtractor, createWorkerMetaExtractor, findByDocPath, type MetaExtractor } from '../../../server/features/vault-index';
import { createVaultRuntime, type VaultRuntime, type VaultState } from '../../../server/features/vault-registry';
import { lookupNote, type NoteCandidate, type NoteLookup } from './note-lookup';

export interface TerminalVaultOptions {
  /** Fremdrift under indeksering (oppstartsskjermen). */
  readonly onProgress?: (done: number, total: number) => void;
  /** Overvåk vaultet (live). Standard: ja. */
  readonly watch?: boolean;
  /** Extractor for første indeksering. Standard: worker-pool. */
  readonly createInitialExtractor?: () => MetaExtractor;
  /** Ferdig bygget worker-kode (M2-bunten har den ved siden av seg). Standard: esbuild i minnet. */
  readonly workerSource?: () => Promise<string | null>;
  readonly log?: (message: string) => void;
}

export interface TerminalVault {
  readonly runtime: VaultRuntime;
  readonly config: VaultConfig;
  ready(): Promise<VaultState>;
  /** Notatene (ikke `.base`, vedlegg eller ustøttede filer). */
  notes(state: VaultState): readonly NoteCandidate[];
  lookup(state: VaultState, query: string): NoteLookup;
  /** Notatet som `NoteDocument` (som API-et), med grammatikkene for notatets og embedenes språk lastet. `null` = finnes ikke. */
  document(docPath: string): Promise<NoteDocument | null>;
  close(): Promise<void>;
}

/** Åpning av kodeblokk med språk: ```java / ~~~ts (samme regel som `VaultRuntime.codeLanguages`). */
const CODE_FENCE = /^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*([A-Za-z][\w+#-]*)/gm;
/** Embeds følges til samme dybde som renderen (MAX_EMBED_DEPTH). */
const EMBED_DEPTH = 4;

/** Kodespråkene i notatet og embed-målene (dybde ≤ 4), for `ensureLanguages` før rendering (M1). */
export function noteLanguages(state: VaultState, filePath: string): string[] {
  const langs = new Set<string>();
  const seen = new Set<string>();
  const visit = (path: string, depth: number) => {
    if (seen.has(path) || depth > EMBED_DEPTH) return;
    seen.add(path);
    const note = state.snapshot.notes.get(path);
    if (!note) return;
    for (const m of note.body.matchAll(CODE_FENCE)) langs.add(m[1]!.toLowerCase());
    for (const link of note.meta.links) {
      if (link.kind !== 'embed' && link.kind !== 'markdown-embed') continue;
      const resolved = state.links.resolve(link.target, path, link.kind === 'markdown-embed' ? 'markdown' : 'wiki');
      if (resolved?.file.kind === 'note') visit(resolved.file.filePath, depth + 1);
    }
  };
  visit(filePath, 0);
  return [...langs];
}

export function openTerminalVault(config: VaultConfig, options: TerminalVaultOptions = {}): TerminalVault {
  // M1: Shiki-kjernen (WASM) startes nå, parallelt med workerne, uten grammatikker.
  const highlighter: Promise<CodeHighlighter> = createCodeHighlighter({ preload: [] });
  highlighter.catch(() => undefined);
  const runtime = createVaultRuntime(config, {
    highlighter: () => highlighter,
    createInitialExtractor: options.createInitialExtractor ?? (() => (options.workerSource ? createWorkerMetaExtractor(undefined, options.workerSource) : createWorkerMetaExtractor())),
    incrementalExtractor: createInlineMetaExtractor(),
    watch: options.watch === false ? null : (root, ignore, onBatch) => watchVault(root, ignore, onBatch),
    background: false,
    prerenderCount: 0,
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    ...(options.log ? { log: options.log } : {}),
  });
  const bases = createBaseEvaluator();
  const notesCache = new WeakMap<VaultState, NoteCandidate[]>();

  const notes = (state: VaultState): NoteCandidate[] => {
    let hit = notesCache.get(state);
    if (!hit) {
      hit = [...state.snapshot.notes.values()]
        .filter((n) => n.file.kind === 'note')
        .map((n) => ({ docPath: n.file.docPath, filePath: n.file.filePath, title: n.file.title, aliases: n.meta.aliases, mtimeMs: n.file.mtimeMs }));
      notesCache.set(state, hit);
    }
    return hit;
  };

  return {
    runtime,
    config,
    ready: () => runtime.ready(),
    notes,
    lookup(state, query) {
      return lookupNote(notes(state), query, (q) => {
        const resolved = state.links.resolve(q, '', 'wiki');
        return resolved?.file.kind === 'note' ? resolved.file.docPath : null;
      });
    },
    async document(docPath) {
      const state = await runtime.ready();
      const file = findByDocPath(state.snapshot, docPath);
      if (!file || file.kind !== 'note') return null;
      await (await highlighter).ensureLanguages(noteLanguages(state, file.filePath));
      const current = await runtime.renderReady();
      const doc = getDocument(current, docPath, bases, { hiddenProperties: runtime.hiddenProperties });
      return doc?.kind === 'note' ? doc : null;
    },
    close: () => runtime.close(),
  };
}
