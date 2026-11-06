import type { ElementContent, Root, RootContent } from 'hast';
import type { TocEntry } from '../../../shared/api-types';

interface TitledContent {
  readonly title: string;
  readonly content: Root;
  readonly toc: readonly TocEntry[];
}

/** Inline-tekst uten ekstra mellomrom mellom noder (`**Kaf**ka` → «Kafka»). */
function inlineText(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(inlineText).join('');
  return '';
}

function isBlankText(node: RootContent): boolean {
  return node.type === 'text' && node.value.trim() === '';
}

/**
 * PO-35: er første innholdsblokk en H1, blir den visningstittelen og fjernes fra brødtekst og TOC.
 * Ellers beholdes tittelen (filnavnet). Ren og ikke-muterende (dokumentet ligger i query-cachen).
 */
export function splitLeadingTitle(doc: TitledContent): TitledContent {
  const index = doc.content.children.findIndex((node) => !isBlankText(node));
  const first = doc.content.children[index];
  if (first?.type !== 'element' || first.tagName !== 'h1') return doc;
  const title = inlineText(first).replace(/\s+/g, ' ').trim();
  if (!title) return doc;
  const id = typeof first.properties.id === 'string' ? first.properties.id : null;
  return {
    title,
    content: { ...doc.content, children: doc.content.children.filter((_, i) => i !== index) },
    toc: id === null ? doc.toc : doc.toc.filter((entry) => entry.id !== id),
  };
}
