import './view-settings.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { safeLocalStorage } from '../../shared/storage';
import { ViewSettingsContext, type ViewSettingsValue } from './view-settings-context';
import { WIDTH_STORAGE_KEY, applyWidth, applyZen, readWidth, takeZenHint, writeWidth, type ReadingWidth } from './view-state';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type DocumentWithTransitions = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Visningsvalg (ADR-008): lesebredde (global, huskes) og zen (flyktig). Monteres i `App` over ruteren,
 * slik at zen overlever navigasjon mellom notater og bytte av vault. Skriver `data-width`/`data-zen` på `<html>`.
 */
export function ViewSettingsProvider({ children }: { readonly children: ReactNode }) {
  const [width, setWidthState] = useState<ReadingWidth>(() => readWidth(safeLocalStorage()));
  const [zen, setZenState] = useState(false);
  const [zenHint, setZenHint] = useState(false);
  const widthRef = useRef(width);

  useLayoutEffect(() => {
    widthRef.current = width;
    applyWidth(document.documentElement, width);
  }, [width]);
  useLayoutEffect(() => {
    applyZen(document.documentElement, zen);
  }, [zen]);
  // Rydd opp ved avmontering (tester, bytte av rot).
  useEffect(
    () => () => {
      applyZen(document.documentElement, false);
    },
    [],
  );

  // Samme leser i flere faner: bredden følger med.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WIDTH_STORAGE_KEY) setWidthState(readWidth(safeLocalStorage()));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setWidth = useCallback((next: ReadingWidth) => {
    writeWidth(safeLocalStorage(), next);
    setWidthState(next);
  }, []);

  const toggleWidth = useCallback(() => {
    const next: ReadingWidth = widthRef.current === 'full' ? 'readable' : 'full';
    setWidth(next);
    return next;
  }, [setWidth]);

  const setZen = useCallback((on: boolean) => {
    setZenHint(on && takeZenHint(safeLocalStorage()));
    // Overgang (designsystem §11.6): View Transitions der det støttes, ellers umiddelbart.
    const doc = document as DocumentWithTransitions;
    if (typeof doc.startViewTransition === 'function' && !reducedMotion()) {
      doc.startViewTransition(() => {
        flushSync(() => setZenState(on));
        applyZen(document.documentElement, on);
      });
    } else {
      setZenState(on);
    }
  }, []);

  const dismissZenHint = useCallback(() => setZenHint(false), []);
  const value = useMemo<ViewSettingsValue>(
    () => ({ width, setWidth, toggleWidth, zen, setZen, zenHint, dismissZenHint }),
    [width, setWidth, toggleWidth, zen, setZen, zenHint, dismissZenHint],
  );
  return <ViewSettingsContext.Provider value={value}>{children}</ViewSettingsContext.Provider>;
}
