import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeContextValue } from './theme-context';
import { isModifierPressed } from '../../shared/ui/shortcuts';
import {
  DARK_QUERY,
  applyTheme,
  preferencesFromSearch,
  readStoredPreferences,
  resolveMode,
  safeLocalStorage,
  writeStoredPreferences,
  type ThemePreferences,
} from './theme-state';

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

function initialPreferences(): ThemePreferences {
  return preferencesFromSearch(window.location.search, readStoredPreferences(safeLocalStorage()));
}

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<ThemePreferences>(initialPreferences);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(DARK_QUERY);
    } catch {
      return undefined;
    }
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    applyTheme(document.documentElement, preferences, systemDark);
  }, [preferences, systemDark]);

  const setPreferences = useCallback((patch: Partial<ThemePreferences>) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...patch };
      writeStoredPreferences(safeLocalStorage(), next);
      return next;
    });
  }, []);

  const resolvedMode = resolveMode(preferences.mode, systemDark);

  const toggleMode = useCallback(() => {
    setPreferences({ mode: resolvedMode === 'dark' ? 'light' : 'dark' });
  }, [resolvedMode, setPreferences]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isModifierPressed(event) && event.key === '.') {
        event.preventDefault();
        toggleMode();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preferences, resolvedMode, setPreferences, toggleMode }),
    [preferences, resolvedMode, setPreferences, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
