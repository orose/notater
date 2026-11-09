import { useEffect, useRef } from 'react';
import { safeLocalStorage } from '../../shared/storage';
import { moveLevelIn, presentationKey, readLevels, writeLevels } from './presentation-storage';

/** PO-49 / ADR-010 §7: lagret lysbildenivå følger notatet ved omdøping (samme `moved`-signal som diskré embedding). */
export function PresentationMoveSync({ vaultId, moved }: { readonly vaultId: string; readonly moved: Readonly<Record<string, string>> }) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const [from, to] of Object.entries(moved)) {
      const key = `${from}\n${to}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      const storage = safeLocalStorage();
      const before = readLevels(storage);
      const after = moveLevelIn(before, presentationKey(vaultId, from), presentationKey(vaultId, to));
      if (after !== before) writeLevels(storage, after);
    }
  }, [vaultId, moved]);
  return null;
}
