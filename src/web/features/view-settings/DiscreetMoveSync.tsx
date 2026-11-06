import { useEffect, useRef } from 'react';
import { useViewSettings } from './use-view-settings';

/**
 * Omdøping/flytting (PO-49) mens leseren er åpen: diskré-valget følger notatet (ADR-008). `moved` er
 * live-reload-tilstanden (gammel sti → ny sti); hver flytting behandles én gang.
 */
export function DiscreetMoveSync({ vaultId, moved }: { readonly vaultId: string; readonly moved: Readonly<Record<string, string>> }) {
  const { moveDiscreet } = useViewSettings();
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const [from, to] of Object.entries(moved)) {
      const key = `${from}\n${to}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      moveDiscreet(vaultId, from, to);
    }
  }, [vaultId, moved, moveDiscreet]);
  return null;
}
