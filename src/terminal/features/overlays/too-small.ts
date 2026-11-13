// «Terminalen er for liten» (designsystem-terminal §5.7, AK-3-11). Midtstilt, uten krom og uten lysbildeinnhold.

import { PLAIN, createFrame, textWidth, writeText, type CellStyle, type Frame } from '../cells';
import type { TerminalSize } from '../screen';

/** Minste terminalstørrelse (v3 «Tilpasning»). */
export const MIN_SIZE: TerminalSize = { cols: 80, rows: 24 };

export function isTooSmall(size: TerminalSize): boolean {
  return size.cols < MIN_SIZE.cols || size.rows < MIN_SIZE.rows;
}

const STRONG: CellStyle = { ...PLAIN, bold: true };
const MUTED: CellStyle = { ...PLAIN, dim: true };

/** Ordbryting til `width` (ord lengre enn linjen deles). */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (textWidth(candidate) <= width) line = candidate;
    else {
      if (line !== '') lines.push(line);
      line = word;
      while (textWidth(line) > width) {
        lines.push([...line].slice(0, width).join(''));
        line = [...line].slice(width).join('');
      }
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

export function tooSmallView(size: TerminalSize): Frame {
  const frame = createFrame(size.cols, size.rows);
  const need = `${MIN_SIZE.cols} × ${MIN_SIZE.rows}`;
  const blocks: Array<{ text: string; style: CellStyle; gap?: boolean }> =
    size.cols < 20
      ? [{ text: `${MIN_SIZE.cols}×${MIN_SIZE.rows}`, style: STRONG }]
      : [
          { text: 'Terminalen er for liten', style: STRONG },
          { text: `${size.cols} × ${size.rows}  –  presentasjonen trenger minst ${need}`, style: STRONG, gap: true },
          ...(size.cols >= 40
            ? [
                { text: 'Gjør vinduet større eller skriften mindre (Ctrl -).', style: MUTED, gap: true },
                { text: 'Lysbildet tegnes straks det er plass.  q avslutter', style: MUTED },
              ]
            : []),
        ];
  const width = Math.max(1, size.cols - 2);
  const lines: Array<{ text: string; style: CellStyle }> = [];
  for (const b of blocks) {
    if (b.gap && lines.length > 0) lines.push({ text: '', style: MUTED });
    for (const l of wrap(b.text, width)) lines.push({ text: l, style: b.style });
  }
  const shown = lines.slice(0, size.rows);
  const top = Math.max(0, Math.floor((size.rows - shown.length) / 2));
  shown.forEach((l, i) => writeText(frame, Math.max(0, Math.floor((size.cols - textWidth(l.text)) / 2)), top + i, l.text, l.style));
  return frame;
}
