/** Minimal LRU-cache (Map beholder innsettingsrekkefølge). Brukes som render-cache (ADR-002). */
export interface LruCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  /** Uten å endre rekkefølgen (forhåndsrendering skal ikke «bruke» oppføringer). */
  has(key: K): boolean;
  readonly size: number;
}

export function createLruCache<K, V>(capacity: number): LruCache<K, V> {
  const map = new Map<K, V>();
  return {
    get(key) {
      const value = map.get(key);
      if (value === undefined) return undefined;
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, value);
      if (map.size > capacity) map.delete(map.keys().next().value as K);
    },
    has: (key) => map.has(key),
    get size() {
      return map.size;
    },
  };
}
