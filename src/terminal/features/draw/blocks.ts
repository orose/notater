// Blokker på et lysbilde (ADR-011 §4, designsystem-terminal §4): én enhet (`SlideUnit.node`) → rader. Ukjente
// elementer tegnes som barnas tekst, ukjente `vr-*` som plassholder med elementnavnet – aldri krasj.

import type { Element, ElementContent, RootContent } from 'hast';
import type { BaseResult, BaseTableView, NoteDocument, VaultValue } from '../../../shared/api-types';
import { formatBaseDate, statusKind } from '../../../core/format';
import { textWidth } from '../cells';
import type { HueName, StyleSpec, TerminalTheme } from '../theme';
import { layoutCode } from './code';
import { imageName, inlineRuns, wrapRuns, type InlineContext } from './inline';
import { EMPTY_ROW, rowOf, shiftRows, type Row, type Run } from './rows';
import { layoutTable, type Align, type TableModel } from './table';

type Node = RootContent | ElementContent;

export interface BlockContext {
  readonly theme: TerminalTheme;
  readonly inline: InlineContext;
  readonly doc: NoteDocument;
  /** Satsens bredde (figurer). */
  readonly sats: number;
  /** Målbredde (brødtekst, lister, callouts, plassholdere). */
  readonly maal: number;
}

const isElement = (n: Node | undefined): n is Element => n?.type === 'element';
const blank = (n: Node) => n.type === 'text' && n.value.trim() === '';

function classes(node: Element): string[] {
  const value: unknown = node.properties.className;
  return Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/\s+/) : [];
}

function plain(node: Node): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(plain).join('');
  return '';
}

const BLOCK_TAGS = new Set(['p', 'ul', 'ol', 'blockquote', 'table', 'pre', 'vr-code', 'vr-callout', 'vr-base', 'vr-mermaid', 'vr-embed', 'div', 'section', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'vr-unsupported', 'figure']);

/** Brødtekst i målbredde. */
function paragraph(nodes: readonly Node[], ctx: BlockContext, width = ctx.maal, base: StyleSpec = {}): Row[] {
  const runs = inlineRuns(nodes as ElementContent[], ctx.inline, base);
  if (runs.length === 0) return [];
  return wrapRuns(runs, width).map((l) => rowOf(0, l));
}

/** Blokker etter hverandre med én tom rad mellom (tetthet `[1]`, designsystem-terminal §1.3). */
export function layoutBlocks(nodes: readonly Node[], ctx: BlockContext, width = ctx.maal): Row[] {
  const out: Row[] = [];
  let inline: Node[] = [];
  const push = (rows: Row[]) => {
    if (rows.length === 0) return;
    if (out.length > 0) out.push(EMPTY_ROW);
    out.push(...rows);
  };
  const flushInline = () => {
    if (inline.some((n) => !blank(n))) push(paragraph(inline, ctx, width));
    inline = [];
  };
  for (const n of nodes) {
    if (isElement(n) && BLOCK_TAGS.has(n.tagName)) {
      flushInline();
      push(layoutNode(n, ctx, width));
    } else inline.push(n);
  }
  flushInline();
  return out;
}

// ------------------------------------------------------------------------------------- lister og sitater

function listItem(li: Element, marker: string, markerStyle: StyleSpec, ctx: BlockContext, width: number, indent = 0): Row[] {
  const checkbox = li.children.find((c): c is Element => isElement(c) && c.tagName === 'input');
  const mark = checkbox ? (checkbox.properties.checked ? '☒' : '☐') : marker;
  const inlineKids = li.children.filter((c) => !(isElement(c) && (c.tagName === 'input' || c.tagName === 'ul' || c.tagName === 'ol')));
  const blockKids = inlineKids.filter((c) => isElement(c) && BLOCK_TAGS.has(c.tagName));
  const text = blockKids.length > 0 ? layoutBlocks(inlineKids, ctx, width - indent) : paragraph(inlineKids, ctx, width - indent);
  const rows = shiftRows(text, indent);
  const mw = textWidth(mark);
  if (rows.length === 0) rows.push(EMPTY_ROW);
  rows[0] = { ...rows[0]!, segs: [{ x: indent - mw - 1, text: mark, style: markerStyle }, ...rows[0]!.segs] };
  for (const sub of li.children) {
    if (isElement(sub) && (sub.tagName === 'ul' || sub.tagName === 'ol')) rows.push(...listRows(sub, ctx, width, indent + 4, '·'));
  }
  return rows;
}

