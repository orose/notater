// Lysbildemodellen (ADR-010 §1). Ren TS: ingen React, ingen DOM, ingen import av andre features enn typer.
//
// To trinn, begge rene:
//   buildSlideDrafts(source, options)  → SlideDraftDeck   (S1–S8: struktur, `---`, agenda; uavhengig av layout)
//   finalizeDeck(drafts, fits, options) → SlideDeck       (A2: «(forts.)»-lysbilder, nummer, progresjon, id-er)
// Mellom dem ligger tilpasningen i DOM (`../fit`), som bare leverer bruddpunkter og skriftskala per utkast.

import type { ElementContent, RootContent } from 'hast';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

// ------------------------------------------------------------------------------------- inndata

/** En overskrift i flyten (fra disposisjonen med diskré embedding alltid på, S1). */
export interface FlowHeading {
  /** Disposisjonens id (`slug` fra serveren eller `~e<n>-<i>` for innebygde). Brukes for leseposisjon, ikke i URL. */
  readonly id: string;
  /** Effektivt nivå etter diskré-utflating. */
  readonly level: HeadingLevel;
  /** Ren tekst (samme som TOC). */
  readonly text: string;
}

/**
 * Én blokk i toppnivåflyten: rotens barn, der diskré embeds er gjennomsiktige (ADR-009 §5). Fotnotelisten og
 * rene mellomrom er ikke med. Leveres av `outline` (`Outline.flow`, tillegg i slice 2-a).
 */
export interface FlowBlock {
  readonly node: RootContent | ElementContent;
  /** Satt når blokken er en overskrift i flyten. */
  readonly heading: FlowHeading | null;
  /** `hr` på toppnivå i flyten (S5). */
  readonly thematicBreak: boolean;
}

/** Alt modellen trenger. Ingen frontmatter (P1): tittellysbildets detaljer rendres fra dokumentet. */
export interface SlideSource {
  /** Visningstittel (PO-35). */
  readonly title: string;
  readonly flow: readonly FlowBlock[];
}

export interface SlideOptions {
  /** `:presenter h<n>` (S4). `null` = automatisk (S2/S3). */
  readonly slideLevel: HeadingLevel | null;
}

// ------------------------------------------------------------------------------------- utkast (før tilpasning)

/**
 * Minste enhet tilpasningen kan bryte mellom (A2). Vanligvis én blokk; en liste på toppnivå deles i
 * listepunkter (`listKey` binder punktene sammen, så de rendres i samme `ul`/`ol`, med `start` for `ol`).
 */
export interface SlideUnit {
  readonly node: RootContent | ElementContent;
  /** Hvordan enheten oppfører seg når den alene er for stor (A2). */
  readonly overflow: UnitOverflow;
  /** Felles nøkkel for punkter fra samme liste; `null` for vanlige blokker. */
  readonly listKey: string | null;
}

/**
 * `flow`: tekst o.l. – krymper med skriften. `scale`: bilde/diagram – skaleres til boksen, måles med minstehøyde.
 * `scroll`: kode, tabell, base, callout – minste skrift og intern rulling som siste utvei.
 */
export type UnitOverflow = 'flow' | 'scale' | 'scroll';

export type SlideKind = 'title' | 'agenda' | 'transition' | 'content';

export interface AgendaItem {
  readonly index: number;
  readonly text: string;
  /** Stabil nøkkel (slug av teksten med github-slugger, `-1`, `-2` … ved duplikater). */
  readonly key: string;
}

/** Strukturell adresse: reserve når id-en forsvinner ved live reload (ADR-010 §5). */
export interface SlideAddress {
  readonly kind: SlideKind;
  /** Agendapunktets indeks, eller `null` (tittel, agenda, innledning, notat uten agenda). */
  readonly agenda: number | null;
  /** Lysbildets nummer innen agendapunktet (0 = punktets innledning eller første underoverskrift). */
  readonly slide: number;
  /** Del etter `---` (1-basert, S5). */
  readonly part: number;
  /** Fortsettelse etter automatisk tilpasning (1-basert, A2). */
  readonly continuation: number;
}

export interface SlideDraft {
  /** Grunn-id uten fortsettelsessuffiks (se `slide-id.ts`). */
  readonly baseId: string;
  readonly kind: SlideKind;
  readonly address: Omit<SlideAddress, 'continuation'>;
  /** Overskriften som vises (innholdslysbilder), uten «(forts.)». */
  readonly heading: string | null;
  /** Del ≥ 2 etter `---`: overskriften vises med «(forts.)» (S5). */
  readonly continued: boolean;
  /** Innhold. Tom for agenda og overgang. Id-er er fjernet (ingen duplikater med lesevisningen). */
  readonly units: readonly SlideUnit[];
  /** Overskrift-id-er (disposisjonen) som dette utkastet dekker – til «start ved leseposisjon». */
  readonly sourceHeadingIds: readonly string[];
  /** S6: innhold før første agendaoverskrift, som legges på tittellysbildet hvis det får plass. */
  readonly preamble: boolean;
}

