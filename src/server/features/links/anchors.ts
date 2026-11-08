import { lastAnchorSegment } from '../markdown-syntax';
import type { NoteMeta } from '../vault-index';

export interface AnchorResolution {
  /** Overskrift-id (slug) eller `^blokkid`; `null` uten anker eller når ankeret ikke finnes. */
  readonly id: string | null;
  /** true når et anker var oppgitt, men ikke finnes (lenken virker likevel, README-QA regel 7). */
  readonly missing: boolean;
}

const normalize = (text: string): string => text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/** `#Overskrift` (case-insensitivt mot tekst eller slug, `#A#B` → siste ledd) eller `#^blokk`. */
export function resolveAnchor(meta: Pick<NoteMeta, 'headings' | 'blockIds'>, anchor: string | null): AnchorResolution {
  if (anchor === null || anchor.trim() === '') return { id: null, missing: false };
  const segment = lastAnchorSegment(anchor);
  if (segment.startsWith('^')) {
    const wanted = segment.slice(1).toLowerCase();
    const found = meta.blockIds.find((id) => id.toLowerCase() === wanted);
    return found ? { id: `^${found}`, missing: false } : { id: null, missing: true };
  }
  const wanted = normalize(segment);
  const heading = meta.headings.find((h) => normalize(h.text) === wanted) ?? meta.headings.find((h) => h.id === wanted);
  return heading ? { id: heading.id, missing: false } : { id: null, missing: true };
}
