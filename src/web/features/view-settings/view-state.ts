// Ren visningstilstand (ADR-008, F1/F4). Samme mønster som `theme-state.ts`: normalisering og
// read/write med try/catch. Samme regler som `public/tema-init.js`, som setter `data-width` før første maling.
// P1: tar aldri notatinnhold eller frontmatter som inndata.

export type ReadingWidth = 'readable' | 'full';

export const WIDTH_STORAGE_KEY = 'vault-leser.visning';
export const ZEN_HINT_STORAGE_KEY = 'vault-leser.hint.zen';
/** Førstegangshintet for zen vises så mange ganger (designsystem §11.6). */
export const ZEN_HINT_TIMES = 3;

/** `{ "v": 1, "width": "full" }`. Ukjent versjon, form eller verdi → `readable`. */
export function normalizeWidth(raw: unknown): ReadingWidth {
  if (raw && typeof raw === 'object' && (raw as { v?: unknown }).v === 1 && (raw as { width?: unknown }).width === 'full') return 'full';
  return 'readable';
}

export function readWidth(storage: Storage | undefined): ReadingWidth {
  try {
    return normalizeWidth(JSON.parse(storage?.getItem(WIDTH_STORAGE_KEY) ?? 'null'));
  } catch {
    return 'readable';
  }
}

export function writeWidth(storage: Storage | undefined, width: ReadingWidth): void {
  try {
    storage?.setItem(WIDTH_STORAGE_KEY, JSON.stringify({ v: 1, width }));
  } catch {
    // full kvote eller blokkert: valget gjelder bare økten
  }
}

/** `<html data-width="full">` bare for full bredde (leseoptimalisert er standard, uten attributt). */
export function applyWidth(root: HTMLElement, width: ReadingWidth): void {
  if (width === 'full') root.dataset.width = 'full';
  else delete root.dataset.width;
}

/** `<html data-zen="on">` mens zen er på. */
export function applyZen(root: HTMLElement, on: boolean): void {
  if (on) root.dataset.zen = 'on';
  else delete root.dataset.zen;
}

/** Teller opp førstegangshintet; `true` hvis det skal vises denne gangen. */
export function takeZenHint(storage: Storage | undefined): boolean {
  try {
    const seen = Number(storage?.getItem(ZEN_HINT_STORAGE_KEY) ?? '0');
    const count = Number.isFinite(seen) && seen >= 0 ? seen : 0;
    if (count >= ZEN_HINT_TIMES) return false;
    storage?.setItem(ZEN_HINT_STORAGE_KEY, String(count + 1));
    return true;
  } catch {
    return false;
  }
}
