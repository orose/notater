import { useEffect, type RefObject } from 'react';

interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/** PO-48: overlapper noen av blokkene margens innhold? Ren funksjon. */
export function railOverlapped(rail: Box, blocks: readonly Box[]): boolean {
  if (rail.bottom - rail.top <= 0 || rail.right - rail.left <= 0) return false;
  return blocks.some((b) => b.top < rail.bottom && b.bottom > rail.top && b.right > rail.left && b.left < rail.right);
}

/**
 * Toner ut høyre marg (TOC m.m.) mens en bred base-blokk ligger over margsonen. Setter `data-dimmed`
 * på margen; CSS gjør den usynlig og ikke-klikkbar, men tastaturfokus viser den igjen.
 */
export function useRailDimming(railRef: RefObject<HTMLElement | null>, contentKey: unknown): void {
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const blocks = [...document.querySelectorAll<HTMLElement>('article.prose > .base')].map((b) => b.getBoundingClientRect());
      const dimmed = railOverlapped(rail.getBoundingClientRect(), blocks);
      if (dimmed) rail.dataset.dimmed = 'true';
      else delete rail.dataset.dimmed;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
      delete rail.dataset.dimmed;
    };
  }, [railRef, contentKey]);
}
