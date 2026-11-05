/**
 * markdown-syntax: Obsidian-markdown → mdast. Laveste lag; ingen kunnskap om vaultet.
 * Delt av vault-index (metadata) og markdown (rendering), slik ADR-004 krever.
 */
export type { Highlight, ObsidianTag, UnsupportedKind, UnsupportedNode, WikiLink } from './obsidian-nodes';
export { parseObsidianMarkdown } from './parse-markdown';
export { toInlineText, toPlainText } from './plain-text';
export { collectHeadings, extractBlock, extractHeadingSection } from './sections';
export type { HeadingInfo } from './sections';
export { parseFrontmatter, splitFrontmatter } from './frontmatter';
export type { FrontmatterData, FrontmatterResult, FrontmatterSplit } from './frontmatter';
export { lastAnchorSegment, parseImageAlias, parseWikiLinkInner } from './wikilink-syntax';
export type { ImageAlias, WikiLinkParts } from './wikilink-syntax';
