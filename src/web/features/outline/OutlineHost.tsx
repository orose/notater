import { useMemo, useState, type ReactNode } from 'react';
import { OutlineHostContext, type OutlineControl, type OutlineHostValue } from './folding-context';

/**
 * Bindeledd mellom notatvisningen (som eier fold-tilstanden) og kommandoregisteret (`za`, `zM`, `zR`).
 * Monteres i layouten over `CommandProvider`; notatsiden registrerer kontrollen sin.
 */
export function OutlineHost({ children }: { readonly children: ReactNode }) {
  const [control, setControl] = useState<OutlineControl | null>(null);
  const value = useMemo<OutlineHostValue>(() => ({ control, register: (next) => setControl(() => next) }), [control]);
  return <OutlineHostContext.Provider value={value}>{children}</OutlineHostContext.Provider>;
}
