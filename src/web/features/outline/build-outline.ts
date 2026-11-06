// Disposisjonen (ADR-009): diskré omskriving, overskrifter, TOC, §-nummer og seksjoner beregnet fra HAST i
// klienten, før rendering. Ren og ikke-muterende (dokumentet ligger i query-cachen): urørte noder beholder identitet.

import type { Element, ElementContent, Root, RootContent } from 'hast';
import type { TocEntry } from '../../../shared/api-types';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface OutlineHeading {
  readonly id: string;
  /** Effektivt nivå (etter justering i diskré modus). */
  readonly level: HeadingLevel;
  readonly text: string;
  readonly origin: 'note' | 'embed';
  /** På toppnivå i flyten (kan foldes og nummereres). */
  readonly foldable: boolean;
  /** §-nummer for nummererte nivå-2-overskrifter, ellers null. */
  readonly sec: number | null;
}

export interface SectionStats {
  readonly words: number;
  /** Kode, diagram, tabell, bilde og base. */
  readonly figures: number;
}

export interface Outline {
  /** Omskrevet HAST: diskré embeds, nye nivåer og id-er, `data-vr-sec` på nummererte overskrifter. */
  readonly content: Root;
  readonly headings: readonly OutlineHeading[];
  readonly toc: readonly TocEntry[];
  /** Antall innebygde notater (`vr-embed[data-status=ok]`) i dokumentet. */
  readonly noteEmbeds: number;
  /** Flytelementene (indekser i lesefølge) som seksjonen til overskriften dekker: `[start, end)`. */
  readonly sectionRange: (headingId: string) => readonly [number, number] | null;
  /**
   * Overskriftene som må foldes ut for at elementet med `id` skal vises (alle seksjoner som inneholder det).
   * Er `id` selv en overskrift, er den med (navigasjon til en overskrift viser innholdet dens).
   */
  readonly sectionOf: (id: string) => readonly string[];
  readonly stats: (headingId: string) => SectionStats;
  /** Kopi av `content` der flytelementene i foldede seksjoner er pakket i `div[hidden]` (strukturdeling). */
  readonly applyFolds: (folded: ReadonlySet<string>) => Root;
}

type Node = RootContent | ElementContent;

const HEADING = /^h([1-6])$/;
const FIGURES = new Set(['vr-code', 'vr-mermaid', 'table', 'img', 'vr-base', 'figure']);

function isElement(node: Node | undefined): node is Element {
  return node?.type === 'element';
}

function levelOf(node: Node | undefined): HeadingLevel | null {
  if (!isElement(node)) return null;
  const m = HEADING.exec(node.tagName);
  return m ? (Number(m[1]) as HeadingLevel) : null;
}

function isBlank(node: Node): boolean {
  return node.type === 'text' && node.value.trim() === '';
}

/** Fotnotelisten er aldri del av en seksjon. */
function isFootnotes(node: Node): boolean {
  return isElement(node) && (node.tagName === 'vr-footnotes' || (node.tagName === 'section' && node.properties.dataFootnotes !== undefined));
}

function isOkEmbed(node: Node): node is Element {
  return isElement(node) && node.tagName === 'vr-embed' && node.properties.dataStatus === 'ok';
}

function isDiscreetEmbed(node: Node): boolean {
  return isOkEmbed(node) && node.properties.dataVrDiscreet === 'true';
}

export function inlineText(node: Node): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(inlineText).join('');
  return '';
}

function clamp(level: number): HeadingLevel {
  return Math.max(1, Math.min(6, level)) as HeadingLevel;
}

function retag(node: Element, level: HeadingLevel, id: string): Element {
  return { ...node, tagName: `h${level}`, properties: { ...node.properties, id } };
}

// ------------------------------------------------------------------------------------- diskré omskriving

interface Counter {
  n: number;
}

/**
 * Skriver om en `vr-embed[data-status=ok]` til diskré form (ADR-009 beslutning 3, PO-57/58/65):
 * tittel på nivå `T = min(6, forrige + 1)`, innebygde overskrifter forskjøvet relativt og retagget, id-er
 * `~e<n>-<i>`, nestede embeds arver. Feilkort, baser og bilder røres ikke.
 */
