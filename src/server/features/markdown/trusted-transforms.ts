/**
 * Pålitelige transformasjoner ETTER sanering (ADR-002 steg 4). Input er sanert HAST; output er
 * HAST etter kontrakten i api.md (lenker, id-er, callouts, `vr-*`-elementer).
 */
import type { Element, ElementContent, Properties, Root } from 'hast';
import { isExternalUrl, parseMarkdownUrl } from '../markdown-syntax';
import type { WikiLink } from '../markdown-syntax';
import { transformCallouts } from './callouts';
import { buildCodeBlock } from './code-blocks';
import { h, text, truncateSource } from './hast-builders';
import type { PlaceholderData, PlaceholderTable } from './placeholders';
import type { LinkTarget, RenderContext } from './render-context';

const HEADING_ID = /^[\p{L}\p{N}_-]+$/u;
const BLOCK_ID = /^[A-Za-z0-9-]+$/;
const SAFE_EXTERNAL = /^(https?:|mailto:)/i;
const CLOBBER = 'user-content-';
const BLOCK_EMBED_TAGS = new Set(['vr-embed', 'vr-base', 'vr-unsupported', 'vr-code', 'vr-mermaid']);

export function applyTrustedTransforms(tree: Root, ctx: RenderContext, placeholders: PlaceholderTable): void {
  rewriteElements(tree, ctx);
  transformCallouts(tree);
  expandPlaceholders(tree, ctx, placeholders);
  unwrapBlockParagraphs(tree);
}

/** id-er, oppgavestatus, fotnote-id-er, lenker og bilder fra markdown/HTML. */
function rewriteElements(parent: Root | Element, ctx: RenderContext): void {
  for (let i = 0; i < parent.children.length; i += 1) {
    const node = parent.children[i]!;
    if (node.type !== 'element') continue;
    applyIds(node);
    if (node.tagName === 'a') {
      const replacement = rewriteAnchor(node, ctx);
      parent.children[i] = replacement;
      if (replacement !== node) continue;
    } else if (node.tagName === 'img') {
      const replacement = rewriteImage(node, ctx);
      parent.children.splice(i, 1, ...replacement);
      i += replacement.length - 1;
      continue;
    }
    rewriteElements(node, ctx);
  }
}

function applyIds(node: Element): void {
  const props = node.properties;
  const headingId = props.dataVrHeadingId;
  delete props.dataVrHeadingId;
  if (typeof headingId === 'string' && HEADING_ID.test(headingId) && /^h[1-6]$/.test(node.tagName)) props.id = headingId;
  const blockId = props.dataVrBlockId;
  delete props.dataVrBlockId;
  if (typeof blockId === 'string' && BLOCK_ID.test(blockId)) props.id = `^${blockId}`;
  // remark-rehype og sanitizeren legger begge på «user-content-»; fjern dobbeltprefikset.
  if (typeof props.id === 'string' && props.id.startsWith(CLOBBER + CLOBBER)) props.id = props.id.slice(CLOBBER.length);
  if (Array.isArray(props.ariaDescribedBy)) {
    props.ariaDescribedBy = props.ariaDescribedBy.map((v) => String(v).replace(CLOBBER + CLOBBER, CLOBBER));
  }
}

function rewriteAnchor(a: Element, ctx: RenderContext): Element {
  const props = a.properties;
  if (props.dataFootnoteRef !== undefined || props.dataFootnoteBackref !== undefined) return a;
  const href = typeof props.href === 'string' ? props.href : null;
  if (href === null) return h('span', {}, a.children);
  if (SAFE_EXTERNAL.test(href)) {
    return h('a', { href, dataVrLink: 'external', rel: ['noopener', 'noreferrer'] }, a.children);
  }
  if (isExternalUrl(href)) return h('span', {}, a.children);
  const parsed = href.startsWith('#') ? { target: '', anchor: safeDecode(href.slice(1)) } : parseMarkdownUrl(href);
  if (!parsed) return h('span', {}, a.children);
  const target = ctx.resolveLink({ path: parsed.target, anchor: parsed.anchor, syntax: 'markdown' });
  return buildLink(target, ctx, a.children, href);
}

function rewriteImage(img: Element, ctx: RenderContext): ElementContent[] {
  const src = typeof img.properties.src === 'string' ? img.properties.src : null;
  const alt = typeof img.properties.alt === 'string' && img.properties.alt !== '' ? img.properties.alt : null;
  if (src !== null && /^https?:/i.test(src)) {
    // B10/PO-13: eksterne bilder lastes aldri automatisk – vises som lenke.
    return [h('a', { href: src, dataVrLink: 'external', dataVrExternalImage: 'true', rel: ['noopener', 'noreferrer'] }, [text(alt ?? src)])];
  }
  const parsed = src === null ? null : parseMarkdownUrl(src);
  if (!parsed) return [h('vr-embed', { dataStatus: 'missing', dataRaw: alt ?? src ?? '' })];
  return ctx.renderEmbed({
    path: parsed.target,
    anchor: parsed.anchor,
    alias: alt,
    syntax: 'markdown',
    raw: `![${alt ?? ''}](${src})`,
    width: toNumber(img.properties.width),
    height: toNumber(img.properties.height),
  });
}

