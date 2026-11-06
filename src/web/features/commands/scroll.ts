// Rulle-porten (F7, ADR-007 §2): `j`/`k` = 3 × brødtekstens linjehøyde, `Ctrl d/u` = halv vindushøyde,
// `gg`/`G` = topp/bunn. Myk rulling bare når `prefers-reduced-motion` ikke er satt.

import type { CommandPorts } from './model/command-context';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function lineHeight(): number {
  const el = document.querySelector('.prose') ?? document.body;
  const style = getComputedStyle(el);
  const lh = parseFloat(style.lineHeight);
  if (Number.isFinite(lh) && lh > 0) return lh;
  const fs = parseFloat(style.fontSize);
  return Number.isFinite(fs) && fs > 0 ? fs * 1.5 : 24;
}

function maxScroll(): number {
  const root = document.scrollingElement ?? document.documentElement;
  return Math.max(0, root.scrollHeight - window.innerHeight);
}

/** Holdt `j` gir mange trykk under en myk rulling: bygg videre på forrige mål, ikke på nåværende posisjon. */
const CHAIN_MS = 450;

export function createScrollPort(): CommandPorts['scroll'] {
  let target: number | null = null;
  let targetAt = 0;

  const scrollTo = (top: number, chain: boolean) => {
    const clamped = Math.max(0, Math.min(maxScroll(), Math.round(top)));
    const smooth = !reducedMotion();
    target = chain && smooth ? clamped : null;
    targetAt = Date.now();
    window.scrollTo({ top: clamped, behavior: smooth ? 'smooth' : 'auto' });
  };
  const base = () => (target !== null && Date.now() - targetAt < CHAIN_MS ? target : window.scrollY);

  return {
    by: (lines) => scrollTo(base() + lines * lineHeight(), true),
    halfPage: (direction) => scrollTo(base() + (direction * window.innerHeight) / 2, true),
    toTop: () => scrollTo(0, false),
    toBottom: () => scrollTo(maxScroll(), false),
  };
}
