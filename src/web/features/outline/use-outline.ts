import { useContext } from 'react';
import { FoldingContext, OutlineHostContext, type FoldingValue, type OutlineControl } from './folding-context';
import type { Root } from 'hast';
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

/**
 * Innholdet med foldede seksjoner skjult (`div[hidden]`, ADR-009 §5), når `content` er disposisjonen som
 * folding gjelder for; ellers uendret.
 */
export function useFoldedContent(content: Root): Root {
  const folding = useContext(FoldingContext);
  return folding && folding.base === content ? folding.content : content;
}
