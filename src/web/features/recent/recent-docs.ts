import { useSyncExternalStore } from 'react';
import type { DocPath, VaultId } from '../../../shared/api-types';

// «Nylig åpnet» per vault (⌘K-tomtilstand og «Nylig»-filteret). Kun nettleserlagring,
// try/catch rundt alt (privat modus).

export interface RecentDoc {
  readonly path: DocPath;
  readonly title: string;
}

const MAX = 12;
const EVENT = 'vault-leser:recent';
const key = (vaultId: VaultId) => `vault-leser.nylig.${vaultId}`;
const cache = new Map<string, { raw: string | null; value: RecentDoc[] }>();
const EMPTY: RecentDoc[] = [];

export function readRecent(vaultId: VaultId): RecentDoc[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key(vaultId));
  } catch {
    return EMPTY;
  }
  const cached = cache.get(vaultId);
  if (cached && cached.raw === raw) return cached.value;
  let value: RecentDoc[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      value = parsed.filter(
        (d): d is RecentDoc => typeof d === 'object' && d !== null && typeof d.path === 'string' && typeof d.title === 'string',
      );
    }
  } catch {
    value = EMPTY;
  }
  cache.set(vaultId, { raw, value });
  return value;
}

export function pushRecent(vaultId: VaultId, doc: RecentDoc): void {
  const next = [doc, ...readRecent(vaultId).filter((d) => d.path !== doc.path)].slice(0, MAX);
  try {
    window.localStorage.setItem(key(vaultId), JSON.stringify(next));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function useRecentDocs(vaultId: VaultId): readonly RecentDoc[] {
  return useSyncExternalStore(
    subscribe,
    () => readRecent(vaultId),
    () => EMPTY,
  );
}
