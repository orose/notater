// Leseposisjon (ADR-009 §5, PO-53): samme leselinje som scroll-spy, 30 % ned i vinduet.

/** Andel av vindushøyden der leselinjen ligger. Brukes også av scroll-spy (TOC). */
export const READING_LINE = 0.3;

export function isRendered(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility;
  if (typeof check === 'function') return check.call(el);
  return (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === 'fixed';
}

/**
 * `za`: (1) overskriften som har fokus (eller pilen i den), (2) ellers siste synlige foldbare overskrift over
 * leselinjen, (3) ellers null. `ids` i dokumentrekkefølge.
 */
export function headingAtReadingPosition(ids: readonly string[], doc: Document = document): string | null {
  const focused = doc.activeElement?.closest('h1, h2, h3, h4, h5, h6');
  if (focused?.id && ids.includes(focused.id)) return focused.id;
  const limit = window.innerHeight * READING_LINE;
  let found: string | null = null;
  for (const id of ids) {
    const el = doc.getElementById(id);
    if (!el || !isRendered(el)) continue;
    if (el.getBoundingClientRect().top < limit) found = id;
    else break;
  }
  return found;
}
