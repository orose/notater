// Fargene i terminalen (ADR-011 §3, AR-3-11, designsystem-terminal §6). Kilden er UX' `farger.json` (generert fra
// tokens.css): roller per palett × modus i truecolor og et kart til terminalens 16 farger. Tegningen ber om roller
// (`{ fg: 'dempet', bg: 'linje_bg' }`); temaet gjør dem om til celler for fargedybden – også revers i 16 farger og
// ingen farger ved NO_COLOR, der form og vekt bærer alt.

import farger from '../../../../docs/design/terminal/farger.json';
import { DEFAULT_COLOR, type CellStyle, type Color, type ColorDepth } from '../cells';

type Truecolor = (typeof farger.truecolor)['fosfor']['dark'];
export type RoleName = keyof Truecolor['roller'];
export type CodeToken = keyof Truecolor['kode'];
export type HueName = keyof Truecolor['kulor'];
export type ColorRole = RoleName | `kode.${CodeToken}` | `kulor.${HueName}`;

export const PALETTES = Object.keys(farger.truecolor) as Array<keyof typeof farger.truecolor>;
export type PaletteName = (typeof PALETTES)[number];
export type ThemeMode = 'light' | 'dark';

export const DEFAULT_PALETTE = farger.standard.palett as PaletteName;

/** Det tegningen ber om. Fargene er roller; resten er SGR-attributter. */
export interface StyleSpec {
  readonly fg?: ColorRole;
  readonly bg?: RoleName;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly dotted?: boolean;
  readonly underlineColor?: ColorRole;
  readonly strike?: boolean;
  readonly link?: string;
}

export interface TerminalTheme {
  readonly palette: PaletteName;
  readonly mode: ThemeMode;
  readonly depth: ColorDepth;
  /** Rolle → celle-stil for fargedybden (memoisert). Standard: `tekst` på `bg`. */
  style(spec?: StyleSpec): CellStyle;
  /** Shiki-token (`--shiki-token-X`) → stil; kommentarer i kursiv også i 16 farger. */
  codeStyle(token: string, italic: boolean): StyleSpec;
}

export function isPalette(name: string): name is PaletteName {
  return (PALETTES as readonly string[]).includes(name);
}

const hex = (value: string): Color => ({ kind: 'rgb', rgb: Number.parseInt(value.slice(1), 16) });

/** Roller som er revers i 16 farger (vims StatusLine/TabLineFill og cursorline). */
const REVERSE_BG = new Set<RoleName>(['linje_bg', 'invertert_bg', 'markor_bg']);

type Ansi16Value = number | string;

function lookup(set: { roller: object; kode: object; kulor: object }, role: ColorRole): unknown {
  if (role.startsWith('kode.')) return (set.kode as Record<string, unknown>)[role.slice(5)];
  if (role.startsWith('kulor.')) return (set.kulor as Record<string, unknown>)[role.slice(6)];
  return (set.roller as Record<string, unknown>)[role];
}

export function createTheme(palette: PaletteName, mode: ThemeMode, depth: ColorDepth): TerminalTheme {
  const rich = depth === 'truecolor' || depth === 'ansi256';
  const tc = farger.truecolor[palette][mode];
  const a16 = farger.ansi16[mode];
  const accent = farger.ansi16.aksentAvPalett[palette][mode];

  const ansi = (role: ColorRole): { color: Color; italic: boolean } => {
    if (depth === 'none') return { color: DEFAULT_COLOR, italic: false };
    const raw = lookup(a16, role) as Ansi16Value | undefined;
    if (raw === undefined) return { color: DEFAULT_COLOR, italic: false };
    if (raw === 'palett') return { color: { kind: 'ansi', index: accent }, italic: false };
    if (typeof raw === 'number') return { color: { kind: 'ansi', index: raw }, italic: false };
    const m = /^(\d+)\+kursiv$/.exec(raw);
    if (m) return { color: { kind: 'ansi', index: Number(m[1]) }, italic: true };
    return { color: DEFAULT_COLOR, italic: false };
  };
  const color = (role: ColorRole): { color: Color; italic: boolean } => {
    if (rich) {
      const value = lookup(tc, role);
      return { color: typeof value === 'string' ? hex(value) : DEFAULT_COLOR, italic: false };
    }
    return ansi(role);
  };

  const cache = new Map<string, CellStyle>();
  const style = (spec: StyleSpec = {}): CellStyle => {
    const key = JSON.stringify(spec);
    const hit = cache.get(key);
    if (hit) return hit;
    const bgRole: RoleName = spec.bg ?? 'bg';
    const reverse = !rich && REVERSE_BG.has(bgRole);
    const fg = reverse ? { color: DEFAULT_COLOR, italic: false } : color(spec.fg ?? 'tekst');
    const bg = reverse ? DEFAULT_COLOR : color(bgRole).color;
    const out: CellStyle = {
      fg: fg.color,
      bg,
      ...(spec.bold ? { bold: true } : {}),
      ...(spec.italic || fg.italic ? { italic: true } : {}),
      ...(spec.underline ? { underline: true } : {}),
      ...(spec.underline && spec.dotted ? { underlineStyle: 'dotted' as const } : {}),
      ...(spec.underline && spec.underlineColor && !reverse ? { underlineColor: color(spec.underlineColor).color } : {}),
      ...(spec.strike ? { strike: true } : {}),
      ...(reverse ? { inverse: true } : {}),
      ...(spec.link ? { link: spec.link } : {}),
    };
    cache.set(key, out);
    return out;
  };

  const tokens = new Set(Object.keys(tc.kode));
  return {
    palette,
    mode,
    depth,
    style,
    codeStyle: (token, italic) => ({ fg: (tokens.has(token) ? `kode.${token}` : 'kode_tekst') as ColorRole, bg: 'kode_bg', ...(italic ? { italic: true } : {}) }),
  };
}

/** Lys eller mørk fra terminalens svar på OSC 11 (`rgb:RRRR/GGGG/BBBB`), ellers `null`. */
export function modeFromOsc11(reply: string): ThemeMode | null {
  const m = /rgb:([0-9a-f]+)\/([0-9a-f]+)\/([0-9a-f]+)/i.exec(reply);
  if (!m) return null;
  const channel = (h: string) => Number.parseInt(h, 16) / (16 ** h.length - 1);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((h) => lin(channel(h)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.18 ? 'light' : 'dark';
}
