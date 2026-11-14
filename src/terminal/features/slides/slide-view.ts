// Lysbildet i terminalen (designsystem-terminal §2): tittel, agenda, overgang med «du er her» og innhold med
// agendalinje, nummer, tittelstrek, blokker og fotnoter. Rammen males helt med `bg` (§10).

import type { ElementContent } from 'hast';
import type { NoteDocument, PropertyEntry, VaultValue } from '../../../shared/api-types';
import { formatDate, formatDateTime, ingressOf, statusKind } from '../../../core/format';
import { CONTINUED_SUFFIX, type Slide, type SlideDeck, type SlideUnit } from '../../../core/presentation';
import { createFrame, textWidth, type Frame } from '../cells';
import { EMPTY_ROW, createCanvas, inlineRuns, layoutBlocks, layoutNode, paintRows, rowOf, superscript, wrapRuns, type BlockContext, type Canvas, type Row, type Run } from '../draw';
import { chooseHeader, drawnHeight, type Header } from '../figlet';
import type { StyleSpec, TerminalTheme } from '../theme';
import { paintAgendaLine, paintStatusLine } from './chrome';
import { gridFor, type Grid } from './grid';

export interface SlideViewContext {
  readonly deck: SlideDeck;
  readonly doc: NoteDocument;
  readonly theme: TerminalTheme;
  /** Vaultnavnet i `obsidian://`-lenker (PO-117). */
  readonly obsidianVault: string;
}

export interface SlideViewOptions {
  readonly blackout?: boolean;
  /** Rulleposisjonen i en for stor blokk (linjer, PO-94/§4.5). Begrenses til blokken. */
  readonly scroll?: number;
  /** Kort melding i statuslinjen (bekreftelse, live endring). */
  readonly notice?: string | null;
}

export function blockContext(ctx: SlideViewContext, grid: Grid): BlockContext {
  return {
    theme: ctx.theme,
    inline: { obsidianVault: ctx.obsidianVault, plainInlineCode: ctx.theme.depth === 'ansi16' || ctx.theme.depth === 'none' },
    doc: ctx.doc,
    sats: grid.sats,
    maal: grid.maal,
  };
}

/** Én enhet: listepunkter tegnes med listens markør og start (A2-deler beholder `start`). */
export function unitRows(unit: SlideUnit, ctx: BlockContext): Row[] {
  const node = unit.node;
  if (node.type !== 'element') return layoutBlocks([node], ctx);
  if (unit.list) {
    const list = { type: 'element' as const, tagName: unit.list.tagName, properties: { ...unit.list.properties, start: Number(unit.list.properties.start ?? 1) + unit.list.index }, children: [node] };
    return layoutNode(list, ctx);
  }
  return layoutNode(node, ctx);
}

/** Innholdet i rekkefølge: én tom rad mellom blokker, ingen mellom punkter i samme liste. */
export function bodyRows(units: readonly SlideUnit[], ctx: BlockContext): Row[] {
  const out: Row[] = [];
  units.forEach((unit, i) => {
    const rows = unitRows(unit, ctx);
    if (rows.length === 0) return;
    const sameList = i > 0 && unit.listKey !== null && units[i - 1]?.listKey === unit.listKey;
    if (out.length > 0 && !sameList) out.push(EMPTY_ROW);
    out.push(...rows);
  });
  return out;
}

/** Figlet-hodet, eller fet aksenttekst med tung strek under (trinn 4). Returnerer neste rad. */
function paintHeader(canvas: Canvas, grid: Grid, x: number, y: number, text: string, header: Header): number {
  if (header.kind === 'text') {
    const lines = wrapRuns([{ text, style: { fg: 'aksent', bold: true } }], grid.sats);
    for (const l of lines) canvas.runs(x, y++, l);
    const w = Math.min(grid.sats, Math.max(...lines.map((l) => textWidth(l.map((r) => r.text).join('')))));
    canvas.put(x, y++, '━'.repeat(w), { fg: 'aksent' });
    return y;
  }
  header.blocks.forEach((block, b) => {
    if (b > 0) y += 1;
    for (const row of block) {
      [...row].forEach((ch, i) => {
        if (ch !== ' ') canvas.put(x + i, y, ch, { fg: '█▀▄▌▐'.includes(ch) ? 'hode' : 'hode_skygge' });
      });
      y += 1;
    }
  });
  return y;
}

