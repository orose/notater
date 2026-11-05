import type { Nodes, Root } from 'mdast';
import {
  collectHeadings,
  parseFrontmatter,
  parseMarkdownUrl,
  parseObsidianMarkdown,
  parseWikiLinkInner,
  splitFrontmatter,
  toInlineText,
  toPlainText,
} from '../markdown-syntax';
import type { FrontmatterData } from '../markdown-syntax';
import type { NoteMeta, OutgoingLink } from './note-meta';

const SNIPPET_MAX = 160;
const SNIPPET_CONTAINERS = new Set(['paragraph', 'heading', 'tableCell']);
const PROPERTY_LINK = /\[\[([^[\]\n]+)\]\]/g;

/** Full fil-tekst (inkl. frontmatter) → metadata. Ren funksjon; kaster aldri på ugyldig input. */
export function extractNoteMeta(source: string): NoteMeta {
  const { yaml, body } = splitFrontmatter(source);
  const fm = yaml === null ? { data: null, error: null } : parseFrontmatter(yaml);
  const tree = parseObsidianMarkdown(body, { profile: 'index' });
  const headings = collectHeadings(tree);
  const bodyScan = scanBody(tree);
  return {
    frontmatter: fm.data,
    frontmatterError: fm.error,
    aliases: readStringList(fm.data, ['aliases', 'alias']),
    tags: uniqueCaseInsensitive([...readTags(fm.data), ...bodyScan.tags]),
    headings,
    blockIds: bodyScan.blockIds,
    links: [...propertyLinks(fm.data), ...bodyScan.links],
    text: toPlainText(tree),
  };
}

interface BodyScan {
  readonly links: OutgoingLink[];
  readonly tags: string[];
  readonly blockIds: string[];
}

function scanBody(tree: Root): BodyScan {
  const links: OutgoingLink[] = [];
  const tags: string[] = [];
  const blockIds: string[] = [];
  const containerText = new Map<Nodes, string>();
  const snippetFor = (ancestors: Nodes[], needle: string): string => {
    let container: Nodes | undefined;
    for (let i = ancestors.length - 1; i >= 0 && !container; i -= 1) {
      if (SNIPPET_CONTAINERS.has(ancestors[i]!.type)) container = ancestors[i];
    }
    if (!container) return needle;
    let text = containerText.get(container);
    if (text === undefined) {
      text = toInlineText(container);
      containerText.set(container, text);
    }
    return excerpt(text, needle);
  };

  walkWithAncestors(tree, [], (node, parents) => {
    if (node.data?.vrBlockId) blockIds.push(node.data.vrBlockId);
    switch (node.type) {
      case 'wikiLink':
        links.push({
          kind: node.embed ? 'embed' : 'wikilink',
          target: node.target,
          anchor: node.anchor,
          snippet: snippetFor(parents, node.alias ?? node.target),
        });
        break;
      case 'obsidianTag':
        tags.push(node.value);
        break;
      case 'link':
      case 'image': {
        const parsed = parseMarkdownUrl(node.url);
        if (parsed) {
          const display = node.type === 'image' ? (node.alt ?? '') : toInlineText(node);
          links.push({
            kind: node.type === 'image' ? 'markdown-embed' : 'markdown',
            ...parsed,
            snippet: snippetFor(parents, display),
          });
        }
        break;
      }
      default:
        break;
    }
  });
  return { links, tags, blockIds };
}

/** Dybde-først med én delt, muterbar forfedrestakk (ingen allokering per node). */
function walkWithAncestors(node: Nodes, ancestors: Nodes[], visitor: (node: Nodes, ancestors: Nodes[]) => void): void {
  visitor(node, ancestors);
  if (!('children' in node)) return;
  ancestors.push(node);
  for (const child of node.children as Nodes[]) walkWithAncestors(child, ancestors, visitor);
  ancestors.pop();
}

function propertyLinks(data: FrontmatterData | null): OutgoingLink[] {
  if (!data) return [];
  const links: OutgoingLink[] = [];
  const walk = (key: string, value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(PROPERTY_LINK)) {
        const parts = parseWikiLinkInner(match[1]!);
        if (parts.target === '') continue;
        links.push({ kind: 'property', target: parts.target, anchor: parts.anchor, snippet: `${key}: ${match[0]}` });
      }
    } else if (Array.isArray(value)) {
      value.forEach((v) => walk(key, v));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => walk(`${key}.${k}`, v));
    }
  };
  Object.entries(data).forEach(([key, value]) => walk(key, value));
  return links;
}

function readStringList(data: FrontmatterData | null, keys: readonly string[]): string[] {
  if (!data) return [];
  const out: string[] = [];
  for (const key of keys) {
    const value = data[key];
    const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
    for (const item of items) {
      if (typeof item === 'string' || typeof item === 'number') {
        const text = String(item).trim();
        if (text !== '') out.push(text);
      }
    }
  }
  return out;
}

function readTags(data: FrontmatterData | null): string[] {
  if (!data) return [];
  const raw = [data.tags, data.tag].flatMap((v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]));
  return raw
    .flatMap((v) => (typeof v === 'string' ? v.split(/[,\s]+/) : typeof v === 'number' ? [String(v)] : []))
    .map((t) => t.trim().replace(/^#/, ''))
    .filter((t) => t !== '');
}

function uniqueCaseInsensitive(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function excerpt(text: string, needle: string): string {
  if (text.length <= SNIPPET_MAX) return text;
  const at = Math.max(0, text.indexOf(needle));
  const start = Math.max(0, Math.min(at - Math.floor((SNIPPET_MAX - needle.length) / 2), text.length - SNIPPET_MAX));
  const slice = text.slice(start, start + SNIPPET_MAX).trim();
  return `${start > 0 ? '…' : ''}${slice}${start + SNIPPET_MAX < text.length ? '…' : ''}`;
}