function listRows(list: Element, ctx: BlockContext, width: number, indent = 0, bullet = '–', startIndex = 0): Row[] {
  const ordered = list.tagName === 'ol';
  const start = Number(list.properties.start ?? 1) || 1;
  const rows: Row[] = [];
  list.children.filter((c): c is Element => isElement(c) && c.tagName === 'li').forEach((li, i) => {
    const marker = ordered ? `${start + startIndex + i}.` : bullet;
    rows.push(...listItem(li, marker, { fg: 'dempet' }, ctx, width, indent));
  });
  return rows;
}

function quote(node: Element, ctx: BlockContext, width: number): Row[] {
  const inner = layoutBlocks(node.children, { ...ctx, maal: width - 3 }, width - 3).map((r) => ({ ...r, segs: r.segs.map((s) => ({ ...s, style: { ...s.style, italic: true } })) }));
  return shiftRows(inner, 3).map((r) => ({ ...r, segs: [{ x: 0, text: '▎', style: { fg: 'aksent2' } }, ...r.segs] }));
}

// ------------------------------------------------------------------------------------- callouts

const CALLOUTS: Readonly<Record<string, readonly [HueName, string, string]>> = {
  note: ['blue', 'i', 'Merk'],
  info: ['blue', 'i', 'Info'],
  todo: ['blue', '☐', 'Gjøremål'],
  tip: ['teal', '*', 'Tips'],
  abstract: ['teal', '≡', 'Sammendrag'],
  success: ['green', '✓', 'Ferdig'],
  question: ['amber', '?', 'Spørsmål'],
  warning: ['orange', '!', 'Advarsel'],
  danger: ['red', '‼', 'Fare'],
  bug: ['red', '✗', 'Feil'],
  failure: ['red', '✗', 'Feilet'],
  example: ['plum', '≡', 'Eksempel'],
  quote: ['grey', '”', 'Sitat'],
};
/** Serverens norske standardtitler (api.md `vr-callout`): da står bare etiketten i rammen. */
const DEFAULT_TITLES = new Set(['merk', 'sammendrag', 'info', 'gjøremål', 'tips', 'fullført', 'spørsmål', 'advarsel', 'feilet', 'fare', 'feil', 'eksempel', 'sitat']);

function callout(node: Element, ctx: BlockContext): Row[] {
  const type = String(node.properties.dataCalloutType ?? 'note');
  const [hue, sign, label] = CALLOUTS[type] ?? CALLOUTS.note!;
  const color: StyleSpec = { fg: `kulor.${hue}` };
  const width = ctx.maal + 4;
  const titleEl = node.children.find((c): c is Element => isElement(c) && c.tagName === 'vr-callout-title');
  const body = node.children.find((c): c is Element => isElement(c) && c.tagName === 'vr-callout-body');
  const titleText = titleEl ? plain(titleEl).trim() : '';
  const folded = node.properties.dataFold === 'closed';
  const tag = ` ${sign} ${label} ${folded ? '▸ ' : ''}`;
  const top: Row = {
    segs: [
      { x: -2, text: '╭─', style: color },
      { x: 0, text: tag, style: { ...color, bold: true } },
      { x: textWidth(tag), text: '─'.repeat(Math.max(0, width - 3 - textWidth(tag))), style: color },
      { x: width - 3, text: '╮', style: color },
    ],
  };
  if (folded) return [top];
  const inner: Row[] = [];
  if (titleEl && titleText && !DEFAULT_TITLES.has(titleText.toLowerCase())) inner.push(...paragraph(titleEl.children, ctx, ctx.maal, { bold: true }));
  if (body) {
    const rows = layoutBlocks(body.children, ctx, ctx.maal);
    if (inner.length > 0 && rows.length > 0) inner.push(EMPTY_ROW);
    inner.push(...rows);
  }
  const framed = inner.map((r) => ({ ...r, segs: [{ x: -2, text: '│', style: color }, ...r.segs, { x: width - 3, text: '│', style: color }] }));
  const bottom: Row = { segs: [{ x: -2, text: `╰${'─'.repeat(width - 2)}╯`, style: color }] };
  return [top, ...framed, bottom];
}