/** Lenkeelement etter HAST-kontrakten (api.md «Lenker»). */
export function buildLink(target: LinkTarget, ctx: RenderContext, children: ElementContent[], raw: string): Element {
  if (target.status === 'unresolved') {
    const props: Properties = { dataVrLink: 'unresolved', dataVrRaw: raw };
    if (target.suggestion) {
      props.dataVrSuggest = target.suggestion.docPath;
      props.dataVrSuggestTitle = target.suggestion.title;
    }
    return h('a', props, children);
  }
  const props: Properties = {
    href: ctx.documentUrl(target.docPath, target.anchorId),
    dataVrLink: 'internal',
    dataVrTarget: target.docPath,
  };
  if (target.anchorId) props.dataVrAnchor = target.anchorId;
  if (target.anchorMissing) {
    props.dataVrAnchorMissing = 'true';
    // href går til toppen av målet (README-QA regel 7), men klienten får vite hvilket anker som manglet.
    if (target.missingAnchor) props.dataVrAnchor = target.missingAnchor;
  }
  if (target.alternatives.length > 0) {
    // PO-26: antall kandidater (inkl. valgt mål).
    props.dataVrAmbiguous = String(target.alternatives.length + 1);
    props.dataVrAlternatives = JSON.stringify(target.alternatives);
  }
  return h('a', props, children);
}

function expandPlaceholders(parent: Root | Element, ctx: RenderContext, placeholders: PlaceholderTable): void {
  for (let i = 0; i < parent.children.length; i += 1) {
    const node = parent.children[i]!;
    if (node.type !== 'element') continue;
    if (node.properties.dataVrRef !== undefined) {
      const data = placeholders.lookup(node.properties.dataVrRef);
      const replacement = data ? expand(data, ctx) : [];
      parent.children.splice(i, 1, ...replacement);
      i += replacement.length - 1;
      continue;
    }
    expandPlaceholders(node, ctx, placeholders);
  }
}

function expand(data: PlaceholderData, ctx: RenderContext): ElementContent[] {
  switch (data.kind) {
    case 'tag':
      return [h('a', { dataVrLink: 'tag', dataVrTag: data.value }, [text(`#${data.value}`)])];
    case 'unsupported':
      return [
        h('vr-unsupported', {
          dataKind: data.node.kind,
          dataSource: truncateSource(data.node.value),
          ...(data.node.inline ? { dataInline: 'true' } : {}),
        }),
      ];
    case 'code':
      return [buildCodeBlock(data.lang, data.meta, data.value, ctx)];
    case 'wikiLink':
      return expandWikiLink(data.node, ctx);
  }
}

function expandWikiLink(node: WikiLink, ctx: RenderContext): ElementContent[] {
  const inner = node.value.replace(/^!?\[\[/, '').replace(/\]\]$/, '');
  if (node.embed) {
    return ctx.renderEmbed({ path: node.target, anchor: node.anchor, alias: node.alias, syntax: 'wiki', raw: node.value });
  }
  const target = ctx.resolveLink({ path: node.target, anchor: node.anchor, syntax: 'wiki' });
  return [buildLink(target, ctx, [text(wikiLinkDisplay(node))], inner)];
}

/** Visningstekst: alias, ellers «mål › anker» (anker uten `#`/`^`-støy). */
export function wikiLinkDisplay(node: Pick<WikiLink, 'target' | 'anchor' | 'alias'>): string {
  if (node.alias) return node.alias;
  const anchor = node.anchor
    ?.split('#')
    .filter((p) => p.trim() !== '')
    .join(' › ');
  if (!node.target) return anchor ?? '';
  return anchor ? `${node.target} › ${anchor}` : node.target;
}

/** `<p>` som bare inneholder blokk-embeds (og mellomrom/`<br>`) pakkes ut. */
function unwrapBlockParagraphs(parent: Root | Element): void {
  for (let i = 0; i < parent.children.length; i += 1) {
    const node = parent.children[i]!;
    if (node.type !== 'element') continue;
    if (node.tagName === 'p') {
      const meaningful = node.children.filter(
        (c) => !(c.type === 'text' && c.value.trim() === '') && !(c.type === 'element' && c.tagName === 'br'),
      );
      const allBlocks =
        meaningful.length > 0 &&
        meaningful.every((c) => c.type === 'element' && BLOCK_EMBED_TAGS.has(c.tagName) && c.properties.dataInline !== 'true');
      if (allBlocks) {
        parent.children.splice(i, 1, ...meaningful);
        i += meaningful.length - 1;
        continue;
      }
    }
    unwrapBlockParagraphs(node);
  }
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
