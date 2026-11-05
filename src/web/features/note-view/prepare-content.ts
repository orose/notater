import type { Element, ElementContent, Root, RootContent } from 'hast';

// Klientside-tilpasninger av server-HAST før rendering. Ren og ikke-muterende
// (dokumentet ligger i TanStack Query-cachen og kan rendres flere ganger).

function isElement(node: RootContent | ElementContent | undefined): node is Element {
  return node?.type === 'element';
}

function isBlankText(node: RootContent | ElementContent): boolean {
  return node.type === 'text' && node.value.trim() === '';
}

function classList(node: Element): string[] {
  const value: unknown = node.properties.className;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/);
  return [];
}

function cloneElement(node: Element, patch: Partial<Element> = {}): Element {
  return { ...node, properties: { ...node.properties }, ...patch };
}

function hashTarget(href: unknown): string | null {
  return typeof href === 'string' && href.startsWith('#') ? href.slice(1) : null;
}

interface Footnote {
  readonly number: string;
  readonly content: ElementContent[];
}

function collectFootnotes(tree: Root): { map: Map<string, Footnote>; section: Element | null } {
  const map = new Map<string, Footnote>();
  let section: Element | null = null;
  for (const node of tree.children) {
    if (isElement(node) && node.tagName === 'section' && node.properties.dataFootnotes !== undefined) {
      section = node;
      const ol = node.children.find((c): c is Element => isElement(c) && c.tagName === 'ol');
      ol?.children.forEach((li) => {
        if (!isElement(li) || li.tagName !== 'li') return;
        const id = String(li.properties.id ?? '');
        map.set(id, { number: String(map.size + 1), content: stripBackrefs(li.children) });
      });
    }
  }
  return { map, section };
}

function stripBackrefs(nodes: ElementContent[]): ElementContent[] {
  const out: ElementContent[] = [];
  for (const node of nodes) {
    if (!isElement(node)) {
      out.push(node);
      continue;
    }
    if (node.tagName === 'a' && node.properties.dataFootnoteBackref !== undefined) continue;
    out.push(cloneElement(node, { children: stripBackrefs(node.children) }));
  }
  // Avsnitt flates ut til inline-innhold (sidenoten er en <span> inne i et avsnitt).
  return out.flatMap((node) => (isElement(node) && node.tagName === 'p' ? node.children : [node]));
}

function withSidenotes(nodes: ElementContent[], footnotes: Map<string, Footnote>): ElementContent[] {
  const out: ElementContent[] = [];
  for (const node of nodes) {
    if (!isElement(node)) {
      out.push(node);
      continue;
    }
    const ref =
      node.tagName === 'sup'
        ? node.children.find((c): c is Element => isElement(c) && c.properties.dataFootnoteRef !== undefined)
        : undefined;
    const target = ref ? hashTarget(ref.properties.href) : null;
    const note = target ? footnotes.get(target) : undefined;
    if (ref && note) {
      out.push(cloneElement(node, { properties: { ...node.properties, className: ['sn-ref-sup'] } }));
      out.push({
        type: 'element',
        tagName: 'vr-sidenote',
        properties: { dataNumber: note.number },
        children: note.content,
      });
      continue;
    }
    out.push(cloneElement(node, { children: withSidenotes(node.children, footnotes) }));
  }
  return out;
}

export function prepareContent(tree: Root): Root {
  const { map, section } = collectFootnotes(tree);

  let children: RootContent[] = tree.children.map((node) => {
    if (node === section && isElement(node)) {
      const ol = node.children.find((c): c is Element => isElement(c) && c.tagName === 'ol');
      return { type: 'element', tagName: 'vr-footnotes', properties: {}, children: ol ? [ol] : [] };
    }
    if (map.size > 0 && isElement(node)) {
      return cloneElement(node, { children: withSidenotes(node.children, map) });
    }
    return node;
  });

  const first = children.findIndex((node) => !isBlankText(node));
  const firstNode = children[first];
  if (isElement(firstNode) && firstNode.tagName === 'p') {
    children = children.slice();
    children[first] = cloneElement(firstNode, {
      properties: { ...firstNode.properties, className: [...classList(firstNode), 'lede'] },
    });
  }

  return { ...tree, children };
}

/** Ren tekst for en node (uten data-attributter). */
export function textContent(node: Root | RootContent | ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'root' || node.type === 'element') return node.children.map(textContent).join(' ');
  return '';
}

/** Lesetid (PO-23): ord / 220, rundet opp, minst 1 minutt. */
export function readingMinutes(tree: Root): number {
  const words = textContent(tree)
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.ceil(words / 220));
}
