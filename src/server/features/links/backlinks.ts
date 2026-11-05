import type { FilePath } from '../../../shared/api-types';
import type { IndexedNote, VaultFile } from '../vault-index';
import type { LinkResolver } from './link-resolver';

export interface BacklinkEntry {
  readonly source: VaultFile;
  /** Antall lenker fra kilden til målet. */
  readonly count: number;
  /** Tekstutdrag rundt (første brødtekst-)lenke. */
  readonly snippet: string;
  /** Minst én av lenkene står i en frontmatter-property (PO-9). */
  readonly fromProperty: boolean;
}

export interface BacklinkIndex {
  /** Tilbakelenker til `filePath`, sortert på kildens tittel (nb). Selvlenker telles ikke. */
  get(filePath: FilePath): readonly BacklinkEntry[];
  /**
   * Kilder som lenker til et mål som IKKE finnes (PO-28, «Lenket fra» på «ikke skrevet ennå»-siden).
   * `target` er lenkemålet uten alias/anker; sammenlignes case-insensitivt, NFC, uten `.md`.
   */
  getUnresolved(target: string): readonly BacklinkEntry[];
}

/** Nøkkel for brutte lenkemål: NFC, små bokstaver, `/`-separator, uten ledende `./` og `.md`. */
export function unresolvedTargetKey(target: string): string {
  return target
    .normalize('NFC')
    .replace(/\\/g, '/')
    .trim()
    .replace(/^(\.\/)+/, '')
    .replace(/\.md$/i, '')
    .toLowerCase();
}

interface MutableEntry {
  source: VaultFile;
  count: number;
  snippet: string | null;
  propertySnippet: string | null;
}

export function buildBacklinkIndex(notes: Iterable<IndexedNote>, resolver: LinkResolver): BacklinkIndex {
  const graph = new Map<FilePath, Map<FilePath, MutableEntry>>();
  const unresolved = new Map<string, Map<FilePath, MutableEntry>>();
  for (const note of notes) {
    const from = note.file.filePath;
    for (const link of note.meta.links) {
      if (link.target === '') continue;
      const resolved = resolver.resolve(link.target, from, link.kind.startsWith('markdown') ? 'markdown' : 'wiki');
      if (resolved?.file.filePath === from) continue;
      const targetGraph = resolved ? graph : unresolved;
      const targetKey = resolved ? resolved.file.filePath : unresolvedTargetKey(link.target);
      let sources = targetGraph.get(targetKey);
      if (!sources) targetGraph.set(targetKey, (sources = new Map()));
      let entry = sources.get(from);
      if (!entry) sources.set(from, (entry = { source: note.file, count: 0, snippet: null, propertySnippet: null }));
      entry.count += 1;
      if (link.kind === 'property') entry.propertySnippet ??= link.snippet;
      else entry.snippet ??= link.snippet;
    }
  }

  const toEntries = (sources: Map<FilePath, MutableEntry> | undefined): BacklinkEntry[] =>
    [...(sources?.values() ?? [])]
      .map((e) => ({
        source: e.source,
        count: e.count,
        snippet: e.snippet ?? e.propertySnippet ?? '',
        fromProperty: e.propertySnippet !== null,
      }))
      .sort((a, b) => a.source.title.localeCompare(b.source.title, 'nb') || a.source.filePath.localeCompare(b.source.filePath, 'nb'));

  const cache = new Map<FilePath, readonly BacklinkEntry[]>();
  return {
    get(filePath) {
      const cached = cache.get(filePath);
      if (cached) return cached;
      const entries = toEntries(graph.get(filePath));
      cache.set(filePath, entries);
      return entries;
    },
    getUnresolved(target) {
      return toEntries(unresolved.get(unresolvedTargetKey(target)));
    },
  };
}
