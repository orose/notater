// Tabeller som booktabs (designsystem-terminal §4.6, AR-3-15): tung strek over og under, lett under hodet, ingen
// loddrette streker. For bred: avstand 3 → 2 → 1 med `│` → krymp og bryt celletekst → kortvisning. Horisontal
// overflyt deler aldri et lysbilde.

import { textWidth } from '../cells';
import type { StyleSpec } from '../theme';
import { wrapRuns } from './inline';
import { rowOf, runsWidth, type Row, type Run } from './rows';

export type Align = 'left' | 'right' | 'center';

export interface TableModel {
  readonly header: readonly Run[][];
  readonly rows: readonly (readonly Run[][])[];
  readonly align: readonly Align[];
  /** Grupper (Bases): mellomoverskrift før radindeksen. */
  readonly groups?: ReadonlyArray<{ readonly before: number; readonly label: string }>;
}

const HEAVY: StyleSpec = { fg: 'strek' };
const HEAD: StyleSpec = { fg: 'dempet', bold: true };

function longestWord(cell: readonly Run[]): number {
  return Math.max(0, ...cell.map((r) => r.text).join('').split(/\s+/).map(textWidth));
}

function place(x: number, width: number, align: Align, runs: readonly Run[]): Row['segs'] {
  const w = runsWidth(runs);
  const dx = align === 'right' ? width - w : align === 'center' ? Math.floor((width - w) / 2) : 0;
  return rowOf(x + Math.max(0, dx), runs).segs;
}

/** Tabell i høyst `maxWidth` kolonner. `minWidth` (Bases-hodet) gir overskuddet til første kolonne. */
export function layoutTable(model: TableModel, maxWidth: number, minWidth = 0): Row[] {
  const cols = Math.max(model.header.length, ...model.rows.map((r) => r.length));
  const cell = (row: readonly Run[][], c: number): Run[] => row[c] ?? [];
  const natural = Array.from({ length: cols }, (_, c) => Math.max(runsWidth(cell(model.header, c)), ...model.rows.map((r) => runsWidth(cell(r, c)))));
  const total = (widths: readonly number[], gap: number) => widths.reduce((a, b) => a + b, 0) + gap * (cols - 1);

  let gap = 3;
  let widths = [...natural];
  let rule = false;
  if (total(widths, 3) > maxWidth) gap = 2;
  if (total(widths, gap) > maxWidth) {
    gap = 1; // smal avstand: én kolonne med lett `│` som skille
    rule = true;
  }
  if (total(widths, gap) > maxWidth) {
    const min = natural.map((n, c) => Math.min(n, Math.max(6, Math.min(12, Math.max(longestWord(cell(model.header, c)), ...model.rows.map((r) => longestWord(cell(r, c))))))));
    if (total(min, gap) > maxWidth) return cardView(model, maxWidth);
    // Krymp de bredeste tekstkolonnene proporsjonalt ned mot minimum.
    let excess = total(widths, gap) - maxWidth;
    while (excess > 0) {
      const slack = widths.map((w, c) => w - min[c]!);
      const room = slack.reduce((a, b) => a + b, 0);
      if (room <= 0) break;
      widths = widths.map((w, c) => w - Math.min(slack[c]!, Math.ceil((excess * slack[c]!) / room)));
      excess = total(widths, gap) - maxWidth;
    }
  }
  const tableWidth0 = total(widths, gap);
  if (minWidth > tableWidth0 && cols > 0) widths[0]! += Math.min(minWidth, maxWidth) - tableWidth0;
  const width = total(widths, gap);

  const lineRows = (row: readonly Run[][], styleOf: (r: Run) => Run): Row[] => {
    const wrapped = widths.map((w, c) => wrapRuns(cell(row, c).map(styleOf), w));
    const height = Math.max(1, ...wrapped.map((w) => w.length));
    const out: Row[] = [];
    for (let k = 0; k < height; k++) {
      const segs: Row['segs'][number][] = [];
      let x = 0;
      widths.forEach((w, c) => {
        if (rule && c > 0) segs.push({ x: x - 1, text: '│', style: { fg: 'dekor' } });
        segs.push(...place(x, w, model.align[c] ?? 'left', wrapped[c]![k] ?? []));
        x += w + gap;
      });
      out.push({ segs });
    }
    return out;
  };

  const rows: Row[] = [{ segs: [{ x: 0, text: '━'.repeat(width), style: HEAVY }] }];
  rows.push(...lineRows(model.header, (r) => ({ ...r, style: { ...HEAD, ...r.style, fg: 'dempet', bold: true } })));
  rows.push({ segs: [{ x: 0, text: '─'.repeat(width), style: HEAVY }] });
  model.rows.forEach((row, i) => {
    const group = model.groups?.find((g) => g.before === i);
    if (group) rows.push({ segs: [{ x: 0, text: group.label, style: { fg: 'tekst', bold: true } }] });
    rows.push(...lineRows(row, (r) => r));
  });
  rows.push({ segs: [{ x: 0, text: '━'.repeat(width), style: HEAVY }] });
  return rows;
}

/** Kortvisning: hver rad som en blokk med `Kolonne  verdi`, adskilt av en lett strek. */
function cardView(model: TableModel, maxWidth: number): Row[] {
  const keys = model.header.map((h) => h.map((r) => r.text).join(''));
  const kw = Math.min(Math.max(0, ...keys.map(textWidth)), Math.floor(maxWidth / 3));
  const rows: Row[] = [];
  model.rows.forEach((row, i) => {
    if (i > 0) rows.push({ segs: [{ x: 0, text: '─'.repeat(Math.min(maxWidth, kw + 24)), style: { fg: 'dekor' } }] });
    keys.forEach((key, c) => {
      const lines = wrapRuns(row[c] ?? [], Math.max(8, maxWidth - kw - 2));
      lines.forEach((l, k) => rows.push({ segs: [...(k === 0 ? [{ x: 0, text: key.slice(0, kw), style: { fg: 'dempet' } as StyleSpec }] : []), ...rowOf(kw + 2, l).segs] }));
    });
  });
  return [{ segs: [{ x: 0, text: '━'.repeat(Math.min(maxWidth, kw + 24)), style: HEAVY }] }, ...rows, { segs: [{ x: 0, text: '━'.repeat(Math.min(maxWidth, kw + 24)), style: HEAVY }] }];
}
