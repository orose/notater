import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiGet } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiGet', () => {
  it('returnerer JSON ved 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })));
    await expect(apiGet('/api/health')).resolves.toEqual({ status: 'ok' });
  });

  it('kaster ApiRequestError med kode og melding fra ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Fant ikke dokumentet' } }), {
            status: 404,
          }),
      ),
    );
    const error = await apiGet('/api/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 404, code: 'DOCUMENT_NOT_FOUND', message: 'Fant ikke dokumentet' });
  });

  it('tåler feilsvar uten JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })));
    await expect(apiGet('/api/x')).rejects.toMatchObject({ status: 502, code: 'INTERNAL' });
  });
});
