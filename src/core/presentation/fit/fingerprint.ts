// Fingeravtrykk for tilpasningscachen (ADR-010 §2, AR-2-12). Ren TS.

import type { NoteDocument } from '../../../shared/api-types';
import { ingressOf } from '../../format';
import type { SlideDraft, SlideDraftDeck } from '../model';

/** cyrb53: rask 53-bits streng-hash (ikke kryptografisk). */
export function cyrb53(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Base-id-ene (`vr-base[data-base-id]`) et HAST-tre viser. */
export function baseIdsIn(node: unknown, into: string[] = []): string[] {
  const n = node as { type?: string; tagName?: string; properties?: Record<string, unknown>; children?: unknown[] };
  if (n?.type === 'element' && n.tagName === 'vr-base' && typeof n.properties?.dataBaseId === 'string') into.push(n.properties.dataBaseId);
  for (const child of n?.children ?? []) baseIdsIn(child, into);
  return into;
}

/**
 * Innholdsdelen av cachenøkkelen for et utkast (AR-2-12, ADR-011 §1): enhetene, overskriften og det utkastet viser
 * av agenda, tittel og basedata. Flaten legger til det som påvirker layout (web: `LAYOUT_VERSION|typesett`,
 * terminalen: `cols×rows|tetthet`). Palett og lys/mørk er ikke med.
 */
export function draftContentKey(draft: SlideDraft, deck: SlideDraftDeck, subtitles: readonly string[][], doc: NoteDocument): string {
  let context: unknown = null;
  if (draft.kind === 'agenda' || draft.kind === 'transition') context = { agenda: deck.agenda.map((a) => a.text), subtitles };
  if (draft.preamble || draft.kind === 'title') context = { title: deck.title, ingress: ingressOf(doc.properties), properties: doc.properties, aliases: doc.aliases, path: doc.path, mtime: doc.mtime };
  const bases = draft.units.flatMap((u) => baseIdsIn(u.node)).map((id) => doc.bases[id] ?? null);
  return cyrb53(JSON.stringify([draft.kind, draft.address.agenda, draft.heading, draft.continued, draft.units, bases, context]));
}
