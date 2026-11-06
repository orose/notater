import { createContext } from 'react';
import type { Root } from 'hast';
import type { SectionStats } from './build-outline';

/** Det overskriftskomponentene trenger for pilen og fold-linjen. */
export interface FoldingValue {
  readonly isFoldable: (id: string) => boolean;
  readonly isFolded: (id: string) => boolean;
  readonly toggle: (id: string) => void;
  readonly stats: (id: string) => SectionStats;
  /** Disposisjonens innhold (`outline.content`) og samme innhold med foldede seksjoner skjult. */
  readonly base: Root;
  readonly content: Root;
}

export const FoldingContext = createContext<FoldingValue | null>(null);

/** Kontrollen kommandoene (`za`, `zM`, `zR`) når via `OutlineHost` (ADR-007 porter). */
export interface OutlineControl {
  readonly foldableHeadings: number;
  /** Antall innebygde notater i dokumentet (til diskré-toasten). */
  readonly noteEmbeds: number;
  /** `false` når det ikke finnes noen seksjon ved leseposisjonen. */
  readonly toggleAtReadingPosition: () => boolean;
  readonly foldAll: () => void;
  readonly unfoldAll: () => void;
}

export interface OutlineHostValue {
  readonly control: OutlineControl | null;
  readonly register: (control: OutlineControl | null) => void;
}

export const OutlineHostContext = createContext<OutlineHostValue | null>(null);
