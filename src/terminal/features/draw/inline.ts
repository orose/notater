// Inline-HAST → tekstbiter med roller (designsystem-terminal §4.1, §4.9), og ordbryting på tvers av stiler.

import type { Element, ElementContent, RootContent } from 'hast';
import { graphemes, graphemeWidth, textWidth } from '../cells';
import type { StyleSpec } from '../theme';
import type { Run } from './rows';

export interface InlineContext {
  /** Vaultmappens navn (eller `obsidianVault`) for `obsidian://`-lenker (PO-109, PO-117). */
  readonly obsidianVault: string;
  /** 16 farger/NO_COLOR: inline-kode i kodefarge uten flate (designsystem-terminal §4.1). */
  readonly plainInlineCode: boolean;
}

/** Linjeskift (`br`) i en bit-sekvens. */
export const BREAK: Run = { text: '\n', style: {} };

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export function superscript(n: string): string {
  return [...n].map((d) => (/\d/.test(d) ? SUPERSCRIPT[Number(d)] : d)).join('');
}

type Node = RootContent | ElementContent;

function classes(node: Element): string[] {
  const value: unknown = node.properties.className;
  return Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/\s+/) : [];
}

function text(node: Node): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(text).join('');
  return '';
}

/** `obsidian://open?vault=…&file=…` (designsystem-terminal §4.9). */
export function obsidianUrl(vault: string, docPath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(docPath)}`;
}

/** Filnavnet i et `img`-element (vedleggsrutens `?path=` eller siste del av `src`). */
export function imageName(node: Element): string {
  const src = String(node.properties.src ?? '');
  const query = /[?&]path=([^&]+)/.exec(src);
  const path = query ? decodeURIComponent(query[1]!) : src;
  return path.split('/').pop() || 'bilde';
}

export function inlineRuns(nodes: readonly Node[], ctx: InlineContext, base: StyleSpec = {}): Run[] {
  const out: Run[] = [];
  const walk = (node: Node, style: StyleSpec): void => {
    if (node.type === 'text') {
      if (node.value !== '') out.push({ text: node.value.replace(/[\t\r\n]+/g, ' '), style });
      return;
    }
    if (node.type !== 'element') return;
    const el = node;
    const children = (s: StyleSpec) => el.children.forEach((c) => walk(c, s));
    switch (el.tagName) {
      case 'strong':
      case 'b':
        return children({ ...style, bold: true });
      case 'em':
      case 'i':
        return children({ ...style, italic: true });
      case 'del':
      case 's':
        return children({ ...style, strike: true });
      case 'mark':
        return children({ ...style, bg: 'treff_bg' });
      case 'br':
        out.push(BREAK);
        return;
      case 'code':
        out.push({ text: text(el), style: ctx.plainInlineCode ? { ...style, fg: 'kode.string' } : { ...style, fg: 'tekst', bg: 'flate_bg' }, chip: true });
        return;
      case 'sup': {
        const ref = el.children.find((c): c is Element => c.type === 'element' && c.properties.dataFootnoteRef !== undefined);
        if (ref || classes(el).includes('sn-ref-sup')) {
          out.push({ text: superscript(text(el).trim()), style: { ...style, fg: 'aksent', bold: true } });
          return;
        }
        return children(style);
      }
      case 'vr-sidenote':
        return; // fotnotene står nederst på lysbildet (Slide.footnotes)
      case 'img':
        out.push({ text: `[bilde: ${imageName(el)}]`, style: { ...style, fg: 'dempet' } });
        return;
      case 'input':
        return;
      case 'vr-unsupported':
        out.push({ text: String(el.properties.dataSource ?? ''), style: { ...style, fg: 'dempet' } });
        return;
      case 'a': {
        const kind = String(el.properties.dataVrLink ?? '');
        if (el.properties.dataFootnoteRef !== undefined) return children({ ...style, fg: 'aksent', bold: true });
        if (kind === 'internal') {
          const target = String(el.properties.dataVrTarget ?? '');
          return children({ ...style, fg: 'lenke', underline: true, underlineColor: 'lenke', ...(target ? { link: obsidianUrl(ctx.obsidianVault, target) } : {}) });
        }
        if (kind === 'unresolved') return children({ ...style, fg: 'lenke_brutt', underline: true, dotted: true, underlineColor: 'lenke_brutt' });
        if (kind === 'tag') return children({ ...style, fg: 'aksent2' });
        const href = String(el.properties.href ?? '');
        if (kind === 'external' || /^(https?:|mailto:)/i.test(href)) return children({ ...style, fg: 'lenke', underline: true, underlineColor: 'lenke', link: href });
        return children(style);
      }
      default:
        return children(style);
    }
  };
  for (const n of nodes) walk(n, base);
  return out;
}

/** Del en bit ved bredde `width` (mellom grafemer). */
function splitRun(run: Run, width: number): [Run, Run] {
  let w = 0;
  let i = 0;
  const gs = graphemes(run.text);
  while (i < gs.length && w + graphemeWidth(gs[i]!) <= width) w += graphemeWidth(gs[i++]!);
  return [
    { ...run, text: gs.slice(0, i).join('') },
    { ...run, text: gs.slice(i).join('') },
  ];
}

/**
 * Grådig bryting på mellomrom. Et ord er alt mellom to mellomrom, også på tvers av stiler, så «(`kode`).» står
 * samlet. NBSP bryter ikke. Ord lengre enn linjen deles hardt mellom grafemer (ingenting kuttes). `width2` gjelder
 * linjene etter den første.
 */
export function wrapRuns(runs: readonly Run[], width: number, width2 = width): Run[][] {
  type Word = { parts: Run[]; space: Run | null };
  const paragraphs: Word[][] = [[]];
  let word: Run[] = [];
  const endWord = (space: Run | null) => {
    paragraphs.at(-1)!.push({ parts: word, space });
    word = [];
  };
  for (const run of runs) {
    if (run === BREAK || run.text === '\n') {
      if (word.length > 0) endWord(null);
      paragraphs.push([]);
      continue;
    }
    if (run.chip) {
      word.push(run);
      continue;
    }
    for (const piece of run.text.split(/( +)/)) {
      if (piece === '') continue;
      if (/^ +$/.test(piece)) {
        if (word.length > 0) endWord({ ...run, text: ' ' });
        continue;
      }
      word.push({ ...run, text: piece });
    }
  }
  if (word.length > 0) endWord(null);

  const lines: Run[][] = [];
  for (const words of paragraphs) {
    let line: Run[] = [];
    let used = 0;
    let limit = lines.length === 0 ? width : width2;
    const flush = () => {
      lines.push(line);
      line = [];
      used = 0;
      limit = width2;
    };
    for (const w of words) {
      let parts = w.parts;
      let ww = runsWidthOf(parts);
      if (used > 0 && used + ww > limit) flush();
      while (ww > limit - used && limit > 0) {
        // Hardt brudd i et ord som er lengre enn linjen.
        let room = limit - used;
        const head: Run[] = [];
        const tail: Run[] = [];
        for (const p of parts) {
          if (room <= 0) {
            tail.push(p);
            continue;
          }
          const pw = textWidth(p.text);
          if (pw <= room) {
            head.push(p);
            room -= pw;
          } else {
            const [a, b] = splitRun(p, room);
            if (a.text) head.push(a);
            tail.push(b);
            room = 0;
          }
        }
        if (head.length === 0) break;
        line.push(...head);
        flush();
        parts = tail;
        ww = runsWidthOf(parts);
      }
      line.push(...parts);
      used += ww;
      if (w.space && used < limit) {
        line.push(w.space);
        used += 1;
      }
    }
    // Etterhengende mellomrom fjernes.
    while (line.length > 0 && line.at(-1)!.text === ' ' && !line.at(-1)!.chip) line.pop();
    lines.push(line);
  }
  return lines.map((l) => {
    const copy = [...l];
    while (copy.length > 0 && copy.at(-1)!.text === ' ') copy.pop();
    return copy;
  });
}

function runsWidthOf(parts: readonly Run[]): number {
  return parts.reduce((w, p) => w + textWidth(p.text), 0);
}
