import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { DocPath, VaultId } from '../../../shared/api-types';
import { isImagePath } from './doc-url';
import { documentQueryOptions } from './queries';

// PO-51: hent dokumentet i forkant når brukeren viser intensjon (hover ~80 ms, fokus, valgt treff i ⌘K).
// Billig: maks én prefetch om gangen; mens en pågår, huskes bare den siste forespørselen.

export const PREFETCH_DELAY_MS = 80;

type Prefetch = (vaultId: VaultId, docPath: DocPath) => void;

export function createPrefetcher(client: QueryClient): Prefetch {
  let busy = false;
  let queued: [VaultId, DocPath] | null = null;

  const run = (vaultId: VaultId, docPath: DocPath): void => {
    const options = documentQueryOptions(vaultId, docPath);
    const state = client.getQueryState(options.queryKey);
    if (state && (state.fetchStatus === 'fetching' || (state.data !== undefined && !state.isInvalidated))) {
      next();
      return;
    }
    busy = true;
    void client.prefetchQuery(options).finally(() => {
      busy = false;
      next();
    });
  };

  const next = (): void => {
    if (!queued) return;
    const [vaultId, docPath] = queued;
    queued = null;
    run(vaultId, docPath);
  };

  return (vaultId, docPath) => {
    if (!docPath || isImagePath(docPath)) return;
    if (busy) {
      queued = [vaultId, docPath];
      return;
    }
    run(vaultId, docPath);
  };
}

const prefetchers = new WeakMap<QueryClient, Prefetch>();

export function usePrefetch(): Prefetch {
  const client = useQueryClient();
  return useMemo(() => {
    let prefetch = prefetchers.get(client);
    if (!prefetch) {
      prefetch = createPrefetcher(client);
      prefetchers.set(client, prefetch);
    }
    return prefetch;
  }, [client]);
}

export interface PrefetchIntentHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
}

/** Hendelser for en lenke: hover i {@link PREFETCH_DELAY_MS} ms eller fokus → prefetch. */
export function usePrefetchIntent(vaultId: VaultId, docPath: DocPath | undefined): PrefetchIntentHandlers {
  const prefetch = usePrefetch();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = useCallback(() => clearTimeout(timer.current), []);
  useEffect(() => cancel, [cancel]);
  return useMemo(
    () => ({
      onMouseEnter: () => {
        if (!docPath) return;
        cancel();
        timer.current = setTimeout(() => prefetch(vaultId, docPath), PREFETCH_DELAY_MS);
      },
      onMouseLeave: cancel,
      onFocus: () => {
        if (docPath) prefetch(vaultId, docPath);
      },
    }),
    [cancel, docPath, prefetch, vaultId],
  );
}
