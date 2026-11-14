import type { ElementContent, RootContent } from 'hast';

/**
 * Inline-tekst uten ekstra mellomrom mellom noder (`**Kaf**ka` → «Kafka»). Én implementasjon for tittel,
 * oppgaveetiketter og disposisjon (ADR-011 §1, K2).
 */
export function inlineText(node: RootContent | ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(inlineText).join('');
  return '';
}
