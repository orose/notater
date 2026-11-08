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
 * Tolker en endringsbatch som flytting/omdøping. Bruker `renamed` (PO-49) når den finnes; ellers `removed` + `added`: én fjernet og én
 * lagt til i samme batch = flyttet; ellers pares bare like filnavn (flytting mellom mapper).
 */
export function detectMoves(changes: readonly FileChange[]): Record<DocPath, DocPath> {
  // PO-49: serveren sender `renamed` med from/to – den er fasit når den finnes. Heuristikken under er reserve.
  const explicit = changes.filter((c) => c.type === 'renamed' && c.from && c.to);
  if (explicit.length > 0) return Object.fromEntries(explicit.map((c) => [c.from as DocPath, c.to as DocPath]));
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
