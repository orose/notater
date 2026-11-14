// Oppstartsskjermen (AR-3-07 M3, designsystem-terminal §5.6): én linje midt på med fremdrift. Ingen spinner.
// PO-116: hintet om `Ctrl +` står her ved brede terminaler (før første lysbilde), aldri på tittelsiden.

import { createFrame, textWidth, type Frame } from '../cells';
import { createCanvas } from '../draw';
import type { TerminalSize } from '../screen';
import type { TerminalTheme } from '../theme';

export interface StartupProgress {
  readonly done: number;
  readonly total: number | null;
}

/** Over så mange kolonner blir teksten liten i delte vinduer (designsystem-terminal §1.4). */
export const LARGE_TEXT_HINT_COLS = 160;

const number = new Intl.NumberFormat('nb-NO');

export function startupView(size: TerminalSize, progress: StartupProgress, theme: TerminalTheme): Frame {
  const frame = createFrame(size.cols, size.rows);
  const canvas = createCanvas(frame, theme);
  const label = 'Leser vaultet …  ';
  const count = progress.total === null ? '' : `${number.format(progress.done)} / ${number.format(progress.total)}`;
  const y = Math.floor(size.rows / 2);
  const x = Math.max(0, Math.floor((size.cols - textWidth(label + count)) / 2));
  canvas.put(canvas.put(x, y, label, { fg: 'dempet' }), y, count, { fg: 'tekst' });
  if (size.cols > LARGE_TEXT_HINT_COLS) {
    const hint = `${size.cols} × ${size.rows}: Ctrl + gir større tekst i Teams og Zoom`;
    canvas.put(Math.max(0, Math.floor((size.cols - textWidth(hint)) / 2)), y + 2, hint, { fg: 'dempet' });
  }
  return frame;
}
