import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/ui/Icon';
import { useViewSettings } from './use-view-settings';

const AWAKE_MS = 1800;
const HINT_MS = 4000;

function cssMs(name: string, fallback: number): number {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const value = raw.endsWith('ms') ? parseFloat(raw) : raw.endsWith('s') ? parseFloat(raw) * 1000 : NaN;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function isTouch(): boolean {
  try {
    return window.matchMedia('(hover: none)').matches;
  } catch {
    return false;
  }
}

/**
 * Zen-krom (F4, PO-61): «Avslutt zen»-knappen i øvre høyre hjørne (desktop: synlig ved musebevegelse, hover
 * og fokus; touch: alltid). Førstegangshintet (`ZenHint`) rendres i den felles varselsonen (BUG-014).
 */
export function ZenChrome() {
  const { zen, setZen } = useViewSettings();
  const [awake, setAwake] = useState(false);
  const awakeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!zen) return undefined;
    const onMove = () => {
      setAwake(true);
      window.clearTimeout(awakeTimer.current);
      awakeTimer.current = window.setTimeout(() => setAwake(false), AWAKE_MS);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.clearTimeout(awakeTimer.current);
      setAwake(false);
    };
  }, [zen]);

  if (!zen) return null;
  return (
    <>
      <button type="button" className="zen-exit" aria-label="Avslutt zen" data-awake={awake || undefined} onClick={() => setZen(false)}>
        <span className="t" aria-hidden="true">
          zen
        </span>
        <kbd className="k" aria-hidden="true">
          Esc
        </kbd>
        <Icon name="close" className="x" />
      </button>
    </>
  );
}

/**
 * Førstegangshintet for zen (designsystem §11.6), de tre første gangene. Rendres i den felles varselsonen
 * (BUG-014) mellom toasts og which-key; en ny toast fjerner det (`dismissZenHint`).
 */
export function ZenHint() {
  const { zen, zenHint, dismissZenHint } = useViewSettings();
  useEffect(() => {
    if (!zenHint) return undefined;
    const timer = window.setTimeout(dismissZenHint, cssMs('--hint-linger', HINT_MS));
    return () => window.clearTimeout(timer);
  }, [zenHint, dismissZenHint]);
  if (!zen || !zenHint) return null;
  const touch = isTouch();
  return (
    <div className="hint-card" role="status" data-testid="zen-hint">
      {touch ? (
        <>
          <strong>Zen</strong> Panelene er skjult. Trykk ✕ øverst til høyre for å gå tilbake.
        </>
      ) : (
        <>
          <strong>Zen</strong> Panelene er skjult – tastene virker som før. <kbd className="k">Esc</kbd> eller{' '}
          <span className="keys-inline">
            <kbd className="k lead">Space</kbd>
            <kbd className="k">z</kbd>
          </span>{' '}
          tar deg tilbake.
        </>
      )}
    </div>
  );
}
