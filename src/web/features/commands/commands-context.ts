import { createContext } from 'react';
import type { Availability, CommandId } from '../../../core/commands';

export interface CommandsContextValue {
  /** Åpner `?`-oversikten (fra Utseende og `:hjelp`). */
  readonly openShortcuts: () => void;
  /** Kjører en kommando fra registeret (som fra tastaturet: deaktivert ⇒ begrunnelsen som toast). */
  readonly run: (id: CommandId) => void;
  /** Om en kommando kan brukes nå, med begrunnelse (til kontroller utenfor paletten, f.eks. Utseende). */
  readonly availability: (id: CommandId) => Availability;
}

export const CommandsContext = createContext<CommandsContextValue | null>(null);
