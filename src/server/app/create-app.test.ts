import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ApiError,
  BacklinksResponse,
  DocumentResponse,
  HealthResponse,
  SearchResponse,
  TagsResponse,
  TreeResponse,
  VaultsResponse,
} from '../../shared/api-types';
import { testHighlighter } from '../test-support/render-fixtures';
import { createInlineMetaExtractor } from '../features/vault-index';
import { createVaultRegistry } from '../features/vault-registry';
import type { VaultRegistry } from '../features/vault-registry';
import { createApp } from './create-app';
import { APP_CSP, hostnameOf } from './security';

let registry: VaultRegistry;
let app: ReturnType<typeof createApp>;
const HOST = { host: '127.0.0.1:4317' };
const get = (path: string, headers: Record<string, string> = HOST) => app.request(path, { headers });

beforeAll(async () => {
  registry = createVaultRegistry(
    { defaultVaultId: 'test', vaults: [{ id: 'test', name: 'Testvault', root: join(process.cwd(), 'test-vault'), ignore: [], hiddenProperties: [] }] },
    { highlighter: testHighlighter, createInitialExtractor: createInlineMetaExtractor, incrementalExtractor: createInlineMetaExtractor(), watch: null, prerenderCount: 0 },
  );
  app = createApp({ webRoot: './dist/web', version: '0.0.0-test', registry });
  await registry.get('test')!.ready();
}, 60_000);

afterAll(async () => {
  await registry.close();
});

