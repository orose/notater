/** links: Obsidian-lik lenkeoppløsning, ankeroppslag og tilbakelenke-graf (rene funksjoner over indeksen). */
export { createLinkResolver } from './link-resolver';
export type { LinkResolver, LinkSyntax, ResolvedLink } from './link-resolver';
export { resolveAnchor } from './anchors';
export type { AnchorResolution } from './anchors';
export { buildBacklinkIndex } from './backlinks';
export type { BacklinkEntry, BacklinkIndex } from './backlinks';