function rewriteEmbed(embed: Element, prev: number, counter: Counter): Element {
  const n = ++counter.n;
  const anchor = typeof embed.properties.dataAnchor === 'string' ? embed.properties.dataAnchor : '';
  const kind = anchor === '' ? 'note' : anchor.startsWith('^') ? 'block' : 'section';
  const T = clamp(prev + 1);
  let body = [...embed.children];
  const firstIndex = body.findIndex((c) => !isBlank(c));
  const first = body[firstIndex];
  let title: Element | null = null;
  let map: (level: number) => HeadingLevel;
  const minLevel = (nodes: readonly Node[]) => Math.min(7, ...nodes.map((c) => levelOf(c) ?? 7));

  if (kind === 'note') {
    // PO-35: begynner målet med en H1, er den tittelen (ellers dobbel tittel).
    if (levelOf(first) === 1 && isElement(first)) {
      title = { type: 'element', tagName: `h${T}`, properties: { id: `~e${n}-0` }, children: first.children };
      body = body.filter((_, i) => i !== firstIndex);
    } else {
      const text = typeof embed.properties.dataTitle === 'string' ? embed.properties.dataTitle : '';
      title = { type: 'element', tagName: `h${T}`, properties: { id: `~e${n}-0` }, children: [{ type: 'text', value: text }] };
    }
    const m = minLevel(body);
    map = (l) => clamp(T + 1 + l - m);
  } else if (kind === 'section' && isElement(first) && levelOf(first) !== null) {
    const s = levelOf(first) as number;
    title = retag(first, T, `~e${n}-0`);
    body = body.filter((_, i) => i !== firstIndex);
    map = (l) => clamp(T + l - s);
  } else {
    const m = minLevel(body);
    map = (l) => clamp(T + l - m);
  }

  const children: ElementContent[] = title ? [title] : [];
  let current = title ? T : prev;
  let i = 0;
  for (const child of body) {
    const level = levelOf(child);
    if (level !== null && isElement(child)) {
      const next = map(level);
      children.push(retag(child, next, `~e${n}-${++i}`));
      current = next;
    } else if (isOkEmbed(child)) {
      children.push(rewriteEmbed(child, current, counter));
    } else {
      children.push(child);
    }
  }
  return { ...embed, properties: { ...embed.properties, dataVrDiscreet: 'true' }, children };
}

function rewriteDiscreet(content: Root, counter: Counter): Root {
  let prev = 1; // PO-58: notattittelen (H1) er konteksten før første overskrift.
  const children = content.children.map((node) => {
    const level = levelOf(node);
    if (level !== null) {
      prev = level;
      return node;
    }
    return isOkEmbed(node) ? rewriteEmbed(node, prev, counter) : node;
  });
  return { ...content, children };
}

/** Rammede embeds (PO-68): overskrifter inni blir `p.embed-title` – overskrift-stil, ikke overskrift (heading-order). */
function framedTitles(node: Element): Element {
  const children = node.children.map((child): ElementContent => {
    if (levelOf(child) !== null && isElement(child)) {
      return { type: 'element', tagName: 'p', properties: { className: ['embed-title'] }, children: child.children };
    }
    return isOkEmbed(child) ? framedTitles(child) : child;
  });
  return { ...node, children };
}

function countEmbeds(nodes: readonly Node[]): number {
  let count = 0;
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (isOkEmbed(node)) count += 1;
    count += countEmbeds(node.children);
  }
  return count;
}

// ------------------------------------------------------------------------------------- flyten og seksjonene

interface FlowItem {
  /** Sti fra roten (indekser), gjennom diskré embeds. */
  readonly path: readonly number[];
  readonly node: Node;
  /** Innerste omfang (diskré embed), -1 = verten. */
  readonly scope: number;
}

interface Scope {
  readonly path: readonly number[];
  readonly parent: number;
  start: number;
  end: number;
}

function collectIds(node: Node, into: (id: string) => void): void {
  if (!isElement(node)) return;
  const id = node.properties.id;
  if (typeof id === 'string' && id !== '') into(id);
  // En diskré embed er egne flytelementer; dens id-er samles der.
  if (isDiscreetEmbed(node)) return;
  for (const child of node.children) collectIds(child, into);
}

