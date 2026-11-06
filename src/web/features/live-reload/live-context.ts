import { createContext } from 'react';
import type { DocPath, FileChange } from '../../../shared/api-types';

export interface LiveState {
  readonly status: 'connecting' | 'live' | 'offline';
  readonly lastSync: Date | null;
  /** Øker ved hver endring (for en kort «blink» i statusprikken). */
  readonly pulse: number;
  /** BUG-006: filer som er flyttet/omdøpt mens appen var åpen (gammel sti → ny sti). */
  readonly moved: Readonly<Record<DocPath, DocPath>>;
}

export const INITIAL_LIVE_STATE: LiveState = { status: 'connecting', lastSync: null, pulse: 0, moved: {} };

export const LiveContext = createContext<LiveState>(INITIAL_LIVE_STATE);

function fileName(path: DocPath): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Tolker en endringsbatch som flytting/omdøping (serveren sender `removed` + `added`). Én fjernet og én
 * lagt til i samme batch = flyttet; ellers pares bare like filnavn (flytting mellom mapper).
 */
export function detectMoves(changes: readonly FileChange[]): Record<DocPath, DocPath> {
  const removed = changes.filter((c) => c.type === 'removed').map((c) => c.path);
  const added = changes.filter((c) => c.type === 'added').map((c) => c.path);
  if (removed.length === 1 && added.length === 1) return { [removed[0] as DocPath]: added[0] as DocPath };
  const moves: Record<DocPath, DocPath> = {};
  for (const from of removed) {
    const candidates = added.filter((to) => fileName(to) === fileName(from));
    if (candidates.length === 1) moves[from] = candidates[0] as DocPath;
  }
  return moves;
}
