import type { Root as HastRoot } from 'hast';
import type { Code, Nodes, Root as MdastRoot } from 'mdast';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkRehype from 'remark-rehype';
import type { Options as RemarkRehypeOptions } from 'remark-rehype';
import { unified } from 'unified';
import type { TocEntry } from '../../../shared/api-types';
import { collectHeadings, extractBlock, extractHeadingSection, parseObsidianMarkdown } from '../markdown-syntax';
import type { Highlight, ObsidianTag, UnsupportedNode, WikiLink } from '../markdown-syntax';
import { h } from './hast-builders';
import { createPlaceholderTable } from './placeholders';
import type { PlaceholderTable } from './placeholders';
import type { RenderContext } from './render-context';
import { createSanitizeSchema } from './sanitize-schema';
import { applyTrustedTransforms } from './trusted-transforms';

export type SectionSelector = { readonly type: 'heading'; readonly id: string } | { readonly type: 'block'; readonly id: string };

export interface RenderOptions {
  /** Render kun én seksjon (embed `![[x#Overskrift]]` / `![[x#^blokk]]`). */
  readonly section?: SectionSelector | null;
  /** Innebygd innhold: ingen overskrift-id-er (unngår duplikate id-er på siden). */
  readonly embedded?: boolean;
}

export interface RenderResult {
  readonly content: HastRoot;
  readonly toc: TocEntry[];
}

type Handlers = NonNullable<RemarkRehypeOptions['handlers']>;
type HandlerState = Parameters<NonNullable<Handlers['code']>>[0];

const SANITIZE_SCHEMA = createSanitizeSchema();
const EMPTY_SECTION: MdastRoot = { type: 'root', children: [] };

/**
 * Pipeline (ADR-002): Obsidian-markdown → mdast → hast (med plassholdere) → rehype-raw →
 * rehype-sanitize (SIKKERHETSGRENSE) → pålitelige transformasjoner. Synkron; embeds rendres
 * rekursivt via `ctx.renderEmbed`.
 *
 * `body` er brødteksten UTEN frontmatter.
 */
export function renderMarkdown(body: string, ctx: RenderContext, options: RenderOptions = {}): RenderResult {
  const full = parseObsidianMarkdown(body);
  const headings = collectHeadings(full);
  const tree = selectSection(full, options.section ?? null);
  prepareHastProperties(tree, options.embedded === true);

  const placeholders = createPlaceholderTable();
  const processor = unified()
    .use(remarkRehype, {
      allowDangerousHtml: true,
      handlers: createHandlers(placeholders),
      footnoteLabel: 'Fotnoter',
      footnoteBackLabel: (referenceIndex: number) => `Tilbake til fotnotehenvisning ${referenceIndex + 1}`,
    })
    .use(containsRawHtml(tree) ? [rehypeRaw] : [])
    .use(rehypeSanitize, SANITIZE_SCHEMA);
  const content = processor.runSync(tree) as HastRoot;
  applyTrustedTransforms(content, ctx, placeholders);

  return {
    content,
    toc: options.section || options.embedded ? [] : headings.map((x) => ({ depth: x.depth, text: x.text, id: x.id })),
  };
}

function selectSection(tree: MdastRoot, section: SectionSelector | null): MdastRoot {
  if (!section) return tree;
  const selected = section.type === 'heading' ? extractHeadingSection(tree, section.id) : extractBlock(tree, section.id);
  return selected ?? EMPTY_SECTION;
}

/** Overfører id-er og oppgavestatus til `hProperties` (valideres og omdøpes etter sanering). */
function prepareHastProperties(tree: Nodes, embedded: boolean): void {
  const walk = (node: Nodes): void => {
    const data = node.data;
    if (data) {
      const hProperties: Record<string, string> = {};
      if (!embedded && node.type === 'heading' && data.vrHeadingId) hProperties.dataVrHeadingId = data.vrHeadingId;
      if (!embedded && data.vrBlockId) hProperties.dataVrBlockId = data.vrBlockId;
      if (data.vrTaskStatus) hProperties.dataTask = data.vrTaskStatus;
      if (Object.keys(hProperties).length > 0) node.data = { ...data, hProperties: { ...data.hProperties, ...hProperties } };
    }
    if ('children' in node) (node.children as Nodes[]).forEach(walk);
  };
  walk(tree);
}

function containsRawHtml(node: Nodes): boolean {
  if (node.type === 'html') return true;
  return 'children' in node && (node.children as Nodes[]).some(containsRawHtml);
}

function createHandlers(placeholders: PlaceholderTable): Handlers {
  return {
    wikiLink: (_state: HandlerState, node: WikiLink) => placeholders.create({ kind: 'wikiLink', node }, false),
    obsidianTag: (_state: HandlerState, node: ObsidianTag) => placeholders.create({ kind: 'tag', value: node.value }, false),
    unsupported: (_state: HandlerState, node: UnsupportedNode) => placeholders.create({ kind: 'unsupported', node }, !node.inline),
    highlight: (state: HandlerState, node: Highlight) => h('mark', {}, state.all(node)),
    code: (_state: HandlerState, node: Code) =>
      placeholders.create({ kind: 'code', lang: node.lang ?? '', meta: node.meta ?? '', value: node.value }, true),
  };
}
