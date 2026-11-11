import './outline.css';
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onlyOverlayChanged, type Place } from '../../shared/overlay-params';
import { useLocation, useNavigationType } from 'react-router';
import type { Outline } from './build-outline';
import { FoldingContext, OutlineHostContext, type FoldingValue, type OutlineControl } from './folding-context';
import { headingAtReadingPosition, isRendered } from './reading-position';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Etter en fold: hold et anker stille i visningen, eller rull/fokuser (`za`). */
interface AfterFold {
  readonly anchor: string | null;
  readonly top: number;
  readonly mode: 'keep' | 'za';
}

interface FoldState {
  readonly docKey: string;
  readonly navKey: string;
  readonly place: Place;
  readonly folded: ReadonlySet<string>;
}

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Fold-tilstanden for ett åpent notat (F3, ADR-009 §5): et sett med foldede overskrift-id-er. Huskes ikke:
 * nytt notat (`docKey`) gir alt utfoldet. Navigasjon til `#mål` folder ut seksjonene rundt målet under
 * rendering, før `useDocumentScroll` leter etter elementet. Registrerer kontrollen for `za`/`zM`/`zR`.
 */
export function FoldingProvider({ outline, docKey, children }: { readonly outline: Outline; readonly docKey: string; readonly children: ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [state, setState] = useState<FoldState>({ docKey, navKey: location.key, place: location, folded: EMPTY });

  // Avledet tilstand i render (samme mønster som `lastPath` i VaultLayout).
  let folded = state.folded;
  if (state.docKey !== docKey) {
    folded = EMPTY;
    setState({ docKey, navKey: location.key, place: location, folded });
  } else if (state.navKey !== location.key && onlyOverlayChanged(state.place, location)) {
    // Presentasjonen starter/avslutter (`?lysbilde`): lesevisningens folding er urørt (Q-13).
    setState({ docKey, navKey: location.key, place: location, folded });
  } else if (state.navKey !== location.key) {
    const hash = safeDecode(location.hash.replace(/^#/, ''));
    if (hash) {
      const around = outline.sectionOf(hash);
      if (around.some((id) => folded.has(id))) {
        const next = new Set(folded);
        for (const id of around) next.delete(id);
        folded = next;
      }
    } else if (navigationType !== 'POP') {
      // Søketreff eller lenke til samme notat uten anker: regnes som å åpne notatet.
      folded = EMPTY;
    }
    setState({ docKey, navKey: location.key, place: location, folded });
  }

  const foldedRef = useRef(folded);
  const afterFold = useRef<AfterFold | null>(null);
  useLayoutEffect(() => {
    foldedRef.current = folded;
    const after = afterFold.current;
    afterFold.current = null;
    if (!after?.anchor) return;
    // Ankeret kan ha blitt skjult (zM): bruk ytterste synlige overskrift rundt det.
    const candidates = [after.anchor, ...outline.sectionOf(after.anchor)];
    const el = candidates.map((id) => document.getElementById(id)).find((e): e is HTMLElement => e !== null && isRendered(e));
    if (!el) return;
    if (after.mode === 'keep') {
      const delta = el.getBoundingClientRect().top - after.top;
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'auto' });
    } else {
      if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
      el.classList.remove('heading-flash');
      void el.offsetWidth;
      el.classList.add('heading-flash');
      window.setTimeout(() => el.classList.remove('heading-flash'), 950);
      el.querySelector<HTMLElement>('.fold')?.focus({ preventScroll: true });
    }
    // PO-62: fokus i noe som ble skjult flyttes til ytterste foldede overskrift rundt det.
    const active = document.activeElement;
    const block = active?.closest<HTMLElement>('[data-folded-block]');
    if (active && block) {
      const index = Number(block.dataset.foldedBlock);
      const holder = outline.headings.find((h) => {
        const r = outline.sectionRange(h.id);
        return foldedRef.current.has(h.id) && r !== null && index >= r[0] && index < r[1];
      });
      document.getElementById(holder?.id ?? '')?.querySelector<HTMLElement>('.fold')?.focus({ preventScroll: true });
    }
  }, [folded, outline]);

  const update = useCallback(
    (next: ReadonlySet<string>, after: AfterFold | null) => {
      afterFold.current = after;
      setState((s) => ({ ...s, folded: next }));
    },
    [],
  );

  const anchorNow = useCallback((): { anchor: string | null; top: number } => {
    const anchor = headingAtReadingPosition(outline.headings.map((h) => h.id));
    return { anchor, top: anchor ? (document.getElementById(anchor)?.getBoundingClientRect().top ?? 0) : 0 };
  }, [outline]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(foldedRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      update(next, null);
    },
    [update],
  );

  const foldable = useMemo(() => new Set(outline.headings.filter((h) => h.foldable).map((h) => h.id)), [outline]);
  const content = useMemo(() => outline.applyFolds(folded), [outline, folded]);

  const value = useMemo<FoldingValue>(
    () => ({
      isFoldable: (id) => foldable.has(id),
      isFolded: (id) => folded.has(id),
      toggle,
      stats: (id) => outline.stats(id),
      base: outline.content,
      content,
    }),
    [foldable, folded, toggle, outline, content],
  );

  const control = useMemo<OutlineControl>(
    () => ({
      foldableHeadings: foldable.size,
      noteEmbeds: outline.noteEmbeds,
      toggleAtReadingPosition: () => {
        const id = headingAtReadingPosition([...foldable]);
        if (!id) return false;
        const next = new Set(foldedRef.current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        update(next, { anchor: id, top: 0, mode: 'za' });
        return true;
      },
      foldAll: () => update(new Set(foldable), { ...anchorNow(), mode: 'keep' }),
      unfoldAll: () => update(EMPTY, { ...anchorNow(), mode: 'keep' }),
    }),
    [foldable, update, anchorNow, outline],
  );

  const host = useContext(OutlineHostContext);
  const register = host?.register;
  useEffect(() => {
    if (!register) return undefined;
    register(control);
    return () => register(null);
  }, [register, control]);

  return <FoldingContext.Provider value={value}>{children}</FoldingContext.Provider>;
}
