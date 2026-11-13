// Figlet-hodet og fallback-kjeden (ADR-011 §5, AR-3-20, designsystem-terminal §3.2): `vr-blokk` på én linje →
// `vr-blokk` ≤ 2 linjer (≤ 3 på tittelsiden ved ≥ 36 rader) → `vr-smal` ≤ 2 linjer → fet tekst. Brytes bare mellom
// ord, høyden er ≤ ⅓ av radene, og mangler et tegn i fonten, brukes fet tekst for hele hodet (aldri blandet).

import { readFileSync } from 'node:fs';
import { figletText, figletWidth, parseFlf, renderFiglet, type FlfFont } from './flf';

export type FontName = 'vr-blokk' | 'vr-smal';

export type Header =
  | { readonly kind: 'figlet'; readonly font: FontName; readonly blocks: readonly (readonly string[])[] }
  | { readonly kind: 'text' };

const fonts = new Map<FontName, FlfFont>();

/** Fontene ligger ved siden av modulen (kilde) eller bunten (`dist/terminal/fonts`, kopiert av `scripts/present.mjs`). */
export function loadFont(name: FontName): FlfFont {
  let font = fonts.get(name);
  if (!font) {
    font = parseFlf(readFileSync(new URL(`./fonts/${name}.flf`, import.meta.url), 'utf8'));
    fonts.set(name, font);
  }
  return font;
}

/**
 * Høyden kjeden måler (AR-3-20: ≤ ⅓ av radene): fontens rader per linje, uten luften mellom linjene – som QAs fasit
 * og ADR-011 §5. Tegnet høyde (med én tom rad mellom linjene) gir `drawnHeight`.
 */
export function headerHeight(header: Header, textLines = 1): number {
  if (header.kind === 'text') return textLines + 1;
  return header.blocks.reduce((sum, b) => sum + b.length, 0);
}

/** Rader hodet faktisk tar på skjermen: én tom rad mellom figlet-linjene (designsystem-terminal §3.2). */
export function drawnHeight(header: Header, textLines = 1): number {
  return header.kind === 'text' ? textLines + 1 : headerHeight(header) + header.blocks.length - 1;
}

export interface HeaderLimits {
  readonly width: number;
  /** Høyden hodet kan ta (allerede begrenset til ⅓ av radene). */
  readonly height: number;
  /** Tittelsiden ved ≥ 36 rader: `vr-blokk` kan bruke tre linjer. */
  readonly threeLines?: boolean;
}

export function chooseHeader(text: string, limits: HeaderLimits, load: (name: FontName) => FlfFont = loadFont): Header {
  const upper = figletText(text.trim());
  const steps: Array<[FontName, number]> = [
    ['vr-blokk', 1],
    ['vr-blokk', limits.threeLines ? 3 : 2],
    ['vr-smal', 2],
  ];
  for (const [name, maxLines] of steps) {
    const font = load(name);
    if ([...upper].some((c) => !font.glyphs.has(c))) continue;
    const lines: string[] = [];
    let current = '';
    let ok = true;
    for (const word of upper.split(/\s+/).filter(Boolean)) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (figletWidth(renderFiglet(font, candidate) ?? []) <= limits.width) {
        current = candidate;
        continue;
      }
      if (current === '' || figletWidth(renderFiglet(font, word) ?? []) > limits.width) {
        ok = false;
        break;
      }
      lines.push(current);
      current = word;
    }
    if (current !== '') lines.push(current);
    if (!ok || lines.length === 0 || lines.length > maxLines) continue;
    const blocks = lines.map((l) => renderFiglet(font, l) ?? []);
    const header: Header = { kind: 'figlet', font: name, blocks };
    if (headerHeight(header) <= limits.height) return header;
  }
  return { kind: 'text' };
}