// ------------------------------------------------------------------------------------- plassholdere (T3)

/** Stiplet ramme i `strek`, mål + 4 bred, hengende i margen; fast tekst og valgfri detaljlinje (PO-113). */
export function placeholder(text: string, detail: string | null, ctx: BlockContext): Row[] {
  const width = ctx.maal + 4;
  const frame: StyleSpec = { fg: 'strek' };
  const line = (content: string, style: StyleSpec): Row => ({
    segs: [{ x: -2, text: '┆', style: frame }, { x: 0, text: content, style }, { x: width - 3, text: '┆', style: frame }],
  });
  const fit = (s: string) => {
    const max = width - 4;
    if (textWidth(s) <= max) return s;
    let out = '';
    for (const ch of s) {
      if (textWidth(out + ch) > max - 1) break;
      out += ch;
    }
    return `${out}…`;
  };
  return [
    { segs: [{ x: -2, text: `┌${'╌'.repeat(width - 2)}┐`, style: frame }] },
    line(fit(text), { fg: 'dempet', bold: true }),
    ...(detail ? [line(fit(detail), { fg: 'dempet' })] : []),
    { segs: [{ x: -2, text: `└${'╌'.repeat(width - 2)}┘`, style: frame }] },
  ];
}

/** «flowchart LR · 7 noder» – diagramtype og antall noder, aldri kilden (designsystem-terminal §4.10). */
export function mermaidDetail(source: string): string | null {
  const lines = source.split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('%%'));
  const head = lines[0];
  if (!head) return null;
  const type = head.replace(/\s+/g, ' ');
  if (!/^(flowchart|graph)\b/i.test(type)) return type.split(' ')[0] ?? null;
  const nodes = new Set<string>();
  for (const l of lines.slice(1)) {
    for (const m of l.replace(/\|[^|]*\|/g, ' ').matchAll(/(?:^|[\s>-])([A-Za-z_][\w]*)\s*(?=[[({]|-->|---|-\.|==>|$|\s|&)/g)) {
      if (!['subgraph', 'end', 'style', 'classDef', 'class', 'click', 'linkStyle', 'direction'].includes(m[1]!)) nodes.add(m[1]!);
    }
  }
  return nodes.size > 0 ? `${type} · ${nodes.size} noder` : type;
}

// ------------------------------------------------------------------------------------- Bases

function valueRuns(value: VaultValue | undefined, column: string, ctx: BlockContext): Run[] {
  if (!value || value.type === 'null') return [];
  switch (value.type) {
    case 'string': {
      if (/status/i.test(column)) {
        const kind = statusKind(value.value);
        if (kind === 'done') return [{ text: `● ${value.value}`, style: { fg: 'ok' } }];
        if (kind === 'doing') return [{ text: `◐ ${value.value}`, style: { fg: 'kulor.amber' } }];
        if (kind === 'todo') return [{ text: `○ ${value.value}`, style: { fg: 'dempet' } }];
      }
      return [{ text: value.value, style: {} }];
    }
    case 'number':
      return [{ text: new Intl.NumberFormat('nb-NO').format(value.value), style: {} }];
    case 'boolean':
      return [{ text: value.value ? '✓' : '–', style: {} }];
    case 'date':
      return [{ text: formatBaseDate(value.value, value.hasTime), style: {} }];
    case 'tag':
      return [{ text: `#${value.value}`, style: { fg: 'aksent2' } }];
    case 'link':
      return value.target
        ? inlineRuns([{ type: 'element', tagName: 'a', properties: { dataVrLink: 'internal', dataVrTarget: value.target }, children: [{ type: 'text', value: value.display }] }], ctx.inline)
        : [{ text: value.display, style: { fg: 'lenke_brutt', underline: true, dotted: true } }];
    case 'list':
      return value.value.flatMap((v, i) => [...(i > 0 ? [{ text: ', ', style: {} }] : []), ...valueRuns(v, column, ctx)]);
  }
}

function baseTable(view: BaseTableView, ctx: BlockContext, minWidth: number): Row[] {
  const numeric = view.columns.map((c) => view.groups.every((g) => g.rows.every((r) => ['number', 'date', 'null'].includes(r.cells[c.id]?.type ?? 'null'))));
  const rows: Run[][][] = [];
  const groups: Array<{ before: number; label: string }> = [];
  for (const g of view.groups) {
    if (view.grouped) groups.push({ before: rows.length, label: g.label });
    for (const r of g.rows) {
      rows.push(
        view.columns.map((c) =>
          c.id === 'file.name' && r.cells[c.id]?.type === 'string'
            ? inlineRuns([{ type: 'element', tagName: 'a', properties: { dataVrLink: 'internal', dataVrTarget: r.path }, children: [{ type: 'text', value: (r.cells[c.id] as { value: string }).value }] }], ctx.inline)
            : r.cells[c.id] === undefined || r.cells[c.id]?.type === 'null'
              ? []
              : valueRuns(r.cells[c.id], c.id, ctx),
        ),
      );
    }
  }
  const model: TableModel = { header: view.columns.map((c) => [{ text: c.label, style: {} }]), rows, align: numeric.map((n) => (n ? 'right' : 'left')), groups };
  return layoutTable(model, ctx.sats, minWidth);
}

function base(node: Element, ctx: BlockContext): Row[] {
  const id = String(node.properties.dataBaseId ?? '');
  const result: BaseResult | undefined = ctx.doc.bases[id];
  const source = String(node.properties.dataSourcePath ?? '');
  const name = source ? (source.split('/').pop() ?? source) : 'base';
  if (!result || result.views.length === 0) {
    const warning = result?.warnings[0]?.message ?? 'Basen kunne ikke vises.';
    return [rowOf(0, [{ text: `${name}: ${warning}`, style: { fg: 'feil' } }])];
  }
  const view = result.views[0]!;
  if (view.type === 'kanban') {
    const counts = view.groups.map((g) => `${g.label} ${g.rows.length}`).join(' · ');
    return placeholder(`Kanban: ${view.name} – vises i web-leseren`, `${name} · ${view.totalRows} kort: ${counts}`, ctx);
  }
  if (view.type === 'unsupported') return placeholder(`${view.name}: visningen «${view.originalType}» støttes ikke`, null, ctx);
  const count = `${view.totalRows} ${view.totalRows === 1 ? 'rad' : 'rader'}`;
  const headRuns: Run[] = [
    { text: name, style: { bold: true } },
    { text: '  ›  ', style: { fg: 'dempet' } },
    { text: view.name, style: { italic: true } },
    { text: `  ·  ${count}`, style: { fg: 'dempet' } },
  ];
  const live = '● live';
  const headWidth = textWidth(headRuns.map((r) => r.text).join('')) + 4 + textWidth(live);
  const table = baseTable(view, ctx, headWidth);
  const tableWidth = Math.max(headWidth, ...table.map((r) => Math.max(0, ...r.segs.map((s) => s.x + textWidth(s.text)))));
  const out: Row[] = [{ segs: [...rowOf(0, headRuns).segs, { x: tableWidth - textWidth(live), text: '●', style: { fg: 'ok' } }, { x: tableWidth - textWidth(live) + 2, text: 'live', style: { fg: 'dempet' } }] }];
  if (result.views.length > 1) {
    const segs: Row['segs'][number][] = [];
    let x = 0;
    result.views.forEach((v, i) => {
      if (i > 0) segs.push({ x: x++, text: '│', style: { fg: 'dekor' } });
      const label = ` ${v.name} `;
      segs.push({ x, text: label, style: i === 0 ? { bold: true, underline: true, underlineColor: 'aksent' } : { fg: 'dempet' } });
      x += textWidth(label);
    });
    out.push({ segs });
  }
  out.push(EMPTY_ROW, ...table);
  for (const w of [...result.warnings, ...view.warnings]) out.push(rowOf(0, [{ text: w.message, style: { fg: 'dempet' } }]));
  return out;
}

// ------------------------------------------------------------------------------------- tabeller

function htmlTable(node: Element, ctx: BlockContext): Row[] {
  const rowsOf = (el: Element): Element[] => el.children.filter((c): c is Element => isElement(c)).flatMap((c) => (c.tagName === 'tr' ? [c] : rowsOf(c)));
  const all = rowsOf(node);
  const cells = (tr: Element) => tr.children.filter((c): c is Element => isElement(c) && (c.tagName === 'td' || c.tagName === 'th'));
  const head = all.find((tr) => cells(tr).some((c) => c.tagName === 'th')) ?? all[0];
  if (!head) return [];
  const body = all.filter((tr) => tr !== head);
  const align: Align[] = cells(head).map((c) => {
    const a = String(c.properties.align ?? (/text-align:\s*(\w+)/.exec(String(c.properties.style ?? ''))?.[1] ?? ''));
    return a === 'right' ? 'right' : a === 'center' ? 'center' : 'left';
  });
  const model: TableModel = {
    header: cells(head).map((c) => inlineRuns(c.children, ctx.inline)),
    rows: body.map((tr) => cells(tr).map((c) => inlineRuns(c.children, ctx.inline))),
    align,
  };
  return layoutTable(model, ctx.sats);
}

// ------------------------------------------------------------------------------------- inngangen

export function layoutNode(node: Element, ctx: BlockContext, width = ctx.maal): Row[] {
  switch (node.tagName) {
    case 'p': {
      const kids = node.children.filter((c) => !blank(c));
      if (kids.length > 0 && kids.every((c) => isElement(c) && c.tagName === 'img')) return kids.map((c) => image(c as Element, ctx));
      return paragraph(node.children, ctx, width);
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return paragraph(node.children, ctx, width, { bold: true });
    case 'ul':
    case 'ol':
      return listRows(node, ctx, width);
    case 'li':
      return listItem(node, '–', { fg: 'dempet' }, ctx, width);
    case 'blockquote':
      return quote(node, ctx, width);
    case 'vr-callout':
      return callout(node, ctx);
    case 'vr-code':
      return layoutCode(node, ctx.sats, ctx.theme).rows;
    case 'pre':
      return layoutCode({ ...node, tagName: 'vr-code', properties: {}, children: [node] }, ctx.sats, ctx.theme).rows;
    case 'table':
      return htmlTable(node, ctx);
    case 'vr-base':
      return base(node, ctx);
    case 'vr-mermaid':
      return placeholder('Mermaid-diagram – vises i web-leseren', mermaidDetail(String(node.properties.dataSource ?? '')), ctx);
    case 'img':
      return [image(node, ctx)];
    case 'hr':
      return [rowOf(0, [{ text: '─'.repeat(8), style: { fg: 'dekor' } }])];
    case 'vr-embed': {
      const status = String(node.properties.dataStatus ?? 'ok');
      if (status === 'ok') return layoutBlocks(node.children, ctx, width);
      const raw = String(node.properties.dataRaw ?? node.properties.dataTitle ?? '');
      const reason = status === 'cycle' ? 'Syklisk embed' : status === 'depth-limit' ? 'For dyp embed' : 'Fant ikke';
      return [rowOf(0, [{ text: `${reason}: ${raw}`, style: { fg: 'feil' } }])];
    }
    case 'vr-unsupported': {
      const kind = String(node.properties.dataKind ?? 'other');
      const names: Record<string, string> = { latex: 'LaTeX', canvas: 'Canvas', excalidraw: 'Excalidraw', dataview: 'Dataview' };
      const name = names[kind] ?? String(node.properties.dataName ?? 'Innholdet');
      return placeholder(`${name} – vises ikke i leseren`, null, ctx);
    }
    default:
      if (node.tagName.startsWith('vr-')) return placeholder(node.tagName, null, ctx);
      if (classes(node).includes('footnotes')) return [];
      return layoutBlocks(node.children, ctx, width);
  }
}

function image(node: Element, ctx: BlockContext): Row {
  const name = imageName(node);
  const alt = String(node.properties.alt ?? '');
  // Plassholder (T3, PO-127): fet og dempet.
  const runs: Run[] = [{ text: `[bilde: ${name}]`, style: { fg: 'dempet', bold: true } }];
  if (alt && alt !== name) runs.push({ text: `  ${alt}`, style: { fg: 'dempet', italic: true } });
  return rowOf(0, wrapRuns(runs, ctx.maal)[0] ?? runs);
}
