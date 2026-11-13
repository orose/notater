// Tegning av notatlisten (designsystem-terminal §5.5). Foreløpig uten palettfarger (slice 3-b gir temaet).

import { PLAIN, createFrame, textWidth, writeText, type CellStyle, type Frame } from '../cells';
import type { PickerState } from './picker-state';

export interface PickerViewOptions {
  readonly vaultName: string;
}

const MUTED: CellStyle = { ...PLAIN, dim: true };
const STRONG: CellStyle = { ...PLAIN, bold: true };
const CURSOR: CellStyle = { ...PLAIN, inverse: true };
const HIT: CellStyle = { ...PLAIN, bold: true, underline: true };

/** Rader i listen ved en gitt høyde (resten er overlinje, søk, strek og statuslinje). */
export function pickerRows(rows: number): number {
  return Math.max(1, rows - 5);
}

const dateFormat = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });

function writeHighlighted(frame: Frame, x: number, y: number, text: string, ranges: ReadonlyArray<readonly [number, number]>, base: CellStyle, hit: CellStyle, maxX: number): number {
  let col = x;
  let pos = 0;
  for (const [start, end] of ranges) {
    col = writeText(frame, col, y, text.slice(pos, start), base, maxX);
    col = writeText(frame, col, y, text.slice(start, end), hit, maxX);
    pos = end;
  }
  return writeText(frame, col, y, text.slice(pos), base, maxX);
}

export function pickerView(state: PickerState, cols: number, rows: number, options: PickerViewOptions): Frame {
  const frame = createFrame(cols, rows);
  const margin = Math.max(2, Math.round(cols * 0.067) - 2);
  const right = cols - margin;
  let x = writeText(frame, margin, 0, '~/ ', STRONG);
  x = writeText(frame, x, 0, options.vaultName, MUTED);
  writeText(frame, x, 0, ' · velg notatet du vil presentere', MUTED);

  const count = `${state.results.length} / ${state.notes.length}`;
  writeText(frame, right - textWidth(count), 1, count, MUTED);
  x = writeText(frame, margin, 1, '/', STRONG);
  x = writeText(frame, x, 1, state.query, STRONG, right - textWidth(count) - 1);
  writeText(frame, x, 1, ' ', CURSOR);
  writeText(frame, margin, 2, '─'.repeat(Math.max(0, right - margin)), MUTED);

  const visible = pickerRows(rows);
  const top = Math.max(0, Math.min(state.cursor - Math.floor(visible / 2), state.results.length - visible));
  const nameWidth = Math.min(48, Math.floor((right - margin) * 0.45));
  state.results.slice(top, top + visible).forEach((hit, i) => {
    const y = 3 + i;
    const selected = top + i === state.cursor;
    if (selected) {
      for (let c = margin; c < right; c++) writeText(frame, c, y, ' ', CURSOR);
      writeText(frame, margin - 2, y, '▌', STRONG);
    }
    writeHighlighted(frame, margin, y, hit.note.title, hit.titleRanges, selected ? { ...CURSOR, bold: true } : STRONG, selected ? { ...CURSOR, bold: true, underline: true } : HIT, margin + nameWidth - 1);
    const date = dateFormat.format(new Date(hit.note.mtimeMs));
    const folder = hit.note.docPath.includes('/') ? hit.note.docPath.slice(0, hit.note.docPath.lastIndexOf('/') + 1) : '';
    writeText(frame, margin + nameWidth + 1, y, folder, selected ? CURSOR : MUTED, right - textWidth(date) - 2);
    writeText(frame, right - textWidth(date), y, date, selected ? CURSOR : MUTED);
  });
  if (state.results.length === 0) writeText(frame, margin, 3, 'Ingen notater treffer søket.', MUTED);

  const status = '↑ ↓ flytter · ↵ presenterer · Esc avslutter';
  writeText(frame, margin, rows - 1, 'Notater', MUTED);
  writeText(frame, Math.max(margin + 10, right - textWidth(status)), rows - 1, status, MUTED);
  return frame;
}
