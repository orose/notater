import type { TagCount } from '../../../shared/api-types';
import type { IndexedNote } from '../vault-index';

const collator = new Intl.Collator('nb', { sensitivity: 'base', numeric: true });

/**
 * Antall notater per tagg (PO-24). Tagger er case-insensitive (PO-10); visningsnavnet er den første
 * skrivemåten som ble sett. Nestede tagger telles for seg (`task/backend` gir ikke `task`).
 */
export function buildTagCounts(notes: Iterable<IndexedNote>): TagCount[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const note of notes) {
    if (note.file.kind !== 'note') continue;
    for (const tag of note.meta.tags) {
      const key = tag.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || collator.compare(a.tag, b.tag));
}
