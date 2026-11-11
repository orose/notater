// Fingeravtrykk for tilpasningscachen (ADR-010 §2, AR-2-12). Ren TS.

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
