import type { TocEntry } from '../../../shared/api-types';

/** PO-15 / QA-TOC-01: TOC vises fra og med 3 overskrifter. */
export const TOC_MIN_ENTRIES = 3;

/** Nivå 2–4 (QA-TOC-02). Tom liste hvis færre enn terskelen. */
export function visibleToc(entries: readonly TocEntry[]): TocEntry[] {
  const filtered = entries.filter((e) => e.depth >= 2 && e.depth <= 4);
  return filtered.length >= TOC_MIN_ENTRIES ? filtered : [];
}

export interface TocNode {
  readonly entry: TocEntry;
  readonly children: TocNode[];
}

export function tocTree(entries: readonly TocEntry[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];
  for (const entry of entries) {
    const node: TocNode = { entry, children: [] };
    while (stack.length > 0 && (stack[stack.length - 1] as TocNode).entry.depth >= entry.depth) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}