function textHeaderLines(text: string, grid: Grid): number {
  return wrapRuns([{ text, style: {} }], grid.sats).length;
}

// ------------------------------------------------------------------------------------- tittel

const HIDDEN_ON_TITLE = new Set(['tags', 'tag', 'aliases', 'alias', 'cssclasses', 'cssclass', 'publish', 'position', 'title', 'description', 'summary']);

function propertyRuns(value: VaultValue, key: string, ctx: BlockContext): Run[] {
  switch (value.type) {
    case 'null':
      return [{ text: 'ikke satt', style: { fg: 'dempet', italic: true } }];
    case 'date':
      return [{ text: formatDate(value.value, value.hasTime), style: {} }];
    case 'boolean':
      return [{ text: value.value ? '✓ ja' : '– nei', style: {} }];
    case 'number':
      return [{ text: new Intl.NumberFormat('nb-NO').format(value.value), style: {} }];
    case 'tag':
      return [{ text: `#${value.value}`, style: { fg: 'aksent2' } }];
    case 'link':
      return value.target
        ? inlineRuns([{ type: 'element', tagName: 'a', properties: { dataVrLink: 'internal', dataVrTarget: value.target }, children: [{ type: 'text', value: value.display }] }], ctx.inline)
        : [{ text: value.display, style: { fg: 'lenke_brutt', underline: true, dotted: true } }];
    case 'list':
      return value.value.flatMap((v, i) => [...(i > 0 ? [{ text: ', ', style: {} }] : []), ...propertyRuns(v, key, ctx)]);
    case 'string': {
      if (/status/i.test(key)) {
        const kind = statusKind(value.value);
        if (kind === 'done') return [{ text: `● ${value.value}`, style: { fg: 'ok' } }];
        if (kind === 'doing') return [{ text: `◐ ${value.value}`, style: { fg: 'kulor.amber' } }];
        if (kind === 'todo') return [{ text: `○ ${value.value}`, style: { fg: 'dempet' } }];
      }
      return [{ text: value.value, style: {} }];
    }
  }
}

/** Rader tittelsiden har til innledningen (S6) når sti, hode, ingress og «Endret» er tegnet (egenskapene viker). */
export function titleRoomForPreamble(title: string, doc: NoteDocument, grid: Grid): number {
  const header = chooseHeader(title, { width: grid.sats, height: Math.floor(grid.rows / 3), threeLines: grid.rows >= 36 });
  const ingress = ingressOf(doc.properties);
  const ingressLines = ingress ? wrapRuns([{ text: ingress, style: {} }], grid.maal).length + 1 : 0;
  const used = grid.top + 2 + drawnHeight(header, textHeaderLines(title, grid)) + 1 + ingressLines + 1 + 1;
  return grid.rows - 2 - used;
}

function paintTitle(canvas: Canvas, grid: Grid, ctx: SlideViewContext, slide: Slide): void {
  const bctx = blockContext(ctx, grid);
  const header = chooseHeader(ctx.deck.title, { width: grid.sats, height: Math.floor(grid.rows / 3), threeLines: grid.rows >= 36 });
  const ingress = ingressOf(ctx.doc.properties);
  const ingressRows = ingress ? wrapRuns([{ text: ingress, style: { fg: 'dempet', italic: true } }], grid.maal).map((l) => rowOf(0, l)) : [];
  const preamble = slide.withPreamble ? bodyRows(slide.units, bctx) : [];
  const props = ctx.doc.properties.filter((p: PropertyEntry) => !HIDDEN_ON_TITLE.has(p.key.toLowerCase()));
  const headH = drawnHeight(header, textHeaderLines(ctx.deck.title, grid));
  const block = 2 + headH + 1 + (ingressRows.length ? ingressRows.length + 1 : 0) + (preamble.length ? preamble.length + 1 : 0) + (props.length ? props.length + 1 : 0) + 1;
  let y = Math.max(grid.top, Math.round((grid.rows - block) * 0.38));
  const folders = ctx.doc.path.split('/').slice(0, -1);
  let x = canvas.put(grid.x, y, '~/ ', { fg: 'aksent', bold: true });
  folders.forEach((f, k) => (x = canvas.put(x, y, `${k > 0 ? ' / ' : ''}${f}`, { fg: 'dempet' })));
  y += 2;
  y = paintHeader(canvas, grid, grid.x, y, ctx.deck.title, header) + 1;
  const limit = grid.rows - 2;
  if (ingressRows.length) y = paintRows(canvas, ingressRows, grid.x, y, limit - y) + 1;
  if (preamble.length) y = paintRows(canvas, preamble, grid.x, y, limit - y) + 1;
  if (props.length && limit - 1 - y >= props.length + 1) {
    const kw = Math.max(...props.map((p) => textWidth(p.key)));
    for (const p of props) {
      canvas.put(grid.x, y, '│', { fg: 'dekor' });
      canvas.put(grid.x + 2, y, p.key.padEnd(kw), { fg: 'dempet' });
      canvas.runs(grid.x + 2 + kw + 3, y, propertyRuns(p.value, p.key, bctx), grid.x + grid.sats);
      y += 1;
    }
    y += 1;
  }
  if (y < limit) canvas.put(grid.x, y, `Endret ${formatDateTime(ctx.doc.mtime)}`, { fg: 'dempet' });
}

