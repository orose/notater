import { createContext } from 'react';

export interface CommandsContextValue {
  /** Åpner `?`-oversikten (fra Utseende og `:hjelp`). */
  readonly openShortcuts: () => void;
}

export const CommandsContext = createContext<CommandsContextValue | null>(null);
