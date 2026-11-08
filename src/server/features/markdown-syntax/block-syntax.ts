/** `$$ … $$`-avsnitt → «ikke støttet»-node (LaTeX). Bruker kildeteksten, så escapes bevares. */
import type { Root } from 'mdast';
import { visit, SKIP } from 'unist-util-visit';

export function transformLatexBlocks(tree: Root, source: string): void {
  visit(tree, 'paragraph', (node, index, parent) => {
    if (index === undefined || !parent) return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    const raw = source.slice(start, end).trim();
    if (raw.length > 4 && raw.startsWith('$$') && raw.endsWith('$$')) {
      parent.children.splice(index, 1, { type: 'unsupported', kind: 'latex', value: raw, inline: false } as never);
      return [SKIP, index];
    }
    return undefined;
  });
}
