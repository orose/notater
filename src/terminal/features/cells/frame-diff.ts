// Ramme → ANSI (ADR-011 §3–4). Første ramme (eller ny størrelse) tegnes helt; ellers skrives bare endrede
// celleløp, hver med én markørflytting. Skjermen tømmes aldri mellom lysbilder (ingen blink), og autowrap er av
// mens økten varer (`terminal-session.ts`), så siste kolonne kan skrives uten at terminalen ruller.

import { cellAt, type Cell, type CellStyle, type Color, type Frame } from './frame';

/** Terminalens fargedybde (ADR-011 §4, T4). `none`: NO_COLOR – bare fet/understreket/invers. */
export type ColorDepth = 'truecolor' | 'ansi256' | 'ansi16' | 'none';

const ESC = '\x1b';
const CSI = `${ESC}[`;
const OSC8_CLOSE = `${ESC}]8;;${ESC}\\`;
const DEFAULT: Color = { kind: 'default' };

function sameColor(a: Color, b: Color): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'rgb' && b.kind === 'rgb') return a.rgb === b.rgb;
  if (a.kind === 'ansi' && b.kind === 'ansi') return a.index === b.index;
  return true;
}

export function sameStyle(a: CellStyle, b: CellStyle): boolean {
  return (
    sameColor(a.fg, b.fg) &&
    sameColor(a.bg, b.bg) &&
    !a.bold === !b.bold &&
    !a.dim === !b.dim &&
    !a.italic === !b.italic &&
    !a.underline === !b.underline &&
    (a.underlineStyle ?? 'single') === (b.underlineStyle ?? 'single') &&
    sameColor(a.underlineColor ?? DEFAULT, b.underlineColor ?? DEFAULT) &&
    !a.strike === !b.strike &&
    !a.inverse === !b.inverse &&
    (a.link ?? null) === (b.link ?? null)
  );
}

function sameCell(a: Cell | undefined, b: Cell | undefined): boolean {
  return !!a && !!b && a.ch === b.ch && a.width === b.width && sameStyle(a.style, b.style);
}

/** Nærmeste farge i xterm-256-kuben (16–231) eller gråskalaen (232–255). */
export function rgbTo256(rgb: number): number {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  const level = (v: number) => (v < 48 ? 0 : v < 115 ? 1 : Math.floor((v - 35) / 40));
  const cube = 16 + 36 * level(r) + 6 * level(g) + level(b);
  const grey = Math.round(((r + g + b) / 3 - 8) / 10);
  const greyIndex = 232 + Math.max(0, Math.min(23, grey));
  const cubeValue = (l: number) => (l === 0 ? 0 : 55 + l * 40);
  const dist = (x: number, y: number, z: number) => (r - x) ** 2 + (g - y) ** 2 + (b - z) ** 2;
  const gv = 8 + 10 * (greyIndex - 232);
  return dist(cubeValue(level(r)), cubeValue(level(g)), cubeValue(level(b))) <= dist(gv, gv, gv) ? cube : greyIndex;
}

function colorParams(color: Color, layer: 'fg' | 'bg', depth: ColorDepth): string[] {
  if (depth === 'none' || color.kind === 'default') return [layer === 'fg' ? '39' : '49'];
  if (color.kind === 'ansi') {
    const base = color.index < 8 ? (layer === 'fg' ? 30 : 40) : layer === 'fg' ? 90 : 100;
    return [String(base + (color.index % 8))];
  }
  const r = (color.rgb >> 16) & 0xff;
  const g = (color.rgb >> 8) & 0xff;
  const b = color.rgb & 0xff;
  if (depth === 'truecolor') return [layer === 'fg' ? '38' : '48', '2', String(r), String(g), String(b)];
  // 16 farger uten rolle-mapping: temaet (slice 3-b) leverer `ansi`-farger direkte i denne modusen.
  return [layer === 'fg' ? '38' : '48', '5', String(rgbTo256(color.rgb))];
}

/** SGR 58 (understrekfarge). Kolonform (`58:2::r:g:b`) som Ghostty, kitty og iTerm forstår. */
function underlineColorParams(color: Color, depth: ColorDepth): string[] {
  if (depth === 'none' || color.kind === 'default') return [];
  if (color.kind === 'ansi') return [`58:5:${color.index}`];
  const r = (color.rgb >> 16) & 0xff;
  const g = (color.rgb >> 8) & 0xff;
  const b = color.rgb & 0xff;
  return depth === 'truecolor' ? [`58:2::${r}:${g}:${b}`] : [`58:5:${rgbTo256(color.rgb)}`];
}

/** Full SGR for en stil (nullstiller først – enkelt og robust; løpene er lange nok til at det ikke merkes). */
export function sgr(style: CellStyle, depth: ColorDepth): string {
  const params = ['0'];
  if (style.bold) params.push('1');
  if (style.dim) params.push('2');
  if (style.italic) params.push('3');
  if (style.underline) params.push(style.underlineStyle === 'dotted' ? '4:4' : '4');
  if (style.inverse) params.push('7');
  if (style.strike) params.push('9');
  params.push(...colorParams(style.fg, 'fg', depth), ...colorParams(style.bg, 'bg', depth));
  if (style.underline && style.underlineColor) params.push(...underlineColorParams(style.underlineColor, depth));
  return `${CSI}${params.join(';')}m`;
}

function moveTo(x: number, y: number): string {
  return `${CSI}${y + 1};${x + 1}H`;
}

export interface RenderOptions {
  readonly depth: ColorDepth;
  /** OSC 8 bare når terminalen støtter det (ADR-011 §4); ellers vises lenketeksten uten mål. */
  readonly hyperlinks: boolean;
}

/** Escape-sekvensene som tegner `next` over `prev` (`null` = tegn alt). */
export function renderFrame(prev: Frame | null, next: Frame, options: RenderOptions): string {
  const full = !prev || prev.cols !== next.cols || prev.rows !== next.rows;
  let out = '';
  let current: CellStyle | null = null;
  let link: string | null = null;
  for (let y = 0; y < next.rows; y++) {
    let x = 0;
    while (x < next.cols) {
      const cell = cellAt(next, x, y) as Cell;
      if (!full && sameCell(cellAt(prev, x, y), cell)) {
        x += 1;
        continue;
      }
      // Start på et bredt tegns høyre halvdel: begynn på venstre halvdel.
      const startX = cell.width === 0 && x > 0 ? x - 1 : x;
      out += moveTo(startX, y);
      let cx = startX;
      while (cx < next.cols) {
        const c = cellAt(next, cx, y) as Cell;
        if (cx > x && !full && sameCell(cellAt(prev, cx, y), c) && c.width !== 0) break;
        if (c.width !== 0) {
          if (!current || !sameStyle(current, c.style)) {
            out += sgr(c.style, options.depth);
            current = c.style;
          }
          const target = options.hyperlinks ? (c.style.link ?? null) : null;
          if (target !== link) {
            out += target === null ? OSC8_CLOSE : `${ESC}]8;;${target}${ESC}\\`;
            link = target;
          }
          out += c.ch;
        }
        cx += 1;
      }
      x = cx;
    }
  }
  if (link !== null) out += OSC8_CLOSE;
  if (out !== '') out += `${CSI}0m`;
  return out;
}
