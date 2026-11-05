import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { ChangedEvent, ReadyEvent, Revision } from '../../../shared/api-types';
import { apiError } from '../../shared/api-error';

export interface EventVault {
  ready(): Promise<{ readonly revision: Revision }>;
  subscribe(listener: (event: ChangedEvent) => void): () => void;
}

export type EventSource = (vaultId: string) => EventVault | null;

export interface EventsOptions {
  /** ADR-004: `: ping` hvert 25. sekund. */
  readonly pingIntervalMs?: number;
}

/** `GET /api/events?vault=<id>` – SSE med `ready` og `changed`. */
export function createEventsRoutes(source: EventSource, options: EventsOptions = {}): Hono {
  const pingMs = options.pingIntervalMs ?? 25_000;
  return new Hono().get('/api/events', async (c) => {
    const vaultId = c.req.query('vault') ?? '';
    const vault = source(vaultId);
    if (!vault) return apiError(c, 404, 'VAULT_NOT_FOUND', `Fant ikke vaultet «${vaultId}».`);
    let state: { revision: Revision };
    try {
      state = await vault.ready();
    } catch (error) {
      return apiError(c, 500, 'INTERNAL', error instanceof Error ? error.message : 'Ukjent feil.');
    }
    return streamSSE(c, async (stream) => {
      const queue: ChangedEvent[] = [];
      let wake: (() => void) | null = null;
      const unsubscribe = vault.subscribe((event) => {
        queue.push(event);
        wake?.();
      });
      const ping = setInterval(() => {
        void stream.write(': ping\n\n');
      }, pingMs);
      let closed = false;
      stream.onAbort(() => {
        closed = true;
        wake?.();
      });
      try {
        await stream.writeSSE({ event: 'ready', data: JSON.stringify({ vaultId, revision: state.revision } satisfies ReadyEvent) });
        while (!closed) {
          const next = queue.shift();
          if (next) {
            await stream.writeSSE({ event: 'changed', data: JSON.stringify(next) });
            continue;
          }
          await new Promise<void>((resolve) => (wake = resolve));
          wake = null;
        }
      } finally {
        clearInterval(ping);
        unsubscribe();
      }
    });
  });
}
