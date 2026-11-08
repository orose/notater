import type { ImageSize } from './read-image-size';

export interface RequestedImageSize {
  readonly width?: number | null;
  readonly height?: number | null;
}

export interface ImageAttributes {
  readonly width?: number;
  readonly height?: number;
}

/**
 * `width`/`height` for `<img>` (PO-71). Sideforholdet til bildet bevares alltid når det er kjent:
 *
 * - ingen ønsket størrelse → bildets egen størrelse;
 * - bare bredde (`|300`) eller bare høyde (HTML `height`) → den andre regnes ut fra sideforholdet;
 * - begge (`|300x200`) → bildet skaleres til å passe *inni* boksen (som CSS `object-fit: contain`).
 *
 * Ukjent størrelse (`intrinsic` = `null`) gir bare det som ble bedt om, uendret.
 */
export function fitImageSize(intrinsic: ImageSize | null, requested: RequestedImageSize = {}): ImageAttributes {
  const w = positive(requested.width);
  const h = positive(requested.height);
  if (!intrinsic) return { ...(w ? { width: w } : {}), ...(h ? { height: h } : {}) };
  const ratio = intrinsic.width / intrinsic.height;
  if (w && h) {
    const scale = Math.min(w / intrinsic.width, h / intrinsic.height);
    return { width: round(intrinsic.width * scale), height: round(intrinsic.height * scale) };
  }
  if (w) return { width: w, height: round(w / ratio) };
  if (h) return { width: round(h * ratio), height: h };
  return { width: intrinsic.width, height: intrinsic.height };
}

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function round(value: number): number {
  return Math.max(1, Math.round(value));
}
