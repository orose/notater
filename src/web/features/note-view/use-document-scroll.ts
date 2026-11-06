import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router';

// Scroll ved navigasjon: til #anker (med kort markering), gjenoppretting ved frem/tilbake (R10),
// ellers til toppen. Posisjoner lagres per historikk-oppføring (sessionStorage, try/catch).

const STORAGE_KEY = 'vault-leser.scroll';
const positions = new Map<string, number>(readPositions());

function readPositions(): Array<[string, number]> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Array<[string, number]>) : [];
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...positions].slice(-100)));
  } catch {
    // ignorer
  }
}

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

export function useDocumentScroll(ready: boolean, docId: string): { toast: string | null; dismissToast: () => void } {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [toast, setToast] = useState<string | null>(null);
  const initial = useRef(true);

  useEffect(() => {
    const key = location.key;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        positions.set(key, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      positions.set(key, window.scrollY);
      persist();
    };
  }, [location.key]);

  useLayoutEffect(() => {
    if (!ready) return undefined;
    const hash = safeDecode(location.hash.replace(/^#/, ''));
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: initial.current || reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        el.classList.remove('target-flash');
        void el.offsetWidth; // restart animasjonen
        el.classList.add('target-flash');
        timer = setTimeout(() => el.classList.remove('target-flash'), 1300);
      } else if (hash !== 'tilbakelenker') {
        // Svar på en DOM-måling etter rendering (ankeret finnes ikke) – bevisst setState her.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToast(`Fant ikke seksjonen «#${hash}»`);
        window.scrollTo(0, 0);
      }
    } else if ((location.state as { anchorMissing?: boolean } | null)?.anchorMissing && navigationType !== 'POP') {
      // README-QA regel 7: lenken pekte på en seksjon som ikke finnes – vis toppen og si fra.
      const missing = (location.state as { anchor?: string }).anchor;
      setToast(`Fant ikke seksjonen${missing ? ` «${missing}»` : ''} – viser toppen av notatet.`);
      window.scrollTo(0, 0);
    } else if (navigationType === 'POP' && positions.has(location.key)) {
      window.scrollTo(0, positions.get(location.key) ?? 0);
    } else {
      window.scrollTo(0, 0);
    }
    initial.current = false;
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kjøres per navigasjon/dokument
  }, [ready, docId, location.key]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return { toast, dismissToast: () => setToast(null) };
}