function count(node: Node, stats: { words: number; figures: number }): void {
  if (node.type === 'text') {
    stats.words += node.value.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    return;
  }
  if (!isElement(node)) return;
  if (FIGURES.has(node.tagName)) stats.figures += 1;
  if (node.tagName === 'vr-code' || node.tagName === 'vr-mermaid') return;
  for (const child of node.children) count(child, stats);
}

const pathKey = (path: readonly number[]) => path.join('.');

export function buildOutline(content: Root, toc: readonly TocEntry[], discreet = false): Outline {
  const counter: Counter = { n: 0 };
  const noteEmbeds = countEmbeds(content.children);
  const rewritten: Root = discreet
    ? rewriteDiscreet(content, counter)
    : { ...content, children: content.children.map((node) => (isOkEmbed(node) ? framedTitles(node) : node)) };

  // Flyten: rotens barn, der en diskré embed er gjennomsiktig (eget omfang).
  const flow: FlowItem[] = [];
  const scopes: Scope[] = [];
  const walk = (nodes: readonly Node[], prefix: readonly number[], scope: number) => {
    nodes.forEach((node, i) => {
      const path = [...prefix, i];
      if (isDiscreetEmbed(node) && isElement(node)) {
        const s = scopes.push({ path, parent: scope, start: flow.length, end: flow.length }) - 1;
        walk(node.children, path, s);
        (scopes[s] as Scope).end = flow.length;
      } else {
        flow.push({ path, node, scope });
      }
    });
  };
  walk(rewritten.children, [], -1);

  const footnotesAt = (() => {
    const i = flow.findIndex((f) => f.scope === -1 && isFootnotes(f.node));
    return i === -1 ? flow.length : i;
  })();

  const blockOfId = new Map<string, number>();
  flow.forEach((item, index) => collectIds(item.node, (id) => blockOfId.set(id, index)));

  const ancestors = (scope: number): Set<number> => {
    const out = new Set<number>([-1]);
    for (let s = scope; s !== -1; s = scopes[s]?.parent ?? -1) out.add(s);
    return out;
  };

  interface FlowHeading {
    readonly index: number;
    readonly id: string;
    readonly level: HeadingLevel;
    readonly scope: number;
  }
  const flowHeadings: FlowHeading[] = [];
  flow.forEach((item, index) => {
    const level = levelOf(item.node);
    const id = isElement(item.node) ? item.node.properties.id : undefined;
    if (level !== null && typeof id === 'string' && id !== '' && index < footnotesAt) flowHeadings.push({ index, id, level, scope: item.scope });
  });

  // Seksjonsgrenser (beslutning 5): til første overskrift med nivå ≤ L i samme eller et ytre omfang,
  // slutten av omfanget (embeden) eller fotnotene.
  const ranges = new Map<string, readonly [number, number]>();
  flowHeadings.forEach((h, i) => {
    const outer = ancestors(h.scope);
    let end = h.scope === -1 ? footnotesAt : Math.min(footnotesAt, (scopes[h.scope] as Scope).end);
    for (const next of flowHeadings.slice(i + 1)) {
      if (next.index >= end) break;
      if (next.level <= h.level && outer.has(next.scope)) {
        end = next.index;
        break;
      }
    }
    ranges.set(h.id, [h.index + 1, end]);
  });

  // §-nummer (AR-1.1-19) og overskriftslisten.
  const tocText = new Map(toc.map((t) => [t.id, t.text]));
  let sec = 0;
  const secOf = new Map<string, number>();
  const headings: OutlineHeading[] = flowHeadings.map((h) => {
    const node = flow[h.index]?.node as Element;
    const number = h.level === 2 ? ++sec : null;
    if (number !== null) secOf.set(h.id, number);
    return {
      id: h.id,
      level: h.level,
      text: tocText.get(h.id) ?? inlineText(node).replace(/\s+/g, ' ').trim(),
      origin: h.scope === -1 ? 'note' : 'embed',
      foldable: true,
      sec: number,
    };
  });

  // Skriv §-attributtene inn (strukturdeling langs stiene).
  const patches = new Map<string, (node: Element) => Element>();
  for (const h of flowHeadings) {
    const number = secOf.get(h.id);
    if (number === undefined) continue;
    patches.set(pathKey(flow[h.index]?.path ?? []), (node) => ({
      ...node,
      properties: { ...node.properties, dataVrSec: String(number), dataVrSecPad: String(number).padStart(2, '0') },
    }));
  }
  const finalContent = patchPaths(rewritten, patches);

  const toc2: readonly TocEntry[] = discreet ? headings.map((h) => ({ depth: h.level, text: h.text, id: h.id })) : toc;
  const statsCache = new Map<string, SectionStats>();

  return {
    content: finalContent,
    headings,
    toc: toc2,
    noteEmbeds,
    sectionRange: (id) => ranges.get(id) ?? null,
    sectionOf: (id) => {
      const block = blockOfId.get(id);
      if (block === undefined) return [];
      return headings
        .filter((h) => {
          const r = ranges.get(h.id);
          return h.id === id || (r !== undefined && block >= r[0] && block < r[1]);
        })
        .map((h) => h.id);
    },
    stats: (id) => {
      const cached = statsCache.get(id);
      if (cached) return cached;
      const r = ranges.get(id);
      const stats = { words: 0, figures: 0 };
      if (r) for (let i = r[0]; i < r[1]; i++) count((flow[i] as FlowItem).node, stats);
      statsCache.set(id, stats);
      return stats;
    },
    applyFolds: (folded) => {
      if (folded.size === 0) return finalContent;
      const hidden = new Set<number>();
      for (const id of folded) {
        const r = ranges.get(id);
        if (r) for (let i = r[0]; i < r[1]; i++) hidden.add(i);
      }
      if (hidden.size === 0) return finalContent;
      const wraps = new Map<string, (node: Element) => Element>();
      const wrap = (path: readonly number[], index: number) =>
        wraps.set(pathKey(path), (node) => ({
          type: 'element',
          tagName: 'div',
          properties: { hidden: true, className: ['folded-block'], dataFoldedBlock: String(index) },
          children: [node],
        }));
      // En diskré embed der alt er foldet bort, skjules helt (også kildelenken).
      const covered = new Set<number>();
      scopes.forEach((s) => {
        if (s.end <= s.start || [...covered].some((c) => isPrefix(scopes[c]?.path ?? [], s.path))) return;
        for (let i = s.start; i < s.end; i++) if (!hidden.has(i)) return;
        covered.add(scopes.indexOf(s));
        wrap(s.path, s.start);
      });
      hidden.forEach((index) => {
        const item = flow[index] as FlowItem;
        if ([...covered].some((c) => isPrefix(scopes[c]?.path ?? [], item.path))) return;
        if (item.node.type !== 'element') return; // tekstnoder mellom blokker
        wrap(item.path, index);
      });
      return patchPaths(finalContent, wraps);
    },
  };
}

