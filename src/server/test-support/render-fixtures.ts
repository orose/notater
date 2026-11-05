/** Delte testhjelpere for server-tester (kun brukt av *.test.ts). */
/** Hjelpere for tester av render-pipelinen: falsk RenderContext og HAST-spørringer. */
import type { Element, ElementContent, Root, RootContent } from 'hast';
import { createCodeHighlighter } from '../features/code-highlight';
import type { CodeHighlighter } from '../features/code-highlight';
import type { EmbedRequest, LinkRequest, LinkTarget, RenderContext } from '../features/markdown';

let shared: Promise<CodeHighlighter> | null = null;
export function testHighlighter(): Promise<CodeHighlighter> {
  shared ??= createCodeHighlighter();
  return shared;
}

export interface FakeContext extends RenderContext {
  readonly links: LinkRequest[];
  readonly embeds: EmbedRequest[];
  readonly bases: string[];
}

/** Lenker til «Finnes ikke» er brutte, «Bestilling» gir aliasforslag, alt annet er internt. */
export function fakeContext(highlighter: CodeHighlighter): FakeContext {
  const links: LinkRequest[] = [];
  const embeds: EmbedRequest[] = [];
  const bases: string[] = [];
  return {
    highlighter,
    links,
    embeds,
    bases,
    resolveLink(request): LinkTarget {
      links.push(request);
      if (request.path.toLowerCase().includes('finnes ikke') || request.path.includes('finnes-ikke')) {
        return { status: 'unresolved', suggestion: null };
      }
      if (request.path === 'Bestilling') return { status: 'unresolved', suggestion: { docPath: 'domene/Ordre', title: 'Ordre' } };
      const docPath = request.path === '' ? 'Selv' : request.path.replace(/\.md$/, '');
      return {
        status: 'internal',
        docPath,
        title: docPath.split('/').pop()!,
        anchorId: request.anchor ? request.anchor.toLowerCase().replace(/\s+/g, '-') : null,
        anchorMissing: request.anchor === 'Mangler',
        alternatives: request.path === 'Kunde' ? ['arkiv/2023/Kunde'] : [],
      };
    },
    renderEmbed(request) {
      embeds.push(request);
      return [{ type: 'element', tagName: 'vr-embed', properties: { dataStatus: 'missing', dataRaw: request.raw }, children: [] }];
    },
    registerInlineBase(source) {
      bases.push(source);
      return `base-${bases.length}`;
    },
    documentUrl(docPath, anchor) {
      return `/v/test/${docPath.split('/').map(encodeURIComponent).join('/')}${anchor ? `#${encodeURIComponent(anchor)}` : ''}`;
    },
  };
}

export function findAll(node: Root | ElementContent | RootContent, predicate: (el: Element) => boolean, out: Element[] = []): Element[] {
  if (node.type === 'element' && predicate(node)) out.push(node);
  if ('children' in node) for (const child of node.children) findAll(child as ElementContent, predicate, out);
  return out;
}

export const byTag = (tag: string) => (el: Element) => el.tagName === tag;

export function textOf(node: Root | ElementContent | RootContent): string {
  if (node.type === 'text') return node.value;
  if ('children' in node) return node.children.map((c) => textOf(c as ElementContent)).join('');
  return '';
}

/** Alle tagnavn og alle attributtnavn/-verdier i treet, for XSS-sjekker. */
export function serialize(node: Root): string {
  return JSON.stringify(node);
}