export interface SlideDraftDeck {
  readonly title: string;
  /** Tom når notatet ikke har agendanivå (S7, eller `:presenter h<n>` uten nivå over). */
  readonly agenda: readonly AgendaItem[];
  readonly agendaLevel: HeadingLevel | null;
  readonly slideLevel: HeadingLevel | null;
  /** Nivåene `:presenter h<n>` godtar (har minst én overskrift i flyten, S4). */
  readonly validLevels: readonly HeadingLevel[];
  /** Tittel, agenda, overganger og innhold i rekkefølge, før `:agenda av` og A2. */
  readonly drafts: readonly SlideDraft[];
}

// ------------------------------------------------------------------------------------- tilpasning (fra DOM)

/** Resultatet av tilpasningen for ett utkast (`../fit`). Rene tall: kan caches og testes. */
export interface DraftFit {
  /** Skriftskala (et av `fontScaleSteps(...)` for typesettet). */
  readonly scale: number;
  /** Indekser i `units` der et nytt «(forts.)»-lysbilde begynner. Tom = ett lysbilde. */
  readonly breaks: readonly number[];
  /** Enheter som alene er for store: vises med minste skrift og intern rulling (A2, siste utvei). */
  readonly scrollUnits: readonly number[];
  /** Kun for innledningen (S6): får plass på tittellysbildet. */
  readonly onTitle?: boolean;
}

export interface DeckFit {
  /** Per `SlideDraft.baseId`. Mangler et utkast, brukes foreløpig `{ scale: 1, breaks: [] }`. */
  readonly drafts: Readonly<Record<string, DraftFit>>;
  /** Agendalinjen får ikke plass: vis forrige · nåværende · neste med «…». */
  readonly compactAgendaLine: boolean;
  /** `false` mens tilpasningen pågår (nummer og antall er foreløpige). */
  readonly complete: boolean;
}

// ------------------------------------------------------------------------------------- ferdig kortstokk

export interface SlideFootnote {
  readonly number: string;
  readonly content: readonly ElementContent[];
}

export interface SlideProgress {
  /** 1-basert nummer innen agendapunktet. */
  readonly index: number;
  readonly count: number;
}

export interface Slide {
  /** Stabil id for URL og live reload (`?lysbilde=<id>`). */
  readonly id: string;
  readonly kind: SlideKind;
  readonly address: SlideAddress;
  /** 1-basert («7 / 12»). */
  readonly number: number;
  /** Overskrift med «(forts.)» der det gjelder. */
  readonly heading: string | null;
  readonly units: readonly SlideUnit[];
  readonly scale: number;
  readonly scrollUnits: readonly number[];
  /** A4: fotnotene som hører til lysbildets innhold. */
  readonly footnotes: readonly SlideFootnote[];
  /** Agendapunktet lysbildet hører til (innhold og overgang). */
  readonly agendaIndex: number | null;
  /** Kun innholdslysbilder med agenda. */
  readonly progress: SlideProgress | null;
  /** Tittellysbildet: innledningen (S6) står her. */
  readonly withPreamble: boolean;
  /** Til skjermleseren: «Lysbilde 7 av 12: Leveranse B». */
  readonly label: string;
  readonly sourceHeadingIds: readonly string[];
}

export interface FinalizeOptions {
  /** `:agenda av` (huskes ikke): ingen overgangslysbilder. */
  readonly transitions: boolean;
}

export interface SlideDeck {
  readonly title: string;
  readonly agenda: readonly AgendaItem[];
  readonly slides: readonly Slide[];
  readonly compactAgendaLine: boolean;
  readonly complete: boolean;
  readonly validLevels: readonly HeadingLevel[];
  readonly slideLevel: HeadingLevel | null;
}

// ------------------------------------------------------------------------------------- funksjonene (slice 2-a/2-b)

/** S1–S8. Ren; memoiseres på `(outline, slideLevel)`. Implementeres i slice 2-a (`build-slides.ts`). */
export type BuildSlideDrafts = (source: SlideSource, options: SlideOptions) => SlideDraftDeck;

/** A2 + nummerering + progresjon + id-er. Ren. Implementeres i slice 2-a (`finalize-deck.ts`). */
export type FinalizeDeck = (drafts: SlideDraftDeck, fit: DeckFit, options: FinalizeOptions) => SlideDeck;
