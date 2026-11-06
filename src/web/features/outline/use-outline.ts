import { useContext } from 'react';
import { FoldingContext, OutlineHostContext, type FoldingValue, type OutlineControl } from './folding-context';
import type { SectionStats } from './build-outline';

/** Kontrollen for notatet som vises nå, eller null (ingen notatside). */
export function useOutlineControl(): OutlineControl | null {
  return useContext(OutlineHostContext)?.control ?? null;
}

export interface HeadingFold {
  readonly folded: boolean;
  readonly toggle: () => void;
  readonly stats: SectionStats;
}

/** Fold-tilstand for én overskrift, eller null hvis den ikke kan foldes (eller folding ikke er aktiv). */
export function useHeadingFold(id: string | undefined): HeadingFold | null {
  const folding: FoldingValue | null = useContext(FoldingContext);
  if (!folding || !id || !folding.isFoldable(id)) return null;
  return { folded: folding.isFolded(id), toggle: () => folding.toggle(id), stats: folding.stats(id) };
}

const NO_HIDDEN: ReadonlySet<number> = new Set();

/** Skjulte toppnivåblokker (til `HastContent`). */
export function useHiddenBlocks(): ReadonlySet<number> {
  return useContext(FoldingContext)?.hidden ?? NO_HIDDEN;
}
