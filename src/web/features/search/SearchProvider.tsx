import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { VaultId } from '../../../shared/api-types';
import { CommandPalette } from './CommandPalette';
import { SearchContext } from './search-context';

interface SearchProviderProps {
  readonly vaultId: VaultId;
  readonly children: ReactNode;
}

/** Eier ⌘K-dialogen og den globale snarveien (AK13). */
export function SearchProvider({ vaultId, children }: SearchProviderProps) {
  const [state, setState] = useState<{ open: boolean; initial: string; nonce: number }>({ open: false, initial: '', nonce: 0 });

  const open = useCallback((query?: string) => {
    setState((s) => ({ open: true, initial: query ?? '', nonce: s.nonce + 1 }));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setState((s) => (s.open ? { ...s, open: false } : { open: true, initial: '', nonce: s.nonce + 1 }));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SearchContext.Provider value={open}>
      {children}
      <CommandPalette
        key={state.nonce}
        vaultId={vaultId}
        open={state.open}
        initialQuery={state.initial}
        onClose={() => setState((s) => ({ ...s, open: false }))}
      />
    </SearchContext.Provider>
  );
}