function isPrefix(prefix: readonly number[], path: readonly number[]): boolean {
  return prefix.length <= path.length && prefix.every((v, i) => path[i] === v);
}

/** Kopi av treet der nodene på de gitte stiene er byttet ut; urørte grener beholder identitet. */
function patchPaths(root: Root, patches: ReadonlyMap<string, (node: Element) => Element>): Root {
  if (patches.size === 0) return root;
  const prefixes = new Set<string>();
  for (const key of patches.keys()) {
    const parts = key.split('.');
    for (let i = 1; i < parts.length; i++) prefixes.add(parts.slice(0, i).join('.'));
  }
  const visit = <T extends Node>(nodes: readonly T[], prefix: string): T[] =>
    nodes.map((node, i) => {
      const key = prefix === '' ? String(i) : `${prefix}.${i}`;
      if (!isElement(node)) return node;
      let next: Element = node;
      if (prefixes.has(key)) next = { ...next, children: visit(next.children, key) };
      const patch = patches.get(key);
      return (patch ? patch(next) : next) as T;
    });
  return { ...root, children: visit(root.children, '') };
}

/** Bakoverkompatibel hjelper: skjulte flytindekser for et sett foldede overskrifter. */
export function hiddenBlocks(outline: Outline, folded: ReadonlySet<string>): ReadonlySet<number> {
  const hidden = new Set<number>();
  for (const id of folded) {
    const r = outline.sectionRange(id);
    if (!r) continue;
    for (let i = r[0]; i < r[1]; i++) hidden.add(i);
  }
  return hidden;
}
