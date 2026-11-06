import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type { ChangedEvent, ReadyEvent, VaultId } from '../../../shared/api-types';
import { queryKeys } from '../../shared/api';
import { INITIAL_LIVE_STATE, LiveContext, detectMoves, type LiveState } from './live-context';

function parse<T>(event: MessageEvent): T | null {
  try {
    return JSON.parse(String(event.data)) as T;
  } catch {
    return null;
  }
}

/** SSE `/api/events` → `invalidateQueries(['vault', vaultId])` (ADR-004, AK12). */
export function LiveReloadProvider({ vaultId, children }: { readonly vaultId: VaultId; readonly children: ReactNode }) {
  const client = useQueryClient();
  const [state, setState] = useState<LiveState>(INITIAL_LIVE_STATE);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return undefined;
    let revision: number | null = null;
    const source = new EventSource(`/api/events?vault=${encodeURIComponent(vaultId)}`);
    const invalidate = () => void client.invalidateQueries({ queryKey: queryKeys.vault(vaultId) });

    /** BUG-007: første «ready» sammenlignes med revisjonene i data vi allerede har hentet. */
    const cachedRevisions = (): number[] =>
      client
        .getQueriesData<{ revision?: unknown }>({ queryKey: queryKeys.vault(vaultId) })
        .map(([, data]) => data?.revision)
        .filter((r): r is number => typeof r === 'number');

    source.addEventListener('ready', (event) => {
      const data = parse<ReadyEvent>(event as MessageEvent);
      const known = revision !== null ? [revision] : cachedRevisions();
      if (data && known.some((r) => r !== data.revision)) invalidate();
      if (data) revision = data.revision;
      setState((s) => ({ ...s, status: 'live', lastSync: new Date() }));
    });
    source.addEventListener('changed', (event) => {
      const data = parse<ChangedEvent>(event as MessageEvent);
      if (data) revision = data.revision;
      const moves = data ? detectMoves(data.changes) : {};
      invalidate();
      setState((s) => ({ status: 'live', lastSync: new Date(), pulse: s.pulse + 1, moved: { ...s.moved, ...moves } }));
    });
    source.onopen = () => setState((s) => ({ ...s, status: 'live' }));
    source.onerror = () => setState((s) => ({ ...s, status: 'offline' }));

    return () => source.close();
  }, [client, vaultId]);

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}
