// Kromet: agendalinjen (vim-tabline, §2.5) og statuslinjen (vim-statusline, §2.7).

import type { Slide, SlideDeck } from '../../../core/presentation';
import { textWidth } from '../cells';
import { type Canvas, type Run } from '../draw';
import type { StyleSpec } from '../theme';
import type { Grid } from './grid';

function shorten(text: string, max: number): string {
  if (textWidth(text) <= max) return text;
  let out = '';
  for (const ch of text) {
    if (textWidth(out + ch) > Math.max(1, max - 1)) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

interface Tab {
  readonly text: string;
  /** Agendapunktets indeks, `null` = «…». */
  readonly index: number | null;
}

/** Agendalinjen på innholdslysbilder med agendapunkt (T6). Avkortes i fem trinn (Q-3-02). */
export function paintAgendaLine(canvas: Canvas, grid: Grid, deck: SlideDeck, slide: Slide): void {
  canvas.fill(0, 0, grid.cols, 1, 'linje_bg');
  const current = slide.agendaIndex;
  if (current === null) return;
  const names = deck.agenda.map((a) => a.text);
  const progress = slide.progress ? `${slide.progress.index}/${slide.progress.count}` : '';
  const build = (idx: number[], neighbour?: number, cur?: number): Tab[] => {
    const tabs: Tab[] = [];
    if ((idx[0] ?? 0) > 0) tabs.push({ text: '…', index: null });
    for (const i of idx) {
      let t = names[i] ?? '';
      if (i !== current && neighbour) t = shorten(t, neighbour);
      if (i === current && cur) t = shorten(t, cur);
      tabs.push({ text: t, index: i });
    }
    if ((idx.at(-1) ?? 0) < names.length - 1) tabs.push({ text: '…', index: null });
    return tabs;
  };
  const length = (tabs: Tab[]) =>
    tabs.reduce((n, t) => n + 1 + (t.index === null ? textWidth(t.text) + 2 : String(t.index + 1).length + 1 + textWidth(t.text) + 2 + (t.index === current ? progress.length + 1 : 0)), 0);
  const all = names.map((_, i) => i);
  const near = [current - 1, current, current + 1].filter((i) => i >= 0 && i < names.length);
  const candidates = [build(all), build(near), build(near, 14), build(near, 8, Math.floor(grid.sats / 3)), build([current], undefined, grid.sats - 16)];
  const tabs = candidates.find((c) => length(c) <= grid.sats) ?? candidates.at(-1)!;
  let x = grid.x - 1;
  tabs.forEach((t, k) => {
    if (k > 0) x = canvas.put(x, 0, '│', { fg: 'dekor', bg: 'linje_bg' });
    if (t.index === null) {
      x = canvas.put(x, 0, ' … ', { fg: 'dempet', bg: 'linje_bg' });
      return;
    }
    if (t.index === current) {
      // Valgt fane står på lerretet (vims TabLineSel): nummer i aksent, navn fet med aksentstrek, progresjon dempet.
      x = canvas.put(x, 0, ' ', { bg: 'bg' });
      x = canvas.put(x, 0, `${t.index + 1} `, { fg: 'aksent', bg: 'bg', bold: true });
      x = canvas.put(x, 0, t.text, { fg: 'tekst', bg: 'bg', bold: true, underline: true, underlineColor: 'aksent' });
      x = canvas.put(x, 0, ` ${progress} `, { fg: 'dempet', bg: 'bg' });
    } else x = canvas.put(x, 0, ` ${t.index + 1} ${t.text} `, { fg: 'dempet', bg: 'linje_bg' });
  });
}

/** Fremdrift: `━` til og med gjeldende, `─` for resten, mellomrom mellom seksjoner (tittel og agenda er første gruppe). */
export function progressRuns(deck: SlideDeck, index: number): Run[] {
  const out: Run[] = [];
  let previous: number | null | undefined;
  deck.slides.forEach((s, i) => {
    const group = s.kind === 'title' || s.kind === 'agenda' ? -1 : (s.agendaIndex ?? -1);
    if (previous !== undefined && group !== previous) out.push({ text: ' ', style: {} });
    previous = group;
    out.push(i <= index ? { text: '━', style: { fg: 'fremdrift' } } : { text: '─', style: { fg: 'fremdrift_spor' } });
  });
  return out;
}

function hintRuns(keys: ReadonlyArray<readonly [string, string]>): Run[] {
  const dim: StyleSpec = { bg: 'linje_bg', fg: 'dempet' };
  const key: StyleSpec = { bg: 'linje_bg', fg: 'tekst', bold: true };
  return keys.flatMap(([k, label], i): Run[] => [...(i > 0 ? [{ text: '  ·  ', style: dim }] : []), { text: k, style: key }, { text: ` ${label}`, style: dim }]);
}

const width = (runs: readonly Run[]) => runs.reduce((w, r) => w + textWidth(r.text), 0);

export interface StatusOptions {
  /** Merke helt til venstre (` OVERSIKT `). */
  readonly mode?: string;
  /** Overstyr tastehintet. */
  readonly hint?: ReadonlyArray<readonly [string, string]>;
  /** Kort melding (bekreftelse, live) i stedet for tittel og hint; fremdrift og folio står (§5.3, §5.6). */
  readonly notice?: string;
}

/** Statuslinjen. Tittelsiden har bare starthintet, ingen folio eller fremdrift (PO-95). */
export function paintStatusLine(canvas: Canvas, grid: Grid, deck: SlideDeck, index: number, options: StatusOptions = {}): void {
  const y = grid.status;
  canvas.fill(0, y, grid.cols, 1, 'linje_bg');
  const L: StyleSpec = { bg: 'linje_bg' };
  let x = grid.x - 1;
  if (options.mode) x = canvas.put(x, y, ` ${options.mode} `, { fg: 'invertert_tekst', bg: 'aksent', bold: true }) + 1;
  const right = grid.x + grid.sats;
  const slide = deck.slides[index];
  if (slide?.kind === 'title' && !options.mode) {
    canvas.put(x + 1, y, 'Presentasjon', { ...L, fg: 'tekst', bold: true });
    const hint = hintRuns([
      ['→', 'neste'],
      ['o', 'oversikt'],
      ['?', 'taster'],
      ['q', 'avslutt'],
    ]);
    if (right - width(hint) > x + 16) canvas.runs(right - width(hint), y, hint);
    return;
  }
  const titleEnd = options.notice ? x : canvas.put(x + 1, y, deck.title, { ...L, fg: 'dempet' }, right - 8);
  const folio: Run[] = [
    { text: String(index + 1), style: { ...L, fg: 'tekst', bold: true } },
    { text: `/${deck.slides.length}`, style: { ...L, fg: 'dempet' } },
  ];
  const fw = width(folio);
  canvas.runs(right - fw, y, folio);
  const bar = progressRuns(deck, index).map((r) => ({ ...r, style: { ...L, ...r.style } }));
  const bx = right - fw - 2 - width(bar);
  if (options.notice) canvas.put(x + 1, y, options.notice, { ...L, fg: 'tekst' }, (bx > x + 20 ? bx : right - fw) - 3);
  if (bx <= titleEnd + 2) return;
  canvas.runs(bx, y, bar);
  if (options.notice) return;
  const keys = options.hint ?? (grid.sats >= 100 ? ([['j k', 'blar'], ['o', 'oversikt'], [':', 'kommando'], ['?', 'hjelp']] as const) : ([['?', 'hjelp']] as const));
  const hint = hintRuns(keys);
  const hx = bx - 3 - width(hint);
  if (hx > titleEnd + 2) canvas.runs(hx, y, hint);
}
