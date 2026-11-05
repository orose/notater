/**
 * Blokk-nivå Obsidian-syntaks: blokk-id-er (`^id`), `$$`-LaTeX-blokker, egendefinerte
 * oppgavestatuser (`[/]`, `[-]`) og «enkelt linjeskift = <br>» (PO-14).
 */
import type { Nodes, Paragraph, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast';
import { visit, SKIP } from 'unist-util-visit';

const TRAILING_BLOCK_ID = /(^|\s)\^([A-Za-z0-9-]+)\s*$/;
const STANDALONE_BLOCK_ID = /^\^([A-Za-z0-9-]+)$/;
const CUSTOM_TASK = /^\[([^\s\]])\]\s+/;

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

export function transformBlockIds(tree: Root): void {
  visit(tree, 'paragraph', (node, index, parent) => {
    if (index === undefined || !parent) return undefined;
    const last = node.children[node.children.length - 1];
    if (last?.type !== 'text') return undefined;

    if (node.children.length === 1) {
      const standalone = STANDALONE_BLOCK_ID.exec(last.value.trim());
      const previous = index > 0 ? parent.children[index - 1] : undefined;
      if (standalone && previous) {
        setBlockId(previous as RootContent, standalone[1]!);
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
    }

    const match = TRAILING_BLOCK_ID.exec(last.value);
    if (!match) return undefined;
    last.value = last.value.slice(0, match.index).replace(/\s+$/, '');
    if (last.value === '') node.children.pop();
    trimTrailingBreaks(node);
    const target = parent.type === 'listItem' && parent.children[0] === node ? parent : node;
    setBlockId(target as RootContent, match[2]!);
    return undefined;
  });
}

export function transformTaskStatuses(tree: Root): void {
  visit(tree, 'listItem', (item) => {
    if (item.checked !== null && item.checked !== undefined) return;
    const first = item.children[0];
    if (first?.type !== 'paragraph') return;
    const text = first.children[0];
    if (text?.type !== 'text') return;
    const match = CUSTOM_TASK.exec(text.value);
    if (!match) return;
    text.value = text.value.slice(match[0].length);
    item.checked = true;
    item.data = { ...item.data, vrTaskStatus: match[1]! };
  });
}

/** Obsidian-standard «strict line breaks = av»: et enkelt linjeskift i tekst blir `<br>`. */
export function transformSoftBreaks(tree: Root): void {
  visit(tree, (node) => {
    if (!('children' in node)) return;
    const parent = node as Parent;
    if (!parent.children.some((c) => c.type === 'text' && c.value.includes('\n'))) return;
    const next: RootContent[] = [];
    for (const child of parent.children) {
      if (child.type !== 'text' || !child.value.includes('\n')) {
        next.push(child);
        continue;
      }
      const lines = child.value.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) next.push({ type: 'break' });
        if (line !== '') next.push({ type: 'text', value: line } satisfies Text);
      });
    }
    parent.children = next as PhrasingContent[];
  });
}

function setBlockId(node: Nodes, id: string): void {
  node.data = { ...node.data, vrBlockId: id };
}

function trimTrailingBreaks(paragraph: Paragraph): void {
  while (paragraph.children[paragraph.children.length - 1]?.type === 'break') paragraph.children.pop();
}
