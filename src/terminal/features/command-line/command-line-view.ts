// Tegning av `:`-linjen (designsystem-terminal §5.3): linjen erstatter statuslinjen, fullføringen står i et
// flytevindu rett over, feil vises vim-stil på to rader nederst.

import type { ArgumentError, PaletteOption } from '../../../core/commands';
import { graphemes, textWidth, type Frame } from '../cells';
import { createCanvas } from '../draw';
import { paintFloat } from '../overlays/help';
import { gridFor } from '../slides';
import type { StyleSpec, TerminalTheme } from '../theme';
import type { CommandLineState } from './command-line';

const MAX_ROWS = 8;

function optionTexts(o: PaletteOption): [string, string] {
  if (o.kind === 'argument') return [`${o.ex} ${o.value.label}${o.current ? ' •' : ''}`, o.value.description ?? ''];
  return [`${o.ex}${o.argumentLabel ? ` ‹${o.argumentLabel}›` : ''}`, o.state ? `${o.name} · ${o.state}` : o.name];
}

/** Tegner linjen og fullføringen over `frame` (lysbildet står urørt). */
export function paintCommandLine(frame: Frame, theme: TerminalTheme, state: CommandLineState, options: readonly PaletteOption[]): Frame {
  const canvas = createCanvas(frame, theme, 'bg', false);
  const grid = gridFor(frame.cols, frame.rows);
  const y = frame.rows - 1;
  canvas.fill(0, y, frame.cols, 1, 'bg');
  canvas.put(grid.x - 1, y, ':', { fg: 'aksent', bold: true });
  const chars = graphemes(state.text);
  const before = chars.slice(0, state.cursor).join('');
  const at = chars[state.cursor] ?? ' ';
  let x = canvas.put(grid.x, y, before, {});
  x = canvas.put(x, y, at, { fg: 'bg', bg: 'invertert_bg' });
  canvas.put(x, y, chars.slice(state.cursor + 1).join(''), {});
  if (options.length === 0) return frame;
  const shown = options.slice(0, MAX_ROWS);
  const top = Math.max(0, Math.min(state.selected - MAX_ROWS + 1, options.length - MAX_ROWS));
  const rows = options.slice(top, top + MAX_ROWS).map(optionTexts);
  const left = Math.max(...rows.map(([a]) => textWidth(a)));
  const w = Math.min(grid.sats, Math.max(30, left + 4 + Math.max(...rows.map(([, b]) => textWidth(b))) + 4));
  const h = shown.length + 2;
  const fx = grid.x - 2;
  const fy = y - h;
  paintFloat(canvas, fx, fy, w, h, 'Kommandoer', 'Tab');
  rows.forEach(([a, b], k) => {
    const selected = top + k === state.selected;
    const base: StyleSpec = selected ? { fg: 'markor_tekst', bg: 'markor_bg' } : { bg: 'flate_bg' };
    if (selected) canvas.fill(fx + 1, fy + 1 + k, w - 2, 1, 'markor_bg');
    canvas.put(fx + 2, fy + 1 + k, a, { ...base, bold: true }, fx + w - 2);
    canvas.put(fx + 4 + left, fy + 1 + k, b, selected ? base : { ...base, fg: 'dempet' }, fx + w - 2);
  });
  return frame;
}

/** Feil vim-stil: lett strek, `E475:` fet i `feil` med kortmeldingen, forklaringen dempet og «trykk en tast». */
export function paintCommandError(frame: Frame, theme: TerminalTheme, error: ArgumentError): Frame {
  const canvas = createCanvas(frame, theme, 'bg', false);
  const grid = gridFor(frame.cols, frame.rows);
  const y = frame.rows - 2;
  canvas.fill(0, y - 1, frame.cols, 3, 'bg');
  canvas.put(0, y - 1, '─'.repeat(frame.cols), { fg: 'dekor' });
  const x = canvas.put(grid.x - 1, y, `${error.code}:`, { fg: 'feil', bold: true });
  canvas.put(x + 1, y, error.title, {}, grid.x + grid.sats);
  const press = 'trykk en tast';
  canvas.put(grid.x - 1, y + 1, error.detail, { fg: 'dempet' }, grid.x + grid.sats - textWidth(press) - 2);
  canvas.put(grid.x + grid.sats - textWidth(press), y + 1, press, { fg: 'dempet' });
  return frame;
}

/** Kort bekreftelse dempet nederst (2 s), f.eks. «Lysbildenivå h3 · ikke lagret». */
export function paintNotice(frame: Frame, theme: TerminalTheme, text: string): Frame {
  const canvas = createCanvas(frame, theme, 'bg', false);
  const grid = gridFor(frame.cols, frame.rows);
  const y = frame.rows - 1;
  canvas.fill(0, y, frame.cols, 1, 'linje_bg');
  canvas.put(grid.x, y, text, { fg: 'dempet', bg: 'linje_bg' }, grid.x + grid.sats);
  return frame;
}
