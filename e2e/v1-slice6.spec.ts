// Avsluttende akseptanse v1 – slice 6-funksjoner: prefetch (PO-51), `--lan` (PO-3, BE33), `npm start` som
// gjenbruker bygget (PO-4), og at API-et fortsatt bare svarer på GET/HEAD (B1). `renamed` via SSE (PO-49/BE32)
// ligger i ak12-live-reload.spec.ts sammen med de andre live reload-testene.
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { E2E_PORT, REPO, removeDir, startServer, writeConfig } from './support/real-server';
import { expect, noteUrl, openNote, test } from './support/guards';

/** Rå HTTP-GET mot 127.0.0.1 eller en annen adresse med valgfri Host-header (fetch kan ikke sette Host). */
function rawGet(address: string, port: number, path: string, host?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: address, port, path, method: 'GET', headers: host ? { Host: host } : {}, timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

const externalIp = () =>
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;

test.describe('Prefetch ved hover/fokus (PO-51)', () => {
  test('hover over en intern lenke henter dokumentet før klikk', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Hover finnes ikke på touch');
    await openNote(page, 'lenker/Lenketest');
    const link = page.locator('main article').getByRole('link', { name: 'Faktura.md', exact: true });
    await link.scrollIntoViewIfNeeded();
    const prefetched = page.waitForRequest((r) => r.url().includes('/api/vaults/test/document?path=domene%2FFaktura'), { timeout: 3000 });
    await link.hover();
    await prefetched;
    // Klikk etter prefetch: innholdet vises uten ny dokumentforespørsel.
    let refetched = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/vaults/test/document?path=domene%2FFaktura')) refetched = true;
    });
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Faktura');
    expect(refetched).toBe(false);
  });

  test('tastaturfokus på en lenke prefetcher også', async ({ page }) => {
    await openNote(page, 'lenker/Lenketest');
    const link = page.locator('main article').getByRole('link', { name: 'Avtale', exact: true });
    const prefetched = page.waitForRequest((r) => r.url().includes('/api/vaults/test/document?path=domene%2Favtale'), { timeout: 3000 });
    await link.focus();
    await prefetched;
  });
});

test.describe('B1: API-et svarer bare på GET/HEAD', () => {
  const endpoints = [
    '/api/health',
    '/api/vaults',
    '/api/vaults/test/tree',
    '/api/vaults/test/document?path=Velkommen',
    '/api/vaults/test/backlinks?path=Velkommen',
    '/api/vaults/test/tags',
    '/api/vaults/test/search?q=kafka',
    '/api/vaults/test/assets?path=attachments%2Flogo.svg',
    '/api/events?vault=test',
    '/api/finnes-ikke',
  ];
  for (const url of endpoints) {
    test(`${url}: POST/PUT/PATCH/DELETE/OPTIONS → 405, HEAD ok`, async ({ request }) => {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
        const res = await request.fetch(url, { method, data: '{"x":1}', headers: { 'content-type': 'application/json' } });
        expect(res.status(), `${method} ${url}`).toBe(405);
      }
      if (!url.startsWith('/api/events')) {
        const head = await request.fetch(url, { method: 'HEAD' });
        expect([200, 404], `HEAD ${url}`).toContain(head.status());
      }
    });
  }
});

