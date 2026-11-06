import MiniSearch from 'minisearch';
import type { DocPath, SearchHit } from '../../../shared/api-types';

export interface SearchDocument {
  readonly path: DocPath;
  readonly title: string;
  readonly kind: 'note' | 'base';
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  /** Ren tekst (uten kommentarer). */
  readonly text: string;
}

export interface SearchIndex {
  /** `q` som starter med `#` = taggsøk (inkl. nestede tagger). */
  search(query: string, limit: number): SearchHit[];
  add(doc: SearchDocument): void;
  remove(path: DocPath): void;
}

const SNIPPET_LENGTH = 160;

/**
 * Normaliserer et søkeord: små bokstaver, NFC, æ→ae, ø→o, å→a og fjerner aksenter. ø/å gir også
 * en «oe»/«aa»-variant, slik at både «oyeblikk» og «oeyeblikk» finner «øyeblikk» (README-QA R8).
 */
export function foldDiacritics(term: string): string[] {
  const base = term.normalize('NFC').toLowerCase().replace(/æ/g, 'ae');
  const strip = (s: string): string => s.normalize('NFD').replace(/\p{M}+/gu, '');
  const short = strip(base.replace(/ø/g, 'o').replace(/å/g, 'a'));
  const long = strip(base.replace(/ø/g, 'oe').replace(/å/g, 'aa'));
  return short === long ? [short] : [short, long];
}

const processTerm = (term: string): string[] | null => {
  const folded = foldDiacritics(term).filter((t) => t !== '');
  return folded.length > 0 ? folded : null;
};

export function createSearchIndex(docs: Iterable<SearchDocument>): SearchIndex {
  const byPath = new Map<DocPath, SearchDocument>();
  const mini = new MiniSearch<{ id: DocPath; title: string; aliases: string; text: string }>({
    fields: ['title', 'aliases', 'text'],
    processTerm,
    searchOptions: {
      boost: { title: 4, aliases: 3, text: 1 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
    },
  });
  const toEntry = (doc: SearchDocument) => ({ id: doc.path, title: doc.title, aliases: doc.aliases.join('\n'), text: doc.text });

  const add = (doc: SearchDocument): void => {
    if (byPath.has(doc.path)) mini.discard(doc.path);
    byPath.set(doc.path, doc);
    mini.add(toEntry(doc));
  };
  const initial = [...docs];
  for (const doc of initial) byPath.set(doc.path, doc);
  mini.addAll(initial.map(toEntry));

  return {
    add,
    remove(path) {
      if (!byPath.has(path)) return;
      byPath.delete(path);
      mini.discard(path);
    },
    search(query, limit) {
      const q = query.trim();
      if (q === '') return [];
      if (q.startsWith('#')) return searchTag(byPath.values(), q.slice(1), limit);
      const words = q.split(/\s+/).filter(Boolean);
      return mini.search(q).slice(0, limit).map((result) => {
        const doc = byPath.get(result.id as DocPath)!;
        const fields = new Set(Object.values(result.match).flat());
        const base = { path: doc.path, title: doc.title, kind: doc.kind, score: result.score };
        if (fields.has('title')) return { ...base, matchedField: 'title' as const };
        if (fields.has('aliases')) {
          return { ...base, matchedField: 'alias' as const, alias: bestAlias(doc.aliases, result.terms) ?? doc.aliases[0]! };
        }
        return { ...base, matchedField: 'content' as const, snippet: buildSnippet(doc.text, words, result.terms) };
      });
    },
  };
}

function searchTag(docs: Iterable<SearchDocument>, rawTag: string, limit: number): SearchHit[] {
  const tag = rawTag.toLowerCase().replace(/\/+$/, '');
  if (tag === '') return [];
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    if (doc.tags.some((t) => t.toLowerCase() === tag || t.toLowerCase().startsWith(`${tag}/`))) {
      hits.push({ path: doc.path, title: doc.title, kind: doc.kind, matchedField: 'tag', score: 1 });
    }
  }
  return hits.sort((a, b) => a.title.localeCompare(b.title, 'nb')).slice(0, limit);
}

function bestAlias(aliases: readonly string[], terms: readonly string[]): string | null {
  return aliases.find((alias) => alias.split(/[\s\-–]+/).some((word) => foldDiacritics(word).some((w) => terms.some((t) => w.startsWith(t))))) ?? null;
}

function buildSnippet(text: string, words: readonly string[], terms: readonly string[]): SearchHit['snippet'] {
  const lower = text.toLowerCase();
  const needles = [...words, ...terms].map((w) => w.toLowerCase()).filter((w) => w.length > 0);
  const positions = needles.map((n) => lower.indexOf(n)).filter((p) => p >= 0);
  const at = positions.length > 0 ? Math.min(...positions) : 0;
  const start = Math.max(0, Math.min(at - 50, text.length - SNIPPET_LENGTH));
  const end = Math.min(text.length, start + SNIPPET_LENGTH);
  const prefix = start > 0 ? '…' : '';
  const body = text.slice(start, end).replace(/\s+/g, ' ');
  const snippetText = `${prefix}${body}${end < text.length ? '…' : ''}`;
  const snippetLower = snippetText.toLowerCase();
  const highlights: [number, number][] = [];
  for (const needle of needles) {
    for (let i = snippetLower.indexOf(needle); i >= 0; i = snippetLower.indexOf(needle, i + needle.length)) {
      highlights.push([i, i + needle.length]);
    }
  }
  return { text: snippetText, highlights: mergeRanges(highlights) };
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else out.push([range[0], range[1]]);
  }
  return out;
}

/** Antall dokumenter per bit når indeksen bygges i bakgrunnen. */
export const SEARCH_BUILD_CHUNK = 25;

/**
 * Bygger søkeindeksen i biter og kaller `between()` mellom bitene, slik at bygging av indeksen over
 * ~2000 notater (flere hundre ms) ikke blokkerer forespørsler (BUG-008). Samme resultat som
 * `createSearchIndex`.
 */
export async function buildSearchIndex(docs: Iterable<SearchDocument>, between: () => Promise<void>): Promise<SearchIndex> {
  const index = createSearchIndex([]);
  let n = 0;
  for (const doc of docs) {
    index.add(doc);
    if (++n % SEARCH_BUILD_CHUNK === 0) await between();
  }
  return index;
}
