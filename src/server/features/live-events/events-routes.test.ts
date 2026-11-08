import { describe, expect, it } from 'vitest';
import type { ChangedEvent } from '../../../shared/api-types';
import { createEventsRoutes } from './events-routes';

function fakeVault() {
  const listeners = new Set<(e: ChangedEvent) => void>();
  return {
    ready: async () => ({ revision: 3 }),
    subscribe: (l: (e: ChangedEvent) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    emit: (e: ChangedEvent) => listeners.forEach((l) => l(e)),
    get listenerCount() {
      return listeners.size;
    },
  };
}

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, needle: string): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  while (!text.includes(needle)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  return text;
}

describe('GET /api/events', () => {
  it('sender ready, deretter changed; rydder opp ved frakobling', async () => {
    const vault = fakeVault();
    const app = createEventsRoutes((id) => (id === 'test' ? vault : null), { pingIntervalMs: 20 });
    const controller = new AbortController();
    const response = await app.request('/api/events?vault=test', { signal: controller.signal });
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    const reader = response.body!.getReader();

    const first = await readUntil(reader, 'event: ready');
    expect(first).toContain('data: {"vaultId":"test","revision":3}');

    const changed: ChangedEvent = { vaultId: 'test', revision: 4, changes: [{ type: 'changed', path: 'Velkommen' }] };
    vault.emit(changed);
    const second = await readUntil(reader, 'event: changed');
    expect(second).toContain(JSON.stringify(changed));

    const ping = await readUntil(reader, ': ping');
    expect(ping).toContain(': ping');

    await reader.cancel();
    controller.abort();
    await new Promise((r) => setTimeout(r, 50));
    expect(vault.listenerCount).toBe(0);
  });

  it('ukjent vault gir 404', async () => {
    const app = createEventsRoutes(() => null);
    expect((await app.request('/api/events?vault=nei')).status).toBe(404);
  });
});
