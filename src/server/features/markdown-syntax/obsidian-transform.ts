/**
 * Én samlet, rekursiv gang over mdast som legger på Obsidian-syntaks:
 *
 * - inline (kun i `text`-noder, aldri i kode/lenketekst): wikilinks/embeds, `==markering==`,
 *   `#tagger`, inline-LaTeX `$…$` og inline-fotnoter `^[…]`
 * - blokk-id-er `^id` (avsnitt, listepunkt, eller frittstående etter en blokk)
 * - egendefinerte oppgavestatuser `[/]`, `[-]`
 * - «enkelt linjeskift = <br>» (PO-14)
 * - fjerning av escape-vaktposter (se preprocess.ts)
 *
 * Alt gjøres i ett pass fordi separate `visit`/`findAndReplace`-pass målbart koster
 * indekseringstid (AK17).
 */
import type { FootnoteDefinition, ListItem, Nodes, Paragraph, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import type { Highlight, ObsidianTag, UnsupportedNode, WikiLink } from './obsidian-nodes';
import { ESCAPE_SENTINEL, stripSentinels } from './preprocess';
import { parseWikiLinkInner } from './wikilink-syntax';

type InlineFactory = (match: RegExpExecArray, context: TransformContext) => PhrasingContent | null;

interface InlineRule {
  /** Billig forhåndssjekk på tekstverdien før regex kjøres. */
  readonly trigger: string;
  readonly pattern: RegExp;
  readonly create: InlineFactory;
}

interface TransformContext {
  readonly footnotes: FootnoteDefinition[];
  readonly hasSentinels: boolean;
}

const INLINE_RULES: readonly InlineRule[] = [
  { trigger: '[[', pattern: /(!?)\[\[([^[\]\n]+)\]\]/g, create: createWikiLink },
  { trigger: '==', pattern: /==(?=[^\s=])([^\n]*?[^\s=])==/g, create: createHighlight },
  // Tagg: «#» etter tekststart/mellomrom, minst ett tegn som ikke er et siffer.
  { trigger: '#', pattern: /(?<=^|\s)#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu, create: createTag },
  // Inline-LaTeX: åpning ikke fulgt av mellomrom, lukking ikke fulgt av siffer («$5 og $10» er tekst).
  { trigger: '$', pattern: /(?<![\\$\w])\$(?=[^\s$])([^$\n]*?[^\s$\\])\$(?![\d$])/g, create: createInlineLatex },
  { trigger: '^[', pattern: /\^\[([^[\]\n]+)\]/g, create: createInlineFootnote },
];

const NO_INLINE_PARENTS = new Set(['link', 'linkReference']);
const TRAILING_BLOCK_ID = /(^|\s)\^([A-Za-z0-9-]+)\s*$/;
const STANDALONE_BLOCK_ID = /^\^([A-Za-z0-9-]+)$/;
const CUSTOM_TASK = /^\[([^\s\]])\]\s+/;

export function transformObsidianSyntax(tree: Root, source: string): void {
  const context: TransformContext = { footnotes: [], hasSentinels: source.includes(ESCAPE_SENTINEL) };
  transformParent(tree, context, true);
  tree.children.push(...context.footnotes);
}

function transformParent(parent: Parent, context: TransformContext, inlineAllowed: boolean): void {
  const allowInline = inlineAllowed && !NO_INLINE_PARENTS.has(parent.type);
  const children: Nodes[] = [];
  for (const child of parent.children as Nodes[]) {
    if (child.type === 'text') {
      if (allowInline) children.push(...transformText(child.value, context));
      else children.push(context.hasSentinels ? { ...child, value: stripSentinels(child.value) } : child);
      continue;
    }
    if (context.hasSentinels && 'value' in child && typeof child.value === 'string') {
      child.value = stripSentinels(child.value);
    }
    if (context.hasSentinels && child.type === 'image' && child.alt) child.alt = stripSentinels(child.alt);
    if ('children' in child) transformParent(child, context, allowInline);
    children.push(child);
  }
  parent.children = children as RootContent[];

  applyBlockIds(parent);
  if (parent.type === 'listItem') applyTaskStatus(parent as ListItem);
  splitSoftBreaks(parent);
}

function transformText(value: string, context: TransformContext): PhrasingContent[] {
  let segments: PhrasingContent[] = [{ type: 'text', value }];
  for (const rule of INLINE_RULES) {
    if (!value.includes(rule.trigger)) continue;
    segments = segments.flatMap((segment) =>
      segment.type === 'text' && segment.value.includes(rule.trigger) ? applyRule(rule, segment.value, context) : [segment],
    );
  }
  if (!context.hasSentinels) return segments;
  return segments.map((s) => (s.type === 'text' ? { type: 'text', value: stripSentinels(s.value) } : s));
}

function applyRule(rule: InlineRule, value: string, context: TransformContext): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let last = 0;
  rule.pattern.lastIndex = 0;
  for (let match = rule.pattern.exec(value); match; match = rule.pattern.exec(value)) {
    const node = rule.create(match, context);
    if (!node) continue;
    if (match.index > last) out.push({ type: 'text', value: value.slice(last, match.index) });
    out.push(node);
    last = match.index + match[0].length;
  }
  if (last === 0) return [{ type: 'text', value }];
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

function createWikiLink(match: RegExpExecArray): WikiLink | null {
  const parts = parseWikiLinkInner(stripSentinels(match[2]!));
  if (parts.target === '' && parts.anchor === null) return null;
  return { type: 'wikiLink', value: stripSentinels(match[0]), embed: match[1] === '!', ...parts };
}

function createHighlight(match: RegExpExecArray): Highlight {
  return { type: 'highlight', children: [{ type: 'text', value: stripSentinels(match[1]!) }] };
}

function createTag(match: RegExpExecArray): ObsidianTag {
  return { type: 'obsidianTag', value: match[1]!.replace(/\/+$/, '') };
}

function createInlineLatex(match: RegExpExecArray): UnsupportedNode {
  return { type: 'unsupported', kind: 'latex', value: stripSentinels(match[0]), inline: true };
}

function createInlineFootnote(match: RegExpExecArray, context: TransformContext): PhrasingContent {
  const identifier = `inline-${context.footnotes.length + 1}`;
  context.footnotes.push({
    type: 'footnoteDefinition',
    identifier,
    label: identifier,
    children: [{ type: 'paragraph', children: [{ type: 'text', value: stripSentinels(match[1]!) }] }],
  });
  return { type: 'footnoteReference', identifier, label: identifier };
}

/** Blokk-id-er i avsnitt som er direkte barn av `parent`. */
function applyBlockIds(parent: Parent): void {
  for (let index = 0; index < parent.children.length; index += 1) {
    const node = parent.children[index]!;
    if (node.type !== 'paragraph') continue;
    const last = node.children[node.children.length - 1];
    if (last?.type !== 'text' || !last.value.includes('^')) continue;

    if (node.children.length === 1 && index > 0) {
      const standalone = STANDALONE_BLOCK_ID.exec(last.value.trim());
      if (standalone) {
        setBlockId(parent.children[index - 1] as Nodes, standalone[1]!);
        parent.children.splice(index, 1);
        index -= 1;
        continue;
      }
    }

    const match = TRAILING_BLOCK_ID.exec(last.value);
    if (!match) continue;
    last.value = last.value.slice(0, match.index).replace(/\s+$/, '');
    if (last.value === '') node.children.pop();
    trimTrailingBreaks(node);
    const target = parent.type === 'listItem' && index === 0 ? parent : node;
    setBlockId(target as Nodes, match[2]!);
  }
}

function applyTaskStatus(item: ListItem): void {
  if (item.checked !== null && item.checked !== undefined) return;
  const first = item.children[0];
  if (first?.type !== 'paragraph') return;
  const text = first.children[0];
  if (text?.type !== 'text') return;
  const match = CUSTOM_TASK.exec(text.value);
  if (!match) return;
  text.value = text.value.slice(match[0].length);
  item.checked = true;
  item.data = { ...item.data, vrTaskStatus: match[1]! };
}

/** Obsidian-standard «strict line breaks = av»: et enkelt linjeskift i tekst blir `<br>`. */
function splitSoftBreaks(parent: Parent): void {
  if (!parent.children.some((c) => c.type === 'text' && c.value.includes('\n'))) return;
  const next: Nodes[] = [];
  for (const child of parent.children as Nodes[]) {
    if (child.type !== 'text' || !child.value.includes('\n')) {
      next.push(child);
      continue;
    }
    child.value.split('\n').forEach((line, i) => {
      if (i > 0) next.push({ type: 'break' });
      if (line !== '') next.push({ type: 'text', value: line });
    });
  }
  parent.children = next as RootContent[];
}

function setBlockId(node: Nodes, id: string): void {
  node.data = { ...node.data, vrBlockId: id };
}

function trimTrailingBreaks(paragraph: Paragraph): void {
  while (paragraph.children[paragraph.children.length - 1]?.type === 'break') paragraph.children.pop();
}