describe('sikkerhet (AK20, ADR-005)', () => {
  it('svarer på helsesjekk med CSP og nosniff', async () => {
    const response = await get('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<HealthResponse>({ status: 'ok', version: '0.0.0-test' });
    expect(response.headers.get('Content-Security-Policy')).toBe(APP_CSP);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('avviser fremmed Host (DNS-rebinding) med 403', async () => {
    const response = await get('/api/health', { host: 'evil.example:4317' });
    expect(response.status).toBe(403);
    expect(((await response.json()) as ApiError).error.code).toBe('FORBIDDEN');
    expect((await get('/api/health', { host: 'localhost:5173' })).status).toBe(200);
  });

  it('kun GET: andre metoder gir 405 (B1)', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await app.request('/api/vaults/test/document?path=Velkommen', { method, headers: HOST });
      expect(response.status, method).toBe(405);
    }
  });

  it('hostnameOf', () => {
    expect(hostnameOf('LOCALHOST:4317')).toBe('localhost');
    expect(hostnameOf('[::1]:4317')).toBe('[::1]');
  });

  it('ukjent API-rute gir JSON-404', async () => {
    const response = await get('/api/finnes-ikke');
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(((await response.json()) as ApiError).error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/vaults', () => {
  it('lister vaults uten disk-sti', async () => {
    const body = (await (await get('/api/vaults')).json()) as VaultsResponse;
    expect(body.defaultVaultId).toBe('test');
    expect(body.vaults[0]).toMatchObject({ id: 'test', name: 'Testvault', status: 'ready', noteCount: 91, revision: 1 });
    expect(JSON.stringify(body)).not.toContain('test-vault');
  });
});

describe('GET /tree', () => {
  it('gir treet; ukjent vault gir 404', async () => {
    const body = (await (await get('/api/vaults/test/tree')).json()) as TreeResponse;
    expect(body.root.children.map((c) => c.name)).toContain('domene');
    expect(JSON.stringify(body)).not.toContain('.obsidian');
    const missing = await get('/api/vaults/nei/tree');
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as ApiError).error.code).toBe('VAULT_NOT_FOUND');
  });
});

describe('GET /document', () => {
  it('notat med enkodet sti (& og mellomrom, QA-URL-04)', async () => {
    const response = await get(`/api/vaults/test/document?path=${encodeURIComponent('edge/R&D – spørsmål og svar')}`);
    expect(response.status).toBe(200);
    expect(((await response.json()) as DocumentResponse).title).toBe('R&D – spørsmål og svar');
  });

  it('traversal, absolutte stier og NUL gir 400/404 (QA-URL-08)', async () => {
    const cases = ['../../etc/passwd', '%2e%2e/%2e%2e/etc/passwd', '..%2fetc%2fpasswd', '/etc/hosts', 'a\0b', '', '.obsidian/app.json'];
    for (const path of cases) {
      const response = await get(`/api/vaults/test/document?path=${encodeURIComponent(path)}`);
      expect([400, 404], path).toContain(response.status);
    }
    expect((await get('/api/vaults/test/document')).status).toBe(400);
  });

  it('ukjent dokument gir DOCUMENT_NOT_FOUND', async () => {
    const response = await get('/api/vaults/test/document?path=Finnes%20ikke');
    expect(response.status).toBe(404);
    expect(((await response.json()) as ApiError).error.code).toBe('DOCUMENT_NOT_FOUND');
  });
});

describe('GET /tags og /backlinks (PO-24, PO-28)', () => {
  it('taggoversikt', async () => {
    const body = (await (await get('/api/vaults/test/tags')).json()) as TagsResponse;
    expect(body.vaultId).toBe('test');
    const task = body.tags.find((t) => t.tag.toLowerCase() === 'task');
    expect(task?.count).toBeGreaterThan(1);
    const keys = body.tags.map((t) => t.tag.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('«Lenket fra» for mål som ikke finnes', async () => {
    const body = (await (await get('/api/vaults/test/backlinks?path=Finnes%20ikke')).json()) as BacklinksResponse;
    expect(body.exists).toBe(false);
    expect(body.backlinks.length).toBeGreaterThan(0);
    expect((await get('/api/vaults/test/backlinks')).status).toBe(400);
  });
});

describe('GET /search', () => {
  it('søk med limit, alias og tagg', async () => {
    const body = (await (await get('/api/vaults/test/search?q=Bestilling&limit=3')).json()) as SearchResponse;
    expect(body.hits[0]).toMatchObject({ path: 'domene/Ordre', matchedField: 'alias' });
    expect(body.hits.length).toBeLessThanOrEqual(3);
    const secret = (await (await get('/api/vaults/test/search?q=HEMMELIG-KOMMENTAR')).json()) as SearchResponse;
    // README-QA nevner selv ordet (i inline-kode); kommentaren i Markdown-elementer skal aldri treffe.
    expect(secret.hits.map((h) => h.path).filter((p) => p !== 'README-QA')).toEqual([]);
    const trash = (await (await get(`/api/vaults/test/search?q=${encodeURIComponent('Slettet notat')}`)).json()) as SearchResponse;
    expect(trash.hits.map((h) => h.path)).not.toContain('Slettet notat');
    const tag = (await (await get(`/api/vaults/test/search?q=${encodeURIComponent('#kafka-topic')}&limit=50`)).json()) as SearchResponse;
    expect(tag.hits.map((h) => h.path)).toContain('domene/delt/kunde-endret');
    expect(tag.hits.map((h) => h.path)).not.toContain('domene/Hendelseskatalog');
  });

  it('tom spørring gir tom liste, limit kappes til 50', async () => {
    expect(((await (await get('/api/vaults/test/search?q=')).json()) as SearchResponse).hits).toEqual([]);
    expect(((await (await get('/api/vaults/test/search?q=e&limit=500')).json()) as SearchResponse).hits.length).toBeLessThanOrEqual(50);
  });
});

describe('GET /assets', () => {
  it('serverer SVG med streng CSP, nosniff og ETag (QA-IMG-12)', async () => {
    const response = await get('/api/vaults/test/assets?path=attachments%2Fondsinnet.svg');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(response.headers.get('Content-Security-Policy')).toContain('sandbox');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const etag = response.headers.get('ETag')!;
    expect((await get('/api/vaults/test/assets?path=attachments%2Fondsinnet.svg', { ...HOST, 'if-none-match': etag })).status).toBe(304);
  });

  it('nekter ikke-bilder, traversal og ukjente filer', async () => {
    for (const path of ['Velkommen.md', 'Oppgaver.base', '../../etc/passwd', 'attachments/mangler.png', '.obsidian/app.json']) {
      const response = await get(`/api/vaults/test/assets?path=${encodeURIComponent(path)}`);
      expect(response.status, path).toBe(404);
    }
  });
});

describe('aktivitetssporing (BUG-008)', () => {
  it('API-forespørsler teller som opptatt mens de pågår; SSE-tilkoblingen teller ikke', async () => {
    const { createActivityTracker } = await import('../shared/activity');
    const activity = createActivityTracker();
    const tracked = createApp({ webRoot: './dist/web', version: '0', registry, activity });
    const seen: boolean[] = [];
    const begin = activity.begin.bind(activity);
    activity.begin = () => {
      seen.push(true);
      return begin();
    };
    await tracked.request('/api/vaults/test/document?path=Velkommen', { headers: HOST });
    expect(seen).toHaveLength(1);
    expect(activity.busy).toBe(false);
    const controller = new AbortController();
    const sse = await tracked.request('/api/events?vault=test', { headers: HOST, signal: controller.signal });
    expect(sse.status).toBe(200);
    expect(seen).toHaveLength(1);
    controller.abort();
    await sse.body?.cancel().catch(() => undefined);
  });

  it('dokument-svar har Server-Timing (venting og oppbygging)', async () => {
    const response = await get('/api/vaults/test/document?path=Velkommen');
    expect(response.headers.get('Server-Timing')).toMatch(/^wait;dur=\d+(\.\d)?, build;dur=\d+(\.\d)?$/);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  });

  it('dokument-forespørsler forhåndsrendrer lenkemålene (prefetch)', async () => {
    const state = await registry.get('test')!.renderReady();
    expect(state.renderCache.has('domene/Ordre.md')).toBe(false);
    await get('/api/vaults/test/document?path=lenker/Lenketest');
    for (let i = 0; i < 100 && !state.renderCache.has('domene/Ordre.md'); i++) await new Promise((r) => setTimeout(r, 10));
    expect(state.renderCache.has('domene/Ordre.md')).toBe(true);
  });
});

describe('LAN-modus (PO-3): vertssjekken beskytter fortsatt', () => {
  it('egne adresser og <hostname>.local slipper inn, fremmede navn får 403', async () => {
    const lanApp = createApp({
      webRoot: './dist/web',
      version: '0',
      registry,
      isAllowedHost: (h) => ['127.0.0.1', 'localhost', '192.168.1.23', 'mac.local'].includes(h),
    });
    const status = async (host: string) => (await lanApp.request('/api/health', { headers: { host } })).status;
    expect(await status('192.168.1.23:4317')).toBe(200);
    expect(await status('mac.local:4317')).toBe(200);
    expect(await status('localhost:4317')).toBe(200);
    expect(await status('evil.example:4317')).toBe(403);
    expect(await status('192.168.1.24:4317')).toBe(403);
  });

  it('uten LAN-modus er bare 127.0.0.1/localhost tillatt (som før)', async () => {
    expect((await get('/api/health', { host: '192.168.1.23:4317' })).status).toBe(403);
  });
});
