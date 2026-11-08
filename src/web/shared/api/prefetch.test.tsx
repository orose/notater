import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFETCH_DELAY_MS, createPrefetcher, usePrefetchIntent } from './prefetch';
import { queryKeys } from './query-keys';

function deferredFetch() {
  const resolvers: Array<() => void> = [];
  const fetchMock = vi.fn(
    (url: string) =>
      new Promise<Response>((resolve) => {
        resolvers.push(() => resolve(new Response(JSON.stringify({ path: new URL(url, 'http://x').searchParams.get('path'), revision: 1 }))));
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, resolveNext: () => resolvers.shift()?.() };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createPrefetcher (PO-51)', () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient();
  });

  it('henter dokumentet inn i cachen med samme nøkkel som useDocument', async () => {
    const { fetchMock, resolveNext } = deferredFetch();
    const prefetch = createPrefetcher(client);
    prefetch('test', 'domene/Ordre');
    expect(fetchMock).toHaveBeenCalledWith('/api/vaults/test/document?path=domene%2FOrdre', expect.anything());
    resolveNext();
    await vi.waitFor(() => expect(client.getQueryData(queryKeys.document('test', 'domene/Ordre'))).toBeDefined());
  });

  it('maks én samtidig: neste venter, og bare den siste i køen hentes', async () => {
    const { fetchMock, resolveNext } = deferredFetch();
    const prefetch = createPrefetcher(client);
    prefetch('test', 'A');
    prefetch('test', 'B');
    prefetch('test', 'C');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveNext();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('path=C');
  });

  it('henter ikke det som allerede er i cachen', () => {
    const { fetchMock } = deferredFetch();
    client.setQueryData(queryKeys.document('test', 'A'), { revision: 1 });
    createPrefetcher(client)('test', 'A');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('henter ikke bilder (de har ingen document-forespørsel)', () => {
    const { fetchMock } = deferredFetch();
    createPrefetcher(client)('test', 'attachments/arkitektur.png');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function Probe({ path }: { readonly path: string }) {
  const intent = usePrefetchIntent('test', path);
  return (
    <a href="#x" {...intent}>
      lenke
    </a>
  );
}

describe('usePrefetchIntent', () => {
  function setup() {
    const { fetchMock } = deferredFetch();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe path="domene/Ordre" />
      </QueryClientProvider>,
    );
    return { fetchMock, link: screen.getByText('lenke') };
  }

  it(`hover i ${PREFETCH_DELAY_MS} ms starter prefetch`, () => {
    vi.useFakeTimers();
    const { fetchMock, link } = setup();
    fireEvent.mouseEnter(link);
    act(() => vi.advanceTimersByTime(PREFETCH_DELAY_MS - 10));
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('kort hover (mus forbi) henter ikke', () => {
    vi.useFakeTimers();
    const { fetchMock, link } = setup();
    fireEvent.mouseEnter(link);
    fireEvent.mouseLeave(link);
    act(() => vi.advanceTimersByTime(500));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fokus (tastatur) henter med en gang', () => {
    const { fetchMock, link } = setup();
    fireEvent.focus(link);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
