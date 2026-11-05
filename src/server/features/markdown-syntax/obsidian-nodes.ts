/**
 * Egne mdast-nodetyper for Obsidian-syntaks. Nodene produseres av `parseObsidianMarkdown` og
 * leses både av vault-indeksen (metadata) og av render-pipelinen.
 */
import type { Data, Literal, Parent, PhrasingContent } from 'mdast';

/** `[[mål#anker|alias]]` eller `![[…]]` (embed). */
export interface WikiLink extends Literal {
  readonly type: 'wikiLink';
  /** Rå tekst inkl. klammer, f.eks. `![[x#y|z]]`. */
  value: string;
  embed: boolean;
  /** Sti-delen uten anker/alias. Tom streng = samme notat (`[[#Overskrift]]`). */
  target: string;
  /** Alt etter første `#`, uten `#`, f.eks. `Overskrift`, `H1#H2`, `^blokk`. */
  anchor: string | null;
  /** Alt etter første `|`. */
  alias: string | null;
  data?: Data;
}

/** Inline `#tagg` (uten `#` i `tag`). */
export interface ObsidianTag extends Literal {
  readonly type: 'obsidianTag';
  /** Taggen slik den er skrevet, uten `#`. */
  value: string;
  data?: Data;
}

/** `==markering==`. */
export interface Highlight extends Parent {
  readonly type: 'highlight';
  children: PhrasingContent[];
  data?: Data;
}

export type UnsupportedKind = 'latex' | 'canvas' | 'excalidraw' | 'dataview' | 'other';

/** Innhold vi bevisst ikke støtter (LaTeX-blokk o.l.). */
export interface UnsupportedNode extends Literal {
  readonly type: 'unsupported';
  kind: UnsupportedKind;
  /** Kildeteksten. */
  value: string;
  inline: boolean;
  data?: Data;
}

declare module 'mdast' {
  interface PhrasingContentMap {
    wikiLink: WikiLink;
    obsidianTag: ObsidianTag;
    highlight: Highlight;
    unsupported: UnsupportedNode;
  }
  interface RootContentMap {
    wikiLink: WikiLink;
    obsidianTag: ObsidianTag;
    highlight: Highlight;
    unsupported: UnsupportedNode;
  }
  interface BlockContentMap {
    unsupported: UnsupportedNode;
  }
  interface Data {
    /** Blokk-id (`^abc`) uten `^`, satt på avsnitt, listepunkt eller blokken før en frittstående id. */
    vrBlockId?: string;
    /** Overskrift-id (slug), satt av `collectHeadings`. */
    vrHeadingId?: string;
    /** Egendefinert oppgavestatus (`/`, `-` …) for listepunkter. */
    vrTaskStatus?: string;
  }
}
