// Oppstartsskjermen (AR-3-07 M3, designsystem-terminal §5.6): én linje midt på med fremdrift. Ingen spinner.
// PO-116: hintet om `Ctrl +` står her ved brede terminaler (før første lysbilde), aldri på tittelsiden.

import { PLAIN, createFrame, textWidth, writeText, type CellStyle, type Frame } from '../cells';
import type { TerminalSize } from '../screen';

export interface StartupProgress {
  readonly done: number;
  readonly total: number | null;
}

/** Over så mange kolonner blir teksten liten i delte vinduer (designsystem-terminal §1.4). */
export const LARGE_TEXT_HINT_COLS = 160;

const MUTED: CellStyle = { ...PLAIN, dim: true };

const number = new Intl.NumberFormat('nb-NO');

export function startupView(size: TerminalSize, progress: StartupProgress): Frame {
  const frame = createFrame(size.cols, size.rows);
  const label = 'Leser vaultet …  ';
  const count = progress.total === null ? '' : `${number.format(progress.done)} / ${number.format(progress.total)}`;
  const y = Math.floor(size.rows / 2);
  const x = Math.max(0, Math.floor((size.cols - textWidth(label + count)) / 2));
  writeText(frame, writeText(frame, x, y, label, MUTED), y, count, PLAIN);
  if (size.cols > LARGE_TEXT_HINT_COLS) {
    const hint = `${size.cols} × ${size.rows}: Ctrl + gir større tekst i Teams og Zoom`;
    writeText(frame, Math.max(0, Math.floor((size.cols - textWidth(hint)) / 2)), y + 2, hint, MUTED);
  }
  return frame;
}
