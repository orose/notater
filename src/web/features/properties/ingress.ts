import type { PropertyEntry } from '../../../shared/api-types';

/** PO-21: ingress fra `description`, deretter `summary`. Brukes av notat-headeren og tittellysbildet (ADR-010 §6). */
export function ingressOf(properties: readonly PropertyEntry[]): string | null {
  for (const key of ['description', 'summary']) {
    const entry = properties.find((p) => p.key.toLowerCase() === key);
    if (entry?.value.type === 'string' && entry.value.value.trim()) return entry.value.value.trim();
  }
  return null;
}
