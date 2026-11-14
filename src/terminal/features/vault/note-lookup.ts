// Notatoppslag for `npm run present -- <notat>` og notatlisten (ADR-011 §7, AR-3-26). Ren TS.
//
// Rekkefølge, case-insensitivt og NFC-normalisert: 1. eksakt sti (med og uten `.md`) → 2. eksakt tittel eller alias →
// 3. Obsidian-oppløsning (injisert) → 4. fuzzy over tittel, aliaser og sti. Fuzzy åpner bare et klart beste treff
// (minst 1,5 × poengsummen til nummer to); ellers notatlisten med søket utfylt.

import { fuzzyMatch, prepareSearchTarget, type SearchTarget } from '../../../core/commands';

export interface NoteCandidate {
  readonly docPath: string;
  readonly filePath: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly mtimeMs: number;
}

export type NoteLookup =
  | { readonly kind: 'note'; readonly docPath: string }
  | { readonly kind: 'list'; readonly query: string }
  | { readonly kind: 'none'; readonly query: string };

export interface RankedNote {
  readonly note: NoteCandidate;
  readonly score: number;
  /** Treffområder i tittelen (utheving i listen). */
  readonly titleRanges: ReadonlyArray<readonly [number, number]>;
  /** Treffområder i stien (når treffet var i stien). */
  readonly pathRanges: ReadonlyArray<readonly [number, number]>;
}

/** Klart beste fuzzy-treff: minst så mange ganger poengsummen til nummer to. */
export const CLEAR_WINNER = 1.5;

const key = (text: string) => text.normalize('NFC').toLowerCase().trim();
const withoutMd = (text: string) => text.replace(/\.md$/i, '');

export function lookupNote(notes: readonly NoteCandidate[], query: string, resolveObsidian: (query: string) => string | null): NoteLookup {
  const q = key(query);
  const path = withoutMd(q);
  const byPath = notes.find((n) => key(n.docPath) === path || key(withoutMd(n.filePath)) === path);
  if (byPath) return { kind: 'note', docPath: byPath.docPath };
  const byTitle = notes.filter((n) => key(n.title) === q);
  const byName = byTitle.length > 0 ? byTitle : notes.filter((n) => n.aliases.some((a) => key(a) === q));
  // Flere notater med samme navn (i hver sin mappe): notatlisten med søket utfylt, så man velger selv.
  if (byName.length > 1) return { kind: 'list', query };
  if (byName[0]) return { kind: 'note', docPath: byName[0].docPath };
  const resolved = resolveObsidian(query.normalize('NFC').trim());
  if (resolved !== null && notes.some((n) => n.docPath === resolved)) return { kind: 'note', docPath: resolved };
  const ranked = rankNotes(notes, query);
  const [first, second] = ranked;
  if (!first) return { kind: 'none', query };
  if (!second || first.score >= second.score * CLEAR_WINNER) return { kind: 'note', docPath: first.note.docPath };
  return { kind: 'list', query };
}

interface PreparedNote {
  readonly title: SearchTarget;
  readonly aliases: readonly SearchTarget[];
  readonly path: SearchTarget;
}

const preparedNotes = new WeakMap<NoteCandidate, PreparedNote>();

function prepared(note: NoteCandidate): PreparedNote {
  let hit = preparedNotes.get(note);
  if (!hit) {
    hit = { title: prepareSearchTarget(note.title), aliases: note.aliases.map(prepareSearchTarget), path: prepareSearchTarget(note.docPath) };
    preparedNotes.set(note, hit);
  }
  return hit;
}

/** Notatlisten: tom spørring = nyeste først; ellers fuzzy-rangert (beste først, deretter nyeste). */
export function rankNotes(notes: readonly NoteCandidate[], query: string): RankedNote[] {
  if (query.trim() === '') {
    return [...notes].sort((a, b) => b.mtimeMs - a.mtimeMs || a.title.localeCompare(b.title, 'nb')).map((note) => ({ note, score: 0, titleRanges: [], pathRanges: [] }));
  }
  const out: RankedNote[] = [];
  const q = prepareSearchTarget(query.trim());
  // Stien er tittelen med mapper foran: den søkes bare når spørringen har en mappe eller navnet ikke traff.
  const withFolder = query.includes('/');
  for (const note of notes) {
    const p = prepared(note);
    const title = fuzzyMatch(q, p.title);
    let score = title?.score ?? 0;
    for (const alias of p.aliases) score = Math.max(score, (fuzzyMatch(q, alias)?.score ?? 0) - 1);
    const path = withFolder || score === 0 ? fuzzyMatch(q, p.path) : null;
    const pathScore = (path?.score ?? 0) - 2;
    const viaPath = pathScore > score;
    score = Math.max(score, pathScore);
    if (score <= 0) continue;
    out.push({ note, score, titleRanges: title?.ranges ?? [], pathRanges: viaPath ? (path?.ranges ?? []) : [] });
  }
  return out.sort((a, b) => b.score - a.score || b.note.mtimeMs - a.note.mtimeMs);
}
