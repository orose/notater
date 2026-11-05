import type { Element, ElementContent, Root } from 'hast';
import type { DocPath } from '../../../shared/api-types';

export interface OutgoingLink {
  /** null = brutt lenke. */
  readonly target: DocPath | null;
  readonly title: string;
  readonly count: number;
  readonly embed: boolean;
  readonly broken: boolean;
}

function titleOf(target: DocPath): string {
  const i = target.lastIndexOf('/');
  return i === -1 ? target : target.slice(i + 1);
}

/** «Lenker herfra» (designsystem §7.1) utledet fra HAST – ingen egen API-forespørsel. */
export function collectOutgoingLinks(tree: Root, selfPath: DocPath): OutgoingLink[] {
  const map = new Map<string, { target: DocPath | null; title: string; count: number; embed: boolean; broken: boolean }>();

  const add = (key: string, target: DocPath | null, title: string, embed: boolean) => {
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.embed ||= embed;
    } else {
      map.set(key, { target, title, count: 1, embed, broken: target === null });
    }
  };

  const visit = (nodes: readonly ElementContent[]) => {
    for (const node of nodes) {
      if (node.type !== 'element') continue;
      const el: Element = node;
      const p = el.properties;
      if (el.tagName === 'vr-embed') {
        const target = typeof p.dataTarget === 'string' ? p.dataTarget : null;
        if (p.dataStatus === 'ok' && target && target !== selfPath) add(`t:${target}`, target, titleOf(target), true);
        continue; // lenker inne i embeds tilhører det innebygde notatet
      }
      if (el.tagName === 'a' && p.dataVrLink === 'internal' && typeof p.dataVrTarget === 'string') {
        if (p.dataVrTarget !== selfPath) add(`t:${p.dataVrTarget}`, p.dataVrTarget, titleOf(p.dataVrTarget), false);
      } else if (el.tagName === 'a' && p.dataVrLink === 'unresolved') {
        const raw = String(p.dataVrRaw ?? '').split('#')[0]?.split('|')[0]?.trim() || 'Ukjent';
        add(`u:${raw.toLowerCase()}`, null, raw, false);
      }
      visit(el.children);
    }
  };
  visit(tree.children as ElementContent[]);
  return [...map.values()];
}
