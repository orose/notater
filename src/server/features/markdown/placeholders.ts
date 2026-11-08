/**
 * Plassholdere: Obsidian-noder som skal bli pålitelige `vr-*`-elementer kan ikke gå gjennom
 * sanitizeren som de er. De erstattes før sanering av et tomt `span`/`div` med
 * `data-vr-ref="<nonce>-<n>"`, og dataene legges i en sidetabell. Etter sanering ekspanderes kun
 * plassholdere med riktig nonce (tilfeldig per rendering), så rå HTML kan ikke forfalske dem.
 */
import { randomBytes } from 'node:crypto';
import type { Element } from 'hast';
import type { UnsupportedNode, WikiLink } from '../markdown-syntax';
import { h } from './hast-builders';

export type PlaceholderData =
  | { readonly kind: 'wikiLink'; readonly node: WikiLink }
  | { readonly kind: 'tag'; readonly value: string }
  | { readonly kind: 'unsupported'; readonly node: UnsupportedNode }
  | { readonly kind: 'code'; readonly lang: string; readonly meta: string; readonly value: string };

export interface PlaceholderTable {
  /** Lager plassholder-elementet og lagrer dataene. */
  create(data: PlaceholderData, block: boolean): Element;
  /** Slår opp en `data-vr-ref`-verdi. `null` hvis ukjent/forfalsket. */
  lookup(ref: unknown): PlaceholderData | null;
}

export function createPlaceholderTable(): PlaceholderTable {
  const nonce = randomBytes(9).toString('base64url');
  const entries: PlaceholderData[] = [];
  return {
    create(data, block) {
      entries.push(data);
      return h(block ? 'div' : 'span', { dataVrRef: `${nonce}-${entries.length - 1}` });
    },
    lookup(ref) {
      if (typeof ref !== 'string' || !ref.startsWith(`${nonce}-`)) return null;
      return entries[Number(ref.slice(nonce.length + 1))] ?? null;
    },
  };
}
