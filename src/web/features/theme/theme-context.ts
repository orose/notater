import { createContext } from 'react';
import type { ResolvedMode, ThemePreferences } from './theme-state';

export interface ThemeContextValue {
  readonly preferences: ThemePreferences;
  readonly resolvedMode: ResolvedMode;
  readonly setPreferences: (patch: Partial<ThemePreferences>) => void;
  readonly toggleMode: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