// ------------------------------------------------------------------------------------- agenda og overgang

/** Avkort med «…» (aldri et halvt ord uten markering). */
function fitText(text: string, max: number): string {
  if (textWidth(text) <= max) return text;
  let out = '';
  for (const ch of text) {
    if (textWidth(out + ch) > Math.max(1, max - 1)) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

function sectionStarts(deck: SlideDeck): Map<number, number> {
  const starts = new Map<number, number>();
  deck.slides.forEach((s, i) => {
    if (s.agendaIndex !== null && (s.kind === 'transition' || s.kind === 'content') && !starts.has(s.agendaIndex)) starts.set(s.agendaIndex, i + 1);
  });
  return starts;
}

function treeChildren(deck: SlideDeck, index: number) {
  return deck.slides.filter((s) => s.kind === 'content' && s.agendaIndex === index && s.address.continuation === 1 && s.address.part === 1);
}

/** Høyden agendalisten tar, med eller uten tom rad mellom punktene. */
function agendaListHeight(grid: Grid, deck: SlideDeck, current: number | null, airy: boolean): number {
  const tree = current === null ? 0 : treeChildren(deck, current).length;
  return 1 + (grid.rows >= 30 ? 1 : 0) + deck.agenda.length * (airy ? 2 : 1) + tree;
}

function paintAgendaList(canvas: Canvas, grid: Grid, deck: SlideDeck, y: number, current: number | null): void {
  const w = Math.min(grid.sats, grid.maal + 8);
  // Luft mellom punktene når rader ≥ 30 (og på agendaen), men bare hvis listen da får plass.
  const airy = (grid.rows >= 30 || current === null) && y + agendaListHeight(grid, deck, current, true) <= grid.rows - 2;
  const starts = sectionStarts(deck);
  canvas.put(grid.x + w - 'lysbilde'.length, y, 'lysbilde', { fg: 'dempet' });
  y += 1 + (grid.rows >= 30 ? 1 : 0);
  for (const item of deck.agenda) {
    if (y >= grid.rows - 2) break;
    const nr = String(item.index + 1).padStart(2, '0');
    const side = String(starts.get(item.index) ?? '');
    const state = current === null ? 'next' : item.index < current ? 'past' : item.index === current ? 'here' : 'next';
    let leader: StyleSpec = { fg: 'dekor' };
    let end: number;
    if (state === 'here') {
      canvas.fill(grid.x - 2, y, w + 4, 1, 'invertert_bg');
      const st: StyleSpec = { fg: 'invertert_tekst', bg: 'invertert_bg', bold: true };
      canvas.put(grid.x, y, nr, st);
      end = canvas.put(grid.x + 4, y, fitText(item.text, w - side.length - 6), st);
      leader = { fg: 'invertert_tekst', bg: 'invertert_bg' };
    } else {
      canvas.put(grid.x, y, nr, { fg: state === 'past' ? 'dempet' : 'aksent', bold: true });
      end = canvas.put(grid.x + 4, y, fitText(item.text, w - side.length - 6), state === 'past' ? { fg: 'dempet' } : { fg: 'tekst', bold: true });
    }
    // Prikkede ledere: «·» annenhver celle, på samme kolonneparitet på alle rader.
    let lx = end + 2;
    if (lx % 2 !== grid.x % 2) lx += 1;
    for (let xx = lx; xx < grid.x + w - side.length - 1; xx += 2) canvas.put(xx, y, '·', leader);
    canvas.put(grid.x + w - side.length, y, side, state === 'here' ? { fg: 'invertert_tekst', bg: 'invertert_bg', bold: true } : { fg: 'dempet' });
    y += 1;
    if (state === 'here') {
      const children = treeChildren(deck, item.index);
      children.forEach((c, k) => {
        if (y >= grid.rows - 2) return;
        canvas.put(grid.x + 4, y, k === children.length - 1 ? '└── ' : '├── ', { fg: 'dekor' });
        canvas.put(grid.x + 8, y, fitText(c.heading ?? '', w - 8), { fg: 'dempet' });
        y += 1;
      });
    }
    if (airy) y += 1;
  }
}

function paintAgenda(canvas: Canvas, grid: Grid, deck: SlideDeck, slide: Slide): void {
  const current = slide.kind === 'transition' ? slide.agendaIndex : null;
  let y = grid.top + (grid.rows >= 30 ? 1 : 0);
  if (current === null) canvas.put(grid.x, y, `${deck.title} · ${deck.agenda.length} punkter`, { fg: 'dempet' });
  else {
    const x = canvas.put(grid.x, y, `${String(current + 1).padStart(2, '0')} / ${String(deck.agenda.length).padStart(2, '0')}`, { fg: 'aksent', bold: true });
    canvas.put(x, y, '  du er her', { fg: 'dempet' });
  }
  y += 2;
  // PO-114: overgangen har seksjonsnavnet som hode.
  const title = current === null ? 'Agenda' : (deck.agenda.find((a) => a.index === current)?.text ?? 'Agenda');
  // Høyde ≤ ⅓ av radene (AR-3-20); listen under gir slipp på luften mellom punktene før hodet krymper.
  const header = chooseHeader(title, { width: grid.sats, height: Math.floor(grid.rows / 3) });
  y = paintHeader(canvas, grid, grid.x, y, title, header);
  y += grid.rows >= 30 ? 2 : 1;
  paintAgendaList(canvas, grid, deck, y, current);
}

// ------------------------------------------------------------------------------------- innhold

export function footnoteRows(footnotes: Slide['footnotes'], ctx: BlockContext, width: number): Row[] {
  const rows: Row[] = [];
  for (const f of footnotes) {
    const lines = wrapRuns(inlineRuns(f.content as ElementContent[], ctx.inline, { fg: 'dempet' }), width - 2);
    lines.forEach((l, k) => rows.push({ segs: [...(k === 0 ? [{ x: 0, text: `${superscript(f.number)} `, style: { fg: 'aksent', bold: true } as StyleSpec }] : []), ...rowOf(2, l).segs] }));
  }
  return rows;
}

/** Overskriftens linjer på et innholdslysbilde (brutt ved `sats − 12`, «(forts.)» på siste linje). */
export function headingLines(heading: string | null, grid: Grid): number {
  if (!heading) return 0;
  return wrapRuns([{ text: heading, style: {} }], Math.max(10, grid.sats - 12)).length;
}

/** Første rad for innholdet under nummer, overskrift og én tom rad. */
export function bodyTop(grid: Grid, heading: string | null): number {
  const lines = headingLines(heading, grid);
  return grid.top + 1 + (lines > 0 ? lines + 1 : 0);
}

/** Fotnotene står i høyre marg når det er minst 34 kolonner der (§4.8, PO-128). */
export function usesMarginalia(grid: Grid): boolean {
  return grid.x + grid.sats - (grid.x + grid.maal + 6) >= 34;
}

interface BodyBlock {
  readonly rows: Row[];
  readonly gapBefore: boolean;
  readonly scroll: boolean;
  /** Rader øverst som står fast ved rulling (kodehodet). */
  readonly sticky: number;
}

function bodyBlocks(slide: Slide, ctx: BlockContext): BodyBlock[] {
  const out: BodyBlock[] = [];
  slide.units.forEach((unit, i) => {
    const rows = unitRows(unit, ctx);
    if (rows.length === 0) return;
    const sameList = i > 0 && unit.listKey !== null && slide.units[i - 1]?.listKey === unit.listKey;
    const code = unit.node.type === 'element' && unit.node.tagName === 'vr-code';
    out.push({ rows, gapBefore: out.length > 0 && !sameList, scroll: slide.scrollUnits.includes(i), sticky: code ? 2 : 0 });
  });
  return out;
}

interface ContentLayout {
  readonly bctx: BlockContext;
  readonly top: number;
  readonly bottom: number;
  readonly notes: Row[];
  readonly marginalia: boolean;
  readonly blocks: BodyBlock[];
}

function contentLayout(ctx: SlideViewContext, grid: Grid, slide: Slide): ContentLayout {
  const bctx = blockContext(ctx, grid);
  const marginalia = slide.footnotes.length > 0 && usesMarginalia(grid);
  const notes = footnoteRows(slide.footnotes, bctx, marginalia ? Math.min(48, grid.x + grid.sats - (grid.x + grid.maal + 6)) + 2 : grid.maal);
  const bottom = notes.length > 0 && !marginalia ? grid.bottom - notes.length - 1 : grid.bottom;
  return { bctx, top: bodyTop(grid, slide.heading), bottom, notes, marginalia, blocks: bodyBlocks(slide, bctx) };
}

/** Hvor mange linjer den rullende blokken på lysbildet kan rulles (0 = ingen rulling). */
export function scrollMax(ctx: SlideViewContext, index: number, cols: number, rows: number): number {
  return scrollInfo(ctx, index, cols, rows).max;
}

/**
 * Rulling i lysbildets for store blokk: hvor langt (`max`) og hvor mye ett trykk på `↑`/`↓` flytter (`step`, et halvt
 * vindu – en linje om gangen er for tregt for kode på flere hundre linjer i et møte).
 */
export function scrollInfo(ctx: SlideViewContext, index: number, cols: number, rows: number): { readonly max: number; readonly step: number } {
  const slide = ctx.deck.slides[index];
  if (!slide || slide.kind !== 'content') return { max: 0, step: 1 };
  const grid = gridFor(cols, rows);
  const layout = contentLayout(ctx, grid, slide);
  let y = layout.top;
  for (const b of layout.blocks) {
    if (b.gapBefore) y += 1;
    const room = layout.bottom - y + 1;
    if (b.scroll || b.rows.length > room) {
      const window = Math.max(1, room - b.sticky - 1);
      return { max: Math.max(0, b.rows.length - b.sticky - window), step: Math.max(1, Math.floor(window / 2)) };
    }
    y += b.rows.length;
  }
  return { max: 0, step: 1 };
}

/** En for stor blokk: faste hoderader, et vindu med linjer, hintlinje og rullefelt (designsystem-terminal §4.5). */
function paintScrolling(canvas: Canvas, grid: Grid, block: BodyBlock, y: number, height: number, offset: number): void {
  const lines = block.rows.slice(block.sticky);
  const windowRows = Math.max(1, height - block.sticky - 1);
  const max = Math.max(0, lines.length - windowRows);
  const start = Math.max(0, Math.min(offset, max));
  if (lines.length <= windowRows) {
    paintRows(canvas, block.rows, grid.x, y, height);
    return;
  }
  const fill = block.rows[0]?.fill;
  paintRows(canvas, block.rows.slice(0, block.sticky), grid.x, y);
  paintRows(canvas, lines.slice(start, start + windowRows), grid.x, y + block.sticky);
  const hintY = y + block.sticky + windowRows;
  const bg = fill ? { bg: fill.bg } : {};
  if (fill) canvas.fill(grid.x + fill.x, hintY, fill.width, 1, fill.bg);
  const left = lines.length - start - windowRows;
  const hint = left > 0 ? `↓ ${left} linjer til` : `Slutt · ${lines.length} linjer`;
  const x = canvas.put(grid.x + 2, hintY, hint, { fg: 'tekst', bold: true, ...bg });
  canvas.put(x, hintY, ' · ↑ ↓ ruller', { fg: 'dempet', ...bg });
  const pos = `${start + 1}–${start + windowRows} av ${lines.length}`;
  const right = grid.x + (fill ? fill.x + fill.width : grid.sats);
  canvas.put(right - 2 - textWidth(pos), hintY, pos, { fg: 'dempet', ...bg });
  // Rullefelt i høyre kant: spor `│` i dekor, tommel `┃` dempet.
  const thumb = Math.max(1, Math.round((windowRows * windowRows) / lines.length));
  const thumbTop = Math.round((windowRows * start) / lines.length);
  for (let k = 0; k < windowRows; k++) {
    const on = k >= thumbTop && k < thumbTop + thumb;
    canvas.put(right - 1, y + block.sticky + k, on ? '┃' : '│', { fg: on ? 'dempet' : 'dekor', ...bg });
  }
}

function paintContent(canvas: Canvas, grid: Grid, ctx: SlideViewContext, slide: Slide, scroll: number): void {
  if (slide.agendaIndex !== null && ctx.deck.agenda.length > 0) paintAgendaLine(canvas, grid, ctx.deck, slide);
  let y = grid.top;
  if (slide.agendaIndex !== null) canvas.put(grid.x, y, `${String(slide.agendaIndex + 1).padStart(2, '0')} /`, { fg: 'aksent', bold: true });
  y += 1;
  const heading = slide.heading ?? '';
  const continued = heading.endsWith(CONTINUED_SUFFIX);
  const base = continued ? heading.slice(0, -CONTINUED_SUFFIX.length) : heading;
  if (base) {
    const lines = wrapRuns([{ text: base, style: { fg: 'tekst', bold: true } }], Math.max(10, grid.sats - 12));
    lines.forEach((l, k) => {
      let e = canvas.runs(grid.x, y, l);
      if (k === lines.length - 1) {
        if (continued) e = canvas.put(e + 1, y, '(forts.)', { fg: 'dempet' });
        const rule = grid.x + grid.sats - e - 2;
        if (rule > 0) canvas.put(e + 2, y, '─'.repeat(rule), { fg: 'dekor' });
      }
      y += 1;
    });
    y += 1;
  }
  const layout = contentLayout(ctx, grid, slide);
  y = layout.top;
  if (layout.marginalia) {
    const marginX = grid.x + grid.maal + 6;
    layout.notes.forEach((_, i) => canvas.put(marginX - 3, y + i, '│', { fg: 'dekor' }));
    paintRows(canvas, layout.notes, marginX - 2, y, grid.bottom - y + 1, grid.x + grid.sats);
  } else if (layout.notes.length > 0) {
    canvas.put(grid.x, layout.bottom + 1, '────────', { fg: 'dekor' });
    paintRows(canvas, layout.notes, grid.x, layout.bottom + 2, layout.notes.length);
  }
  for (const block of layout.blocks) {
    if (block.gapBefore) y += 1;
    const room = layout.bottom - y + 1;
    if (room <= 0) break;
    if (block.scroll || block.rows.length > room) {
      paintScrolling(canvas, grid, block, y, room, block.scroll ? scroll : 0);
      y += room;
      continue;
    }
    y = paintRows(canvas, block.rows, grid.x, y);
  }
}

// ------------------------------------------------------------------------------------- inngangen

export function slideView(ctx: SlideViewContext, index: number, cols: number, rows: number, options: SlideViewOptions = {}): Frame {
  const frame = createFrame(cols, rows);
  if (options.blackout) {
    createCanvas(frame, ctx.theme, 'svart');
    return frame;
  }
  const canvas = createCanvas(frame, ctx.theme);
  const grid = gridFor(cols, rows);
  const slide = ctx.deck.slides[index];
  if (!slide) return frame;
  if (slide.kind === 'title') paintTitle(canvas, grid, ctx, slide);
  else if (slide.kind === 'agenda' || slide.kind === 'transition') paintAgenda(canvas, grid, ctx.deck, slide);
  else paintContent(canvas, grid, ctx, slide, options.scroll ?? 0);
  paintStatusLine(canvas, grid, ctx.deck, index, options.notice ? { notice: options.notice } : {});
  return frame;
}
