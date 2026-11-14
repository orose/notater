// Tegning av notatlisten (designsystem-terminal §5.5): overlinje, søkefelt med `/`, liste med navn · sti · dato,
// markørrad ensfarget med `▌`, fuzzy-treff fet og understreket, statuslinje.

import { createFrame, textWidth, type Frame } from '../cells';
import { createCanvas, type Canvas } from '../draw';
import type { StyleSpec, TerminalTheme } from '../theme';
import type { PickerState } from './picker-state';

export interface PickerViewOptions {
  readonly vaultName: string;
  readonly theme: TerminalTheme;
}

/** Rader i listen ved en gitt høyde (resten er overlinje, søk, strek og statuslinje). */
export function pickerRows(rows: number): number {
  return Math.max(1, rows - 5);
}

const dateFormat = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });

function highlighted(canvas: Canvas, x: number, y: number, text: string, ranges: ReadonlyArray<readonly [number, number]>, base: StyleSpec, hit: StyleSpec, maxX: number): number {
  let col = x;
  let pos = 0;
  for (const [start, end] of ranges) {
    col = canvas.put(col, y, text.slice(pos, start), base, maxX);
    col = canvas.put(col, y, text.slice(start, end), hit, maxX);
    pos = end;
  }
  return canvas.put(col, y, text.slice(pos), base, maxX);
}

export function pickerView(state: PickerState, cols: number, rows: number, options: PickerViewOptions): Frame {
  const frame = createFrame(cols, rows);
  const canvas = createCanvas(frame, options.theme);
  const margin = Math.max(4, Math.round(cols * 0.067));
  const right = cols - margin;
  let x = canvas.put(margin, 0, '~/ ', { fg: 'aksent', bold: true });
  x = canvas.put(x, 0, options.vaultName, { fg: 'dempet' });
  canvas.put(x, 0, ' · velg notatet du vil presentere', { fg: 'dempet' });

  const count = `${state.results.length} / ${state.notes.length}`;
  canvas.put(right - textWidth(count), 1, count, { fg: 'dempet' });
  x = canvas.put(margin, 1, '/', { fg: 'aksent', bold: true });
  x = canvas.put(x, 1, state.query, { bold: true }, right - textWidth(count) - 2);
  canvas.put(x, 1, ' ', { fg: 'bg', bg: 'invertert_bg' });
  canvas.put(margin, 2, '─'.repeat(Math.max(0, right - margin)), { fg: 'dekor' });

  const visible = pickerRows(rows);
  const top = Math.max(0, Math.min(state.cursor - Math.floor(visible / 2), state.results.length - visible));
  const nameWidth = Math.min(48, Math.floor((right - margin) * 0.45));
  state.results.slice(top, top + visible).forEach((hit, i) => {
    const y = 3 + i;
    const selected = top + i === state.cursor;
    const bg = selected ? ({ bg: 'markor_bg' } as const) : {};
    if (selected) {
      canvas.fill(margin - 1, y, right - margin + 2, 1, 'markor_bg');
      canvas.put(margin - 2, y, '▌', { fg: 'fokus' });
    }
    // Markørraden er ensfarget (designsystem-terminal §6.1); treff fet og understreket.
    const name: StyleSpec = selected ? { ...bg, fg: 'markor_tekst', bold: true } : { fg: 'tekst', bold: true };
    const hitStyle: StyleSpec = selected ? { ...bg, fg: 'markor_tekst', bold: true, underline: true } : { fg: 'aksent', bold: true, underline: true, underlineColor: 'aksent' };
    highlighted(canvas, margin, y, hit.note.title, hit.titleRanges, name, hitStyle, margin + nameWidth - 1);
    const date = dateFormat.format(new Date(hit.note.mtimeMs));
    const folder = hit.note.docPath.includes('/') ? hit.note.docPath.slice(0, hit.note.docPath.lastIndexOf('/') + 1) : '';
    const muted: StyleSpec = selected ? { ...bg, fg: 'markor_tekst' } : { fg: 'dempet' };
    canvas.put(margin + nameWidth + 1, y, folder, muted, right - textWidth(date) - 2);
    canvas.put(right - textWidth(date), y, date, muted);
  });
  if (state.results.length === 0) canvas.put(margin, 3, 'Ingen notater treffer søket.', { fg: 'dempet' });

  canvas.fill(0, rows - 1, cols, 1, 'linje_bg');
  canvas.put(margin, rows - 1, 'Notater', { fg: 'dempet', bg: 'linje_bg' });
  const keys: Array<[string, string]> = [
    ['↑ ↓', 'flytter'],
    ['↵', 'presenterer'],
    ['Esc', 'avslutter'],
  ];
  const hint = keys.flatMap(([k, l], i) => [...(i > 0 ? [['  ·  ', 'd'] as const] : []), [k, 'k'] as const, [` ${l}`, 'd'] as const]);
  const hw = hint.reduce((w, [t]) => w + textWidth(t), 0);
  let hx = Math.max(margin + 10, right - hw);
  for (const [t, kind] of hint) hx = canvas.put(hx, rows - 1, t, kind === 'k' ? { fg: 'tekst', bold: true, bg: 'linje_bg' } : { fg: 'dempet', bg: 'linje_bg' });
  return frame;
}
