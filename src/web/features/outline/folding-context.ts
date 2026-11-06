import { createContext } from 'react';
import type { SectionStats } from './build-outline';

/** Det overskriftskomponentene trenger for pilen og fold-linjen. */
export interface FoldingValue {
  readonly isFoldable: (id: string) => boolean;
  readonly isFolded: (id: string) => boolean;
  readonly toggle: (id: string) => void;
  readonly stats: (id: string) => SectionStats;
  /** Toppnivåblokkene (`content.children`-indekser) som er skjult nå. */
  readonly hidden: ReadonlySet<number>;
}

export const FoldingContext = createContext<FoldingValue | null>(null);

/** Kontrollen kommandoene (`za`, `zM`, `zR`) når via `OutlineHost` (ADR-007 porter). */
export interface OutlineControl {
  readonly foldableHeadings: number;
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
