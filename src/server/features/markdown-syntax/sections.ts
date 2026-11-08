import GithubSlugger from 'github-slugger';
import type { List, ListItem, Nodes, Parent, Root, RootContent } from 'mdast';
import { visit, EXIT } from 'unist-util-visit';
import { toInlineText } from './plain-text';

export interface HeadingInfo {
  readonly depth: number;
  /** Ren tekst. */
  readonly text: string;
  /** Unik slug i dokumentet (github-slugger), brukes som `id` i HTML. */
  readonly id: string;
}

/** Overskrifter i dokumentrekkefølge. Setter `data.vrHeadingId` på hver overskriftsnode. */
export function collectHeadings(tree: Root): HeadingInfo[] {
  const slugger = new GithubSlugger();
  const headings: HeadingInfo[] = [];
  visit(tree, 'heading', (node) => {
    const text = toInlineText(node);
    const id = slugger.slug(text);
    node.data = { ...node.data, vrHeadingId: id };
    headings.push({ depth: node.depth, text, id });
  });
  return headings;
}

/**
 * Seksjonen som starter med overskriften `headingId` (krever `collectHeadings` først):
 * overskriften + alt til neste overskrift på samme eller høyere nivå. Kun toppnivå-overskrifter.
 */
export function extractHeadingSection(tree: Root, headingId: string): Root | null {
  const start = tree.children.findIndex((n) => n.type === 'heading' && n.data?.vrHeadingId === headingId);
  if (start === -1) return null;
  const heading = tree.children[start]!;
  const depth = heading.type === 'heading' ? heading.depth : 6;
  let end = start + 1;
  while (end < tree.children.length) {
    const node = tree.children[end]!;
    if (node.type === 'heading' && node.depth <= depth) break;
    end += 1;
  }
  return { type: 'root', children: tree.children.slice(start, end) };
}

/** Blokken med blokk-id `blockId` (case-insensitivt). Listepunkter pakkes i en egen liste. */
export function extractBlock(tree: Root, blockId: string): Root | null {
  const wanted = blockId.toLowerCase();
  let found: { node: Nodes; parent: Parent | undefined } | null = null;
  visit(tree, (node, _index, parent) => {
    if (node.data?.vrBlockId?.toLowerCase() === wanted) {
      found = { node, parent };
      return EXIT;
    }
    return undefined;
  });
  if (!found) return null;
  const { node, parent } = found as { node: Nodes; parent: Parent | undefined };
  if (node.type === 'listItem') {
    const list = parent as List | undefined;
    const wrapper: List = { type: 'list', ordered: list?.ordered ?? false, spread: false, children: [node as ListItem] };
    return { type: 'root', children: [wrapper] };
  }
  return { type: 'root', children: [node as RootContent] };
}
