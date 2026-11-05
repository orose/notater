/** markdown: render-pipeline Obsidian-markdown → sanert HAST (ADR-002). */
export { renderMarkdown } from './render-markdown';
export type { RenderOptions, RenderResult, SectionSelector } from './render-markdown';
export type { EmbedRequest, LinkRequest, LinkSyntax, LinkTarget, RenderContext } from './render-context';
export { h, text, truncateSource } from './hast-builders';
export { buildLink, wikiLinkDisplay } from './trusted-transforms';
