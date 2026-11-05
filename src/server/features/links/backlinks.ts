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
}

interface MutableEntry {
  source: VaultFile;
  count: number;
  snippet: string | null;
  propertySnippet: string | null;
}

export function buildBacklinkIndex(notes: Iterable<IndexedNote>, resolver: LinkResolver): BacklinkIndex {
  const graph = new Map<FilePath, Map<FilePath, MutableEntry>>();
  for (const note of notes) {
    const from = note.file.filePath;
    for (const link of note.meta.links) {
      if (link.target === '') continue;
      const resolved = resolver.resolve(link.target, from, link.kind.startsWith('markdown') ? 'markdown' : 'wiki');
      if (!resolved || resolved.file.filePath === from) continue;
      const targetKey = resolved.file.filePath;
      let sources = graph.get(targetKey);
      if (!sources) graph.set(targetKey, (sources = new Map()));
      let entry = sources.get(from);
      if (!entry) sources.set(from, (entry = { source: note.file, count: 0, snippet: null, propertySnippet: null }));
      entry.count += 1;
      if (link.kind === 'property') entry.propertySnippet ??= link.snippet;
      else entry.snippet ??= link.snippet;
    }
  }

  const cache = new Map<FilePath, readonly BacklinkEntry[]>();
  return {
    get(filePath) {
      const cached = cache.get(filePath);
      if (cached) return cached;
      const entries = [...(graph.get(filePath)?.values() ?? [])]
        .map((e) => ({
          source: e.source,
          count: e.count,
          snippet: e.snippet ?? e.propertySnippet ?? '',
          fromProperty: e.propertySnippet !== null,
        }))
        .sort((a, b) => a.source.title.localeCompare(b.source.title, 'nb') || a.source.filePath.localeCompare(b.source.filePath, 'nb'));
      cache.set(filePath, entries);
      return entries;
    },
  };
}
