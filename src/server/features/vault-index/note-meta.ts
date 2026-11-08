import type { FrontmatterData, HeadingInfo } from '../markdown-syntax';

/**
 * Hvor en utgående lenke kommer fra:
 * - `wikilink` `[[x]]`, `embed` `![[x]]`
 * - `markdown` `[t](x)`, `markdown-embed` `![a](x)`
 * - `property` `"[[x]]"` i en frontmatter-verdi (PO-9: teller som tilbakelenke)
 */
export type OutgoingLinkKind = 'wikilink' | 'embed' | 'markdown' | 'markdown-embed' | 'property';

export interface OutgoingLink {
  readonly kind: OutgoingLinkKind;
  /** Rå sti-del slik den står (markdown-lenker er URL-dekodet). `''` = samme notat. */
  readonly target: string;
  readonly anchor: string | null;
  /** Ren tekst rundt lenken (maks ~160 tegn), for tilbakelenker. */
  readonly snippet: string;
}

/** Metadata for ett notat. Ren data (kan sendes mellom worker-tråder). */
export interface NoteMeta {
  readonly frontmatter: FrontmatterData | null;
  readonly frontmatterError: string | null;
  readonly aliases: readonly string[];
  /** Uten `#`, original skrivemåte, unike case-insensitivt; frontmatter først, så inline. */
  readonly tags: readonly string[];
  readonly headings: readonly HeadingInfo[];
  readonly blockIds: readonly string[];
  readonly links: readonly OutgoingLink[];
  /** Ren tekst for søk (uten frontmatter og kommentarer). */
  readonly text: string;
}
