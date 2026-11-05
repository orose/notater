import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveReloadProvider } from './LiveReloadProvider';
import { LiveStatus } from './LiveStatus';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private listeners = new Map<string, Array<(e: MessageEvent) => void>>();
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener() {}
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    for (const fn of this.listeners.get(type) ?? []) fn(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={client}>
      <LiveReloadProvider vaultId="test">
        <LiveStatus />
      </LiveReloadProvider>
    </QueryClientProvider>,
  );
  const source = FakeEventSource.instances[0] as FakeEventSource;
  return { client, invalidate, source, ...utils };
}

describe('live reload (AK12)', () => {
  it('kobler til SSE for vaultet', () => {
    const { source } = setup();
    expect(source.url).toBe('/api/events?vault=test');
  });

  it('invaliderer vaultets spørringer ved «changed»', () => {
    const { source, invalidate } = setup();
    act(() => source.emit('ready', { vaultId: 'test', revision: 1 }));
    expect(invalidate).not.toHaveBeenCalled();
    act(() => source.emit('changed', { vaultId: 'test', revision: 2, changes: [{ type: 'changed', path: 'Velkommen' }] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault', 'test'] });
  });

  it('invaliderer ved «ready» med ny revisjon (gjenoppkobling)', () => {
    const { source, invalidate } = setup();
    act(() => source.emit('ready', { vaultId: 'test', revision: 1 }));
    act(() => source.emit('ready', { vaultId: 'test', revision: 4 }));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('viser status i bunnlinjen', () => {
    const { source } = setup();
    act(() => source.emit('ready', { vaultId: 'test', revision: 1 }));
    expect(screen.getByRole('status')).toHaveTextContent(/Synkronisert \d{2}\.\d{2}/);
    act(() => source.onerror?.());
    expect(screen.getByRole('status')).toHaveTextContent('Frakoblet – prøver igjen');
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'offline');
  });

  it('lukker tilkoblingen ved avmontering', () => {
    const { source, unmount } = setup();
    unmount();
    expect(source.closed).toBe(true);
  });
});
