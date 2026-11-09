// LRU-cache for tilpasningen (ADR-010 §2). Lever så lenge vaultet er åpent.

import type { DraftFit } from '../model';
import type { FitCache, FitKey } from './fit-types';

export const FIT_CACHE_MAX = 500;

export function fitKeyString(key: FitKey): string {
  return `${key.layoutVersion}|${key.typeset}|${key.content}`;
}

export function createFitCache(max = FIT_CACHE_MAX): FitCache {
  const entries = new Map<string, DraftFit>();
  return {
    get(key) {
      const k = fitKeyString(key);
      const hit = entries.get(k);
      if (hit) {
        entries.delete(k);
        entries.set(k, hit);
      }
      return hit;
    },
    set(key, fit) {
      const k = fitKeyString(key);
      entries.delete(k);
      entries.set(k, fit);
      while (entries.size > max) entries.delete(entries.keys().next().value as string);
    },
    clear() {
      entries.clear();
    },
  };
}
