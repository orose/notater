// Disposisjonen (ADR-009): overskrifter, §-nummer og seksjoner beregnet fra HAST i klienten, før rendering.
// Ren og ikke-muterende (dokumentet ligger i query-cachen). Diskré embedding (F2) kommer i slice 1.1-d.

import type { Element, ElementContent, Root, RootContent } from 'hast';
import type { TocEntry } from '../../../shared/api-types';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface OutlineHeading {
  readonly id: string;
  /** Effektivt nivå. */
  readonly level: HeadingLevel;
  readonly text: string;
  readonly origin: 'note' | 'embed';
  /** På toppnivå i flyten (kan foldes og nummereres). */
  readonly foldable: boolean;
  /** §-nummer for nummererte nivå-2-overskrifter, ellers null. */
  readonly sec: number | null;
}

export interface SectionStats {
  readonly words: number;
  /** Kode, diagram, tabell, bilde og base. */
  readonly figures: number;
}

export interface Outline {
  /** HAST med `data-vr-sec` på nummererte overskrifter. */
  readonly content: Root;
  readonly headings: readonly OutlineHeading[];
  readonly toc: readonly TocEntry[];
  /** Toppnivåblokkene (`content.children`-indekser) som seksjonen til overskriften dekker: `[start, end)`. */
  readonly sectionRange: (headingId: string) => readonly [number, number] | null;
  /**
   * Overskriftene som må foldes ut for at elementet med `id` skal vises (alle seksjoner som inneholder det).
   * Er `id` selv en overskrift, er den med (navigasjon til en overskrift viser innholdet dens).
   */
  readonly sectionOf: (id: string) => readonly string[];
  readonly stats: (headingId: string) => SectionStats;
}

const HEADING = /^h([1-6])$/;
const FIGURES = new Set(['vr-code', 'vr-mermaid', 'table', 'img', 'vr-base', 'figure']);

function isElement(node: RootContent | ElementContent | undefined): node is Element {
  return node?.type === 'element';
}

function headingLevel(node: RootContent): HeadingLevel | null {
  if (!isElement(node)) return null;
  const m = HEADING.exec(node.tagName);
  return m ? (Number(m[1]) as HeadingLevel) : null;
}

/** Fotnotelisten er aldri del av en seksjon. */
function isFootnotes(node: RootContent): boolean {
  return isElement(node) && (node.tagName === 'vr-footnotes' || (node.tagName === 'section' && node.properties.dataFootnotes !== undefined));
}

function inlineText(node: ElementContent | RootContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(inlineText).join('');
  return '';
}

function collectIds(node: RootContent | ElementContent, into: (id: string) => void): void {
  if (!isElement(node)) return;
  const id = node.properties.id;
  if (typeof id === 'string' && id !== '') into(id);
  for (const child of node.children) collectIds(child, into);
}

function count(node: RootContent | ElementContent, stats: { words: number; figures: number }): void {
  if (node.type === 'text') {
    stats.words += node.value.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    return;
  }
  if (!isElement(node)) return;
  if (FIGURES.has(node.tagName)) stats.figures += 1;
  // Kode og diagram teller som figur, ikke som ord.
  if (node.tagName === 'vr-code' || node.tagName === 'vr-mermaid') return;
  for (const child of node.children) count(child, stats);
}

export function buildOutline(content: Root, toc: readonly TocEntry[]): Outline {
  const tocText = new Map(toc.map((t) => [t.id, t.text]));
  const blocks = content.children;
  const headingAt = new Map<number, { id: string; level: HeadingLevel }>();
  const blockOfId = new Map<string, number>();
  let footnotesAt = blocks.length;

  blocks.forEach((node, index) => {
    collectIds(node, (id) => blockOfId.set(id, index));
    if (isFootnotes(node) && footnotesAt === blocks.length) footnotesAt = index;
    const level = headingLevel(node);
    const id = isElement(node) ? node.properties.id : undefined;
    if (level !== null && typeof id === 'string' && id !== '' && index < footnotesAt) headingAt.set(index, { id, level });
  });

  // Seksjonsgrenser: til neste overskrift med nivå ≤ L, fotnotelisten eller slutten.
  const ranges = new Map<string, readonly [number, number]>();
  const order = [...headingAt.entries()].sort((a, b) => a[0] - b[0]);
  order.forEach(([index, h], i) => {
    let end = footnotesAt;
    for (const [next, other] of order.slice(i + 1)) {
      if (other.level <= h.level) {
        end = next;
        break;
      }
    }
    ranges.set(h.id, [index + 1, end]);
  });

  // §-nummer på toppnivå-H2 (AR-1.1-19). Ny rot, urørte noder beholder identitet.
  let sec = 0;
  const headings: OutlineHeading[] = [];
  const children = blocks.map((node, index) => {
    const h = headingAt.get(index);
    if (!h || !isElement(node)) return node;
    const number = h.level === 2 ? ++sec : null;
    headings.push({ id: h.id, level: h.level, text: tocText.get(h.id) ?? inlineText(node).trim(), origin: 'note', foldable: true, sec: number });
    if (number === null) return node;
    return { ...node, properties: { ...node.properties, dataVrSec: String(number), dataVrSecPad: String(number).padStart(2, '0') } };
  });

  const statsCache = new Map<string, SectionStats>();
  return {
    content: { ...content, children },
    headings,
    toc,
    sectionRange: (id) => ranges.get(id) ?? null,
    sectionOf: (id) => {
      const block = blockOfId.get(id);
      if (block === undefined) return [];
      return headings
        .filter((h) => {
          const r = ranges.get(h.id);
          return h.id === id || (r !== undefined && block >= r[0] && block < r[1]);
        })
        .map((h) => h.id);
    },
    stats: (id) => {
      const cached = statsCache.get(id);
      if (cached) return cached;
      const r = ranges.get(id);
      const stats = { words: 0, figures: 0 };
      if (r) for (let i = r[0]; i < r[1]; i++) count(blocks[i] as RootContent, stats);
      statsCache.set(id, stats);
      return stats;
    },
  };
}

/** Toppnivåblokkene som er skjult når overskriftene i `folded` er foldet (union av seksjonene). */
export function hiddenBlocks(outline: Outline, folded: ReadonlySet<string>): ReadonlySet<number> {
  const hidden = new Set<number>();
  for (const id of folded) {
    const r = outline.sectionRange(id);
    if (!r) continue;
    for (let i = r[0]; i < r[1]; i++) hidden.add(i);
  }
  return hidden;
}
