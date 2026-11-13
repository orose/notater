// Kodeblokker (designsystem-terminal §4.4, AR-3-14): Shikis HAST fra serveren → kodelinjer med palettens `kode.*`.
// Ingen ny highlighting i terminalen. Flaten er `kode_bg` i hele satsens bredde; lange linjer brytes mykt med `↪`.

import type { Element, ElementContent } from 'hast';
import { textWidth } from '../cells';
import type { TerminalTheme } from '../theme';
import { wrapRuns } from './inline';
import { rowOf, type Row, type Run } from './rows';

const TOKEN = /var\(--shiki-token-([\w-]+)\)/;

/** Shikis `span.line` → biter per linje. Tab = 4 mellomrom. */
export function codeLines(pre: Element, theme: TerminalTheme): Run[][] {
  const code = pre.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code') ?? pre;
  const lines: Run[][] = [];
  for (const line of code.children) {
    if (line.type !== 'element') continue;
    const runs: Run[] = [];
    const walk = (node: ElementContent, token: string | null, italic: boolean) => {
      if (node.type === 'text') {
        if (node.value !== '') runs.push({ text: node.value.replace(/\t/g, '    '), style: token ? theme.codeStyle(token, italic) : { fg: 'kode_tekst', bg: 'kode_bg', ...(italic ? { italic: true } : {}) } });
        return;
      }
      if (node.type !== 'element') return;
      const style = String(node.properties.style ?? '');
      const t = TOKEN.exec(style)?.[1] ?? token;
      const it = italic || /font-style:\s*italic/.test(style);
      node.children.forEach((c) => walk(c, t, it));
    };
    line.children.forEach((c) => walk(c, null, false));
    lines.push(runs);
  }
  // Shiki gir ofte en tom siste linje etter avsluttende linjeskift.
  while (lines.length > 1 && lines.at(-1)!.length === 0) lines.pop();
  return lines;
}

export interface CodeLayout {
  readonly rows: Row[];
  /** Antall visuelle kodelinjer (uten hode og luft) – til rullehintet (3-c). */
  readonly lines: number;
}

/** `vr-code` → hode, stiplet skille, linjer med nummer i rennen og én rad luft under. */
export function layoutCode(node: Element, width: number, theme: TerminalTheme): CodeLayout {
  const pre = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'pre');
  const source = pre ? codeLines(pre, theme) : String(node.properties.dataCode ?? '').split('\n').map((l) => [{ text: l, style: { fg: 'kode_tekst' as const, bg: 'kode_bg' as const } }]);
  const fill = { x: 0, width, bg: 'kode_bg' as const };
  const title = String(node.properties.dataTitle ?? '');
  const lang = String(node.properties.dataLang ?? '');
  const rows: Row[] = [];
  const head: Row['segs'][number][] = [{ x: 2, text: '●', style: { fg: 'aksent', bg: 'kode_bg' } }];
  if (title) head.push({ x: 4, text: title, style: { fg: 'kode_tekst', bg: 'kode_bg', bold: true } });
  if (lang) head.push({ x: width - 2 - textWidth(lang), text: lang, style: { fg: 'dempet', bg: 'kode_bg' } });
  rows.push({ segs: head, fill });
  rows.push({ segs: [{ x: 1, text: '╌'.repeat(Math.max(0, width - 2)), style: { fg: 'dekor', bg: 'kode_bg' } }], fill });
  const nw = String(source.length).length;
  const textX = 2 + nw + 2;
  const textWidthAvail = Math.max(8, width - textX - 1);
  let visual = 0;
  source.forEach((line, i) => {
    const parts = textWidth(line.map((r) => r.text).join('')) > textWidthAvail ? wrapRuns(line, textWidthAvail) : [line];
    parts.forEach((part, k) => {
      const gutter = k === 0 ? String(i + 1).padStart(nw) : '↪'.padStart(nw);
      rows.push({ ...rowOf(textX, part, fill), segs: [{ x: 2, text: gutter, style: { fg: 'dempet', bg: 'kode_bg' } }, ...rowOf(textX, part).segs] });
      visual += 1;
    });
  });
  rows.push({ segs: [], fill });
  return { rows, lines: visual };
}
