// Cellemodellen (ADR-011 §4): et lysbilde tegnes som et rutenett av celler med stil – aldri som strenger med
// innbakte escape-sekvenser. Rammen er ren data: den kan snapshot-testes som tekst og stil, og diffes mot forrige
// ramme (`frame-diff.ts`) slik at et lysbildebytte bare skriver cellene som endres.

import { graphemeWidth, graphemes } from './cell-width';

/** Farge uavhengig av terminalens fargedybde; `frame-diff` oversetter til truecolor, 256, 16 eller ingenting. */
export type Color = { readonly kind: 'default' } | { readonly kind: 'rgb'; readonly rgb: number } | { readonly kind: 'ansi'; readonly index: number };

export const DEFAULT_COLOR: Color = { kind: 'default' };

export interface CellStyle {
  readonly fg: Color;
  readonly bg: Color;
  readonly bold?: boolean;
  readonly dim?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly inverse?: boolean;
  /** OSC 8-hyperlenke (bare eksterne URL-er, ADR-011 §4). */
  readonly link?: string;
}

export const PLAIN: CellStyle = { fg: DEFAULT_COLOR, bg: DEFAULT_COLOR };

export interface Cell {
  /** Én grafemklynge; `''` for høyre halvdel av et bredt tegn. */
  readonly ch: string;
  /** 1 eller 2 for vanlige celler, 0 for fortsettelsen av et bredt tegn. */
  readonly width: 0 | 1 | 2;
  readonly style: CellStyle;
}

export interface Frame {
  readonly cols: number;
  readonly rows: number;
  /** Rad for rad, `rows × cols`. */
  readonly cells: Cell[];
}

export function blankCell(style: CellStyle = PLAIN): Cell {
  return { ch: ' ', width: 1, style };
}

export function createFrame(cols: number, rows: number, fill: CellStyle = PLAIN): Frame {
  const cells: Cell[] = [];
  for (let i = 0; i < cols * rows; i++) cells.push(blankCell(fill));
  return { cols, rows, cells };
}

export function cellAt(frame: Frame, x: number, y: number): Cell | undefined {
  if (x < 0 || y < 0 || x >= frame.cols || y >= frame.rows) return undefined;
  return frame.cells[y * frame.cols + x];
}

/**
 * Skriver tekst fra `(x, y)` og returnerer kolonnen etter siste tegn. Klipper ved `maxX` (standard: rammens
 * bredde). Et bredt tegn som ikke får plass i siste kolonne, blir et mellomrom – aldri et halvt tegn. Linjeskift
 * håndteres ikke her (reflow skjer før tegning).
 */
export function writeText(frame: Frame, x: number, y: number, text: string, style: CellStyle, maxX = frame.cols): number {
  if (y < 0 || y >= frame.rows) return x;
  const limit = Math.min(maxX, frame.cols);
  let col = x;
  for (const g of graphemes(text)) {
    const w = graphemeWidth(g);
    if (w === 0) continue;
    if (col + w > limit) {
      if (col < limit) frame.cells[y * frame.cols + col] = blankCell(style);
      return limit;
    }
    if (col >= 0) {
      frame.cells[y * frame.cols + col] = { ch: g, width: w, style };
      if (w === 2) frame.cells[y * frame.cols + col + 1] = { ch: '', width: 0, style };
    }
    col += w;
  }
  return col;
}

/** Ren tekst per rad (snapshot-tester, `docs/test`). Høyre halvdel av brede tegn utelates. */
export function frameToLines(frame: Frame): string[] {
  const lines: string[] = [];
  for (let y = 0; y < frame.rows; y++) {
    let line = '';
    for (let x = 0; x < frame.cols; x++) line += frame.cells[y * frame.cols + x]?.ch ?? '';
    lines.push(line.replace(/\s+$/u, ''));
  }
  return lines;
}
