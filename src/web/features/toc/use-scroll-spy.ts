import { useEffect, useState } from 'react';

export interface ScrollSpyState {
  readonly activeId: string | null;
  /** Lesefremdrift 0–1. */
  readonly progress: number;
}

function isRendered(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility;
  if (el.closest('[hidden]')) return false;
  return typeof check === 'function' ? check.call(el) : true;
}

/**
 * Aktiv overskrift = siste overskrift som har passert 30 % av vinduet (som prototypen). Samme leselinje som
 * `za` (READING_LINE i outline, PO-53). Skjulte (foldede) overskrifter hoppes over.
 */
export function useScrollSpy(ids: readonly string[]): ScrollSpyState {
  const [state, setState] = useState<ScrollSpyState>({ activeId: ids[0] ?? null, progress: 0 });
  const key = ids.join('\n');

  useEffect(() => {
    const list = key ? key.split('\n') : [];
    let frame = 0;
    const update = () => {
      frame = 0;
      let active: string | null = list[0] ?? null;
      const limit = window.innerHeight * 0.3;
      for (const id of list) {
        const el = document.getElementById(id);
        // Foldede seksjoner (F3): et skjult element har top = 0 og ville ellers blitt «aktivt».
        if (!el || !isRendered(el)) continue;
        if (el.getBoundingClientRect().top < limit) active = id;
      }
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
      const progress = Math.min(1, Math.max(0, doc.scrollTop / max));
      setState((prev) => (prev.activeId === active && Math.abs(prev.progress - progress) < 0.001 ? prev : { activeId: active, progress }));
    };
    const onScroll = () => {
      if (typeof requestAnimationFrame === 'undefined' || import.meta.env.MODE === 'test') update();
      else if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  return state;
}
