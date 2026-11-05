import type { Element, ElementContent, Root } from 'hast';
import { h, text } from './hast-builders';

const CALLOUT_MARKER = /^\s*\[!([^\]\s]+)\]([+-]?)[ \t]*/;

/** Obsidian-aliaser → kanonisk type (QA-CAL-01). */
const TYPE_ALIASES: Readonly<Record<string, string>> = {
  summary: 'abstract',
  tldr: 'abstract',
  hint: 'tip',
  important: 'tip',
  check: 'success',
  done: 'success',
  help: 'question',
  faq: 'question',
  caution: 'warning',
  attention: 'warning',
  fail: 'failure',
  missing: 'failure',
  error: 'danger',
  cite: 'quote',
};

/** Norske standardtitler (PO-14 / README-QA R4). */
const DEFAULT_TITLES: Readonly<Record<string, string>> = {
  note: 'Merk',
  abstract: 'Sammendrag',
  info: 'Info',
  todo: 'Gjøremål',
  tip: 'Tips',
  success: 'Fullført',
  question: 'Spørsmål',
  warning: 'Advarsel',
  failure: 'Feilet',
  danger: 'Fare',
  bug: 'Feil',
  example: 'Eksempel',
  quote: 'Sitat',
};

export function normalizeCalloutType(raw: string): string {
  const lower = raw.toLowerCase();
  return TYPE_ALIASES[lower] ?? lower;
}

export function defaultCalloutTitle(type: string): string {
  return DEFAULT_TITLES[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * `blockquote` hvis første avsnitt starter med `[!type]` → `vr-callout`. Kjøres på sanert,
 * pålitelig HAST, nedenfra og opp (nestede callouts). Tittel = første linje (fram til første `<br>`).
 */
export function transformCallouts(node: Element | Root): void {
  for (let i = 0; i < node.children.length; i += 1) {
    const child = node.children[i]!;
    if (child.type !== 'element') continue;
    transformCallouts(child);
    if (child.tagName === 'blockquote') {
      const callout = toCallout(child);
      if (callout) (node.children as ElementContent[])[i] = callout;
    }
  }
}

function toCallout(blockquote: Element): Element | null {
  const firstIndex = blockquote.children.findIndex((c) => c.type === 'element');
  const first = blockquote.children[firstIndex];
  if (!first || first.type !== 'element' || first.tagName !== 'p') return null;
  const lead = first.children[0];
  if (lead?.type !== 'text') return null;
  const marker = CALLOUT_MARKER.exec(lead.value);
  if (!marker) return null;

  const type = normalizeCalloutType(marker[1]!);
  const fold = marker[2] === '-' ? 'closed' : marker[2] === '+' ? 'open' : 'none';
  const rest: ElementContent[] = [text(lead.value.slice(marker[0].length)), ...first.children.slice(1)];
  const breakAt = rest.findIndex((c) => c.type === 'element' && c.tagName === 'br');
  const titleNodes = trimTextNodes(breakAt === -1 ? rest : rest.slice(0, breakAt));
  const remainder = breakAt === -1 ? [] : trimTextNodes(rest.slice(breakAt + 1));

  const bodyChildren: ElementContent[] = [];
  if (remainder.length > 0) bodyChildren.push({ ...first, children: remainder });
  bodyChildren.push(...blockquote.children.slice(firstIndex + 1));

  const title = titleNodes.length > 0 ? titleNodes : [text(defaultCalloutTitle(type))];
  return h('vr-callout', { dataCalloutType: type, dataFold: fold }, [
    h('vr-callout-title', {}, title),
    h('vr-callout-body', {}, bodyChildren),
  ]);
}

function trimTextNodes(nodes: ElementContent[]): ElementContent[] {
  const out = nodes.filter((n) => !(n.type === 'text' && n.value.trim() === ''));
  const firstNode = out[0];
  if (firstNode?.type === 'text') out[0] = text(firstNode.value.replace(/^\s+/, ''));
  const lastNode = out[out.length - 1];
  if (lastNode?.type === 'text') out[out.length - 1] = text(lastNode.value.replace(/\s+$/, ''));
  return out;
}
