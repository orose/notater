import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { VaultId } from '../../../shared/api-types';
import { CommandPalette } from './CommandPalette';
import { SearchContext, type PaletteCommandSource, type SearchContextValue } from './search-context';

interface SearchProviderProps {
  readonly vaultId: VaultId;
  readonly children: ReactNode;
}

/**
 * Eier paletten (søk og kommandoer, F5). Tastene (`⌘K`, `/`, `:`) ligger i kommandoregisteret
 * (ADR-007 §6); når paletten er åpen, lukker den selv på `⌘K`.
 */
export function SearchProvider({ vaultId, children }: SearchProviderProps) {
  const [state, setState] = useState<{ open: boolean; initial: string; nonce: number }>({ open: false, initial: '', nonce: 0 });
  const [commandSource, setCommandSource] = useState<PaletteCommandSource | null>(null);

  const openWith = useCallback((initial: string) => {
    setState((s) => ({ open: true, initial, nonce: s.nonce + 1 }));
  }, []);

  const value = useMemo<SearchContextValue>(
    () => ({
      openSearch: (query?: string) => openWith(query ?? ''),
      openCommands: (query?: string) => openWith(`:${query ?? ''}`),
      setCommandSource: (source) => setCommandSource(() => source),
    }),
    [openWith],
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      <CommandPalette
        key={state.nonce}
        vaultId={vaultId}
        open={state.open}
        initialQuery={state.initial}
        commands={commandSource}
        onClose={() => setState((s) => ({ ...s, open: false }))}
      />
    </SearchContext.Provider>
  );
}