test.describe('--lan (PO-3, BE33)', () => {
  test.describe.configure({ mode: 'serial' });

  test('med --lan: egen IP og <maskinnavn>.local godtas, fremmed vert 403, advarsel skrives', async ({ request: _request }, info) => {
    void _request;
    test.skip(info.project.name !== 'desktop', 'Én server-test holder');
    const ip = externalIp();
    test.skip(!ip, 'Ingen ikke-loopback IPv4 i containeren');
    const dir = join(process.env.E2E_TMP_DIR!, 'lan');
    removeDir(dir);
    mkdirSync(dir, { recursive: true });
    cpSync(join(process.env.E2E_TMP_DIR!, 'dist'), join(dir, 'dist'), { recursive: true });
    const port = E2E_PORT + 7;
    const server = await startServer(dir, writeConfig(dir, process.env.E2E_VAULT_DIR!, port), port, 60_000, 'test', ['--lan']);
    try {
      expect(server.log()).toContain('ADVARSEL: LAN-modus');
      expect(server.log()).toContain(`http://${ip}:${port}`);
      // Faktisk tilkobling via ikke-loopback-adressen.
      expect(await rawGet(ip!, port, '/api/health')).toBe(200);
      expect(await rawGet('127.0.0.1', port, '/api/health', `${ip}:${port}`)).toBe(200);
      const { hostname } = await import('node:os');
      expect(await rawGet('127.0.0.1', port, '/api/health', `${hostname().toLowerCase()}.local:${port}`)).toBe(200);
      expect(await rawGet('127.0.0.1', port, '/api/health', `localhost:${port}`)).toBe(200);
      // DNS-rebinding: fremmed vertsnavn avvises fortsatt.
      expect(await rawGet(ip!, port, '/api/health', `evil.example:${port}`)).toBe(403);
      expect(await rawGet('127.0.0.1', port, '/api/health', `10.99.99.99:${port}`)).toBe(403);
      // Fortsatt skrivebeskyttet.
      const post = await new Promise<number>((resolve, reject) => {
        const req = httpRequest({ host: ip, port, path: '/api/vaults', method: 'POST' }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end('x');
      });
      expect(post).toBe(405);
    } finally {
      await server.stop();
      removeDir(dir);
    }
  });

  test('uten --lan: bare loopback svarer, egen IP som Host avvises', async ({ request: _request }, info) => {
    void _request;
    test.skip(info.project.name !== 'desktop', 'Én server-test holder');
    const ip = externalIp();
    test.skip(!ip, 'Ingen ikke-loopback IPv4 i containeren');
    await expect(rawGet(ip!, E2E_PORT, '/api/health')).rejects.toThrow();
    expect(await rawGet('127.0.0.1', E2E_PORT, '/api/health', `${ip}:${E2E_PORT}`)).toBe(403);
    expect(await rawGet('127.0.0.1', E2E_PORT, '/api/health', `127.0.0.1:${E2E_PORT}`)).toBe(200);
  });
});

test.describe('npm start gjenbruker bygget (PO-4)', () => {
  test('andre `npm start` uten kildeendring bygger ikke på nytt; endring i src/web gir nytt bygg', async ({ request: _request }, info) => {
    void _request;
    test.skip(info.project.name !== 'desktop', 'Én server-test holder');
    test.setTimeout(240_000);
    const dir = join(process.env.E2E_TMP_DIR!, 'npm-start');
    removeDir(dir);
    mkdirSync(dir, { recursive: true });
    for (const entry of ['src', 'scripts', 'docs/design', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.base.json', 'tsconfig.web.json', 'tsconfig.server.json', 'tsconfig.tooling.json', '.nvmrc']) {
      cpSync(join(REPO, entry), join(dir, entry), { recursive: true });
    }
    cpSync(process.env.E2E_VAULT_DIR!, join(dir, 'test-vault'), { recursive: true });
    symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'), 'dir');
    const port = E2E_PORT + 8;
    writeFileSync(join(dir, 'vault-reader.config.json'), JSON.stringify({ port, defaultVault: 'test', vaults: [{ id: 'test', path: './test-vault' }] }));

    const npmStart = async (): Promise<{ log: string; ms: number }> => {
      const started = Date.now();
      const child: ChildProcess = spawn('npm', ['start'], { cwd: dir, env: { ...process.env, VAULT_READER_PORT: undefined, VAULT_READER_CONFIG: undefined }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
      let log = '';
      child.stdout?.on('data', (d: Buffer) => (log += d.toString()));
      child.stderr?.on('data', (d: Buffer) => (log += d.toString()));
      try {
        await expect
          .poll(async () => (await rawGet('127.0.0.1', port, '/api/health').catch(() => 0)), { timeout: 180_000, intervals: [250] })
          .toBe(200);
        return { log, ms: Date.now() - started };
      } finally {
        process.kill(-child.pid!, 'SIGTERM');
        await new Promise((r) => child.once('exit', r));
      }
    };

    const first = await npmStart();
    expect(first.log).not.toContain('gjenbruker');
    const stamp = statSync(join(dir, 'dist/web/index.html')).mtimeMs;
    const second = await npmStart();
    expect(second.log).toContain('Nettsiden er uendret siden forrige bygg – gjenbruker');
    expect(statSync(join(dir, 'dist/web/index.html')).mtimeMs).toBe(stamp);
    test.info().annotations.push({ type: 'måling', description: `npm start: første ${first.ms} ms (med bygg), andre ${second.ms} ms (gjenbruk)` });

    // Endret kilde → nytt bygg.
    const main = join(dir, 'src/web/main.tsx');
    writeFileSync(main, `${readFileSync(main, 'utf8')}\n// endret av e2e\n`);
    const third = await npmStart();
    expect(third.log).not.toContain('gjenbruker');
    removeDir(dir);
  });
});

test('appen virker fra den bygde serveren etter alt over (røyk)', async ({ page }) => {
  await page.goto(noteUrl('Velkommen'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Velkommen til testvaultet');
});
