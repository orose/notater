// Utlagte rader (ADR-011 §4 «Fra HAST til celler»): en blokk blir rader med tekstbiter i roller, med x relativt til
// satsens venstrekant (negativ = hengende i margen). Høyden er `rows.length`, så tilpasningen (3-c) kan måle uten å
// tegne. `paintRows` maler radene i en ramme med temaet.

import { textWidth, writeText, type Frame } from '../cells';
import type { RoleName, StyleSpec, TerminalTheme } from '../theme';

export interface Run {
  readonly text: string;
  readonly style: StyleSpec;
  /** Inline-kode o.l.: brytes ikke inne i biten (designsystem-terminal §4.1). */
  readonly chip?: boolean;
}

export interface Seg extends Run {
  readonly x: number;
}

export interface Row {
  readonly segs: readonly Seg[];
  /** Bakgrunn under raden fra `x` og `width` celler (kodeflate, invertert rad). */
  readonly fill?: { readonly x: number; readonly width: number; readonly bg: RoleName };
}

export const EMPTY_ROW: Row = { segs: [] };

export function runsWidth(runs: readonly Run[]): number {
  return runs.reduce((w, r) => w + textWidth(r.text), 0);
}

export function runsText(runs: readonly Run[]): string {
  return runs.map((r) => r.text).join('');
}

/** Biter etter hverandre fra `x`. */
export function rowOf(x: number, runs: readonly Run[], fill?: Row['fill']): Row {
  const segs: Seg[] = [];
  let cx = x;
  for (const r of runs) {
    segs.push({ ...r, x: cx });
    cx += textWidth(r.text);
  }
  return fill ? { segs, fill } : { segs };
}

export function shiftRows(rows: readonly Row[], dx: number): Row[] {
  return rows.map((r) => ({ segs: r.segs.map((s) => ({ ...s, x: s.x + dx })), ...(r.fill ? { fill: { ...r.fill, x: r.fill.x + dx } } : {}) }));
}

/**
 * Lerretet bak tegningen: rammen og bakgrunnsrollen per celle, så tekst arver flaten den står på (kode, statuslinje)
 * når stilen ikke sier noe annet.
 */
export interface Canvas {
  readonly frame: Frame;
  readonly theme: TerminalTheme;
  fill(x: number, y: number, width: number, height: number, bg: RoleName): void;
  /** Skriver tekst; returnerer kolonnen etter. `maxX` klipper. */
  put(x: number, y: number, text: string, style: StyleSpec, maxX?: number): number;
  runs(x: number, y: number, runs: readonly Run[], maxX?: number): number;
}

export function createCanvas(frame: Frame, theme: TerminalTheme, bg: RoleName = 'bg', paintBackground = true): Canvas {
  const bgRoles: RoleName[] = new Array<RoleName>(frame.cols * frame.rows).fill(bg);
  const canvas: Canvas = {
    frame,
    theme,
    fill(x, y, width, height, role) {
      const style = theme.style({ bg: role });
      for (let yy = Math.max(0, y); yy < Math.min(frame.rows, y + height); yy++) {
        for (let xx = Math.max(0, x); xx < Math.min(frame.cols, x + width); xx++) {
          bgRoles[yy * frame.cols + xx] = role;
          frame.cells[yy * frame.cols + xx] = { ch: ' ', width: 1, style };
        }
      }
    },
    put(x, y, text, style, maxX = frame.cols) {
      if (y < 0 || y >= frame.rows) return x;
      const role = style.bg ?? bgRoles[y * frame.cols + Math.max(0, Math.min(frame.cols - 1, x))] ?? bg;
      return writeText(frame, x, y, text, theme.style({ ...style, bg: role }), maxX);
    },
    runs(x, y, runs, maxX) {
      let cx = x;
      for (const r of runs) cx = canvas.put(cx, y, r.text, r.style, maxX);
      return cx;
    },
  };
  // Hele terminalen males (designsystem-terminal §10): ingen celle står med terminalens standardbakgrunn.
  if (paintBackground) canvas.fill(0, 0, frame.cols, frame.rows, bg);
  return canvas;
}

/** Maler rader fra `(left, top)`; høyst `maxRows` rader og ikke forbi `maxX`. Returnerer neste rad. */
export function paintRows(canvas: Canvas, rows: readonly Row[], left: number, top: number, maxRows = rows.length, maxX = canvas.frame.cols): number {
  const shown = rows.slice(0, Math.max(0, maxRows));
  shown.forEach((row, i) => {
    const y = top + i;
    if (row.fill) canvas.fill(left + row.fill.x, y, row.fill.width, 1, row.fill.bg);
    for (const seg of row.segs) canvas.put(left + seg.x, y, seg.text, seg.style, maxX);
  });
  return top + shown.length;
}

/** Ren tekst for en rad (tester). */
export function rowText(row: Row): string {
  const sorted = [...row.segs].sort((a, b) => a.x - b.x);
  let out = '';
  let col = Math.min(0, ...sorted.map((s) => s.x));
  for (const s of sorted) {
    if (s.x > col) out += ' '.repeat(s.x - col);
    out += s.text;
    col = s.x + textWidth(s.text);
  }
  return out.replace(/\s+$/u, '');
}

