// AK20 Sikkerhet: path traversal, sanitering/XSS, headere, Host-guard, kun GET. Mot den ekte serveren.
// Fasit: README-QA §13 (QA-SEC-*), QA-URL-08, QA-IMG-12, QA-LNK-05, QA-FM-03, QA-MER-05.
import { E2E_PORT } from './support/real-server';
import { expect, noteUrl, openNote, test } from './support/guards';

const SIKKERHET = 'edge/Sikkerhet – ondsinnet HTML';

test.describe('AK20 path traversal mot API-et (QA-URL-08)', () => {
  const payloads = [
    '../package.json',
    '../../package.json',
    '..%2Fpackage.json',
    '%2e%2e/%2e%2e/package.json',
    '%252e%252e%252fpackage.json',
    '..\\..\\package.json',
    'attachments/../../package.json',
    'attachments/..%2f..%2fpackage.json',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    '....//....//package.json',
    '.obsidian/plugins/dataview/README',
    '.obsidian/plugins/dataview/README.md',
    '.trash/Slettet notat',
    '../vault-reader.e2e.json',
  ];
  const endpoints = ['document', 'assets'];

  for (const endpoint of endpoints) {
    for (const payload of payloads) {
      test(`${endpoint}?path=${payload} → 400/404 uten innhold utenfra`, async ({ request }) => {
        const res = await request.get(`/api/vaults/test/${endpoint}?path=${encodeURIComponent(payload)}`);
        expect([400, 404]).toContain(res.status());
        const body = await res.text();
        expect(body).not.toContain('"devDependencies"');
        expect(body).not.toContain('root:x:0:0');
        expect(body).not.toContain('"vaults"');
        expect(body).not.toContain('#task');
      });
    }
  }

  test('NUL-byte og tom sti gir 400', async ({ request }) => {
    expect((await request.get('/api/vaults/test/document?path=Velkommen%00')).status()).toBe(400);
    expect((await request.get('/api/vaults/test/document?path=Velkommen%00.md')).status()).toBe(400);
    expect((await request.get('/api/vaults/test/assets?path=attachments%2Flogo.svg%00')).status()).toBe(400);
    expect((await request.get('/api/vaults/test/document?path=')).status()).toBe(400);
  });

  test('backlinks-endepunktet lekker ingenting for traversal-mål', async ({ request }) => {
    const res = await request.get(`/api/vaults/test/backlinks?path=${encodeURIComponent('../package.json')}`);
    expect([200, 400, 404]).toContain(res.status());
    if (res.status() === 200) expect(await res.json()).toMatchObject({ exists: false, backlinks: [] });
  });

  test('vault-id med traversal gir 404 VAULT_NOT_FOUND', async ({ request }) => {
    const res = await request.get('/api/vaults/..%2F..%2Fetc/document?path=passwd');
    expect(res.status()).toBe(404);
  });

  test('statiske ruter serverer aldri filer utenfor webroot (vault, konfig, package.json)', async ({ request }) => {
    for (const raw of [
      '/../../vault/Velkommen.md',
      '/..%2F..%2Fvault%2FVelkommen.md',
      '/%2e%2e/%2e%2e/vault-reader.e2e.json',
      '/..%5c..%5cvault-reader.e2e.json',
      '/assets/..%2F..%2F..%2Fpackage.json',
      '/%2e%2e/%2e%2e/%2e%2e/package.json',
    ]) {
      const res = await request.get(raw);
      const body = await res.text();
      expect(body, raw).not.toContain('Velkommen til testvaultet');
      expect(body, raw).not.toContain('"vaults"');
      expect(body, raw).not.toContain('"devDependencies"');
    }
  });

  test('ukjent API-rute gir 404 NOT_FOUND (PO-24)', async ({ request }) => {
    const res = await request.get('/api/vaults/test/finnes-ikke');
    expect(res.status()).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});

test.describe('AK20 headere, Host-guard og skrivebeskyttelse', () => {
  test('HTML og API har CSP uten inline-script, nosniff og no-referrer (QA-SEC-07, PO-16)', async ({ request }) => {
    for (const url of [noteUrl('Velkommen'), '/api/vaults']) {
      const res = await request.get(url);
      const headers = res.headers();
      const csp = headers['content-security-policy'] ?? '';
      expect(csp, url).toContain("script-src 'self'");
      expect(csp, url).not.toContain("'unsafe-inline' 'unsafe-eval'");
      expect(csp.match(/script-src[^;]*/)?.[0] ?? '', url).not.toContain('unsafe-inline');
      expect(csp, url).toContain("object-src 'none'");
      expect(headers['x-content-type-options'], url).toBe('nosniff');
      expect(headers['referrer-policy'], url).toBe('no-referrer');
    }
  });

  test('ondsinnet SVG serveres med sandbox-CSP og nosniff (QA-IMG-12)', async ({ request }) => {
    const res = await request.get('/api/vaults/test/assets?path=attachments%2Fondsinnet.svg');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/svg+xml');
    expect(res.headers()['content-security-policy']).toMatch(/sandbox/);
    expect(res.headers()['content-security-policy']).toMatch(/default-src 'none'/);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('fremmed Host-header avvises med 403 (A16, DNS-rebinding)', async ({ request }) => {
    const res = await request.get('/api/vaults', { headers: { Host: `evil.example:${E2E_PORT}` } });
    expect(res.status()).toBe(403);
  });

  test('kun GET/HEAD: POST/PUT/PATCH/DELETE → 405 (B1)', async ({ request }) => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await request.fetch(`/api/vaults/test/document?path=Velkommen`, { method, data: 'x' });
      expect(res.status(), method).toBe(405);
    }
  });

  test('serveren lytter ikke på andre adresser enn 127.0.0.1 (QA-SEC-06)', async ({ request }) => {
    // Bind-adressen er hardkodet; vi sjekker at et ikke-loopback-grensesnitt ikke svarer.
    const { networkInterfaces } = await import('node:os');
    const external = Object.values(networkInterfaces())
      .flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal);
    test.skip(!external, 'Ingen ikke-loopback IPv4-adresse i containeren');
    const ok = await request
      .get(`http://${external!.address}:${E2E_PORT}/api/health`, { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    expect(ok).toBe(false);
  });
});

test.describe('AK20 sanitering – sikkerhetsnotatet (QA-SEC-01..05)', () => {
  test('ingen dialog, ingen script-kjøring ved lasting, hover, fokus og klikk', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __xss: string[] }).__xss = [];
      for (const name of ['alert', 'confirm', 'prompt'] as const) {
        window[name] = ((...args: unknown[]) => {
          (window as unknown as { __xss: string[] }).__xss.push(`${name}:${String(args[0])}`);
          return undefined;
        }) as never;
      }
    });
    await openNote(page, SIKKERHET);
    const article = page.locator('main article');
    await expect(article).toBeVisible();

    // Ingen farlige elementer/attributter i DOM-en.
    const report = await article.evaluate((root) => {
      const bad: string[] = [];
      for (const el of root.querySelectorAll('*')) {
        const tag = el.tagName.toLowerCase();
        if (['script', 'iframe', 'object', 'embed', 'style', 'form', 'meta', 'base', 'link'].includes(tag)) bad.push(`<${tag}>`);
        for (const attr of el.getAttributeNames()) {
          const value = el.getAttribute(attr) ?? '';
          if (attr.startsWith('on')) bad.push(`${tag}[${attr}]`);
          if (attr === 'style' && /position\s*:\s*fixed/i.test(value)) bad.push(`${tag}[style=fixed]`);
          if (['href', 'src', 'xlink:href', 'action', 'formaction'].includes(attr) && /^\s*(javascript|data|vbscript):/i.test(value)) bad.push(`${tag}[${attr}=${value.slice(0, 30)}]`);
        }
      }
      return bad;
    });
    expect(report).toEqual([]);

    // Hover/fokus/klikk på alt som kan interageres med (unntatt lenker som navigerer ut av notatet).
    const interactive = article.locator('a, button, summary, img, details, [tabindex]');
    const count = await interactive.count();
    for (let i = 0; i < count; i++) {
      const el = interactive.nth(i);
      if (!(await el.isVisible())) continue;
      await el.hover({ timeout: 1000 }).catch(() => undefined);
      await el.focus({ timeout: 1000 }).catch(() => undefined);
    }
    for (const summary of await article.locator('summary').all()) await summary.click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __xss: string[] }).__xss)).toEqual([]);
    // Overlegg med position:fixed dekker ikke siden (QA-SEC-03).
    const fixed = await article.evaluate((root) =>
      [...root.querySelectorAll('*')].filter((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position) && !el.closest('figure, .code')).length,
    );
    expect(fixed).toBe(0);
  });

  test('ufarlig HTML beholdes (kbd, sub, sup, mark, details) – QA-SEC-04', async ({ page }) => {
    await openNote(page, SIKKERHET);
    const article = page.locator('main article');
    for (const tag of ['kbd', 'sub', 'sup', 'details', 'summary']) {
      await expect(article.locator(tag).first(), tag).toBeAttached();
    }
  });

  test('javascript:-property blir ikke klikkbar lenke, <img onerror> i property er tekst (QA-FM-03)', async ({ page }) => {
    await openNote(page, SIKKERHET);
    const main = page.locator('main');
    await expect(main.locator('a[href^="javascript:" i]')).toHaveCount(0);
    await expect(main.locator('img[onerror]')).toHaveCount(0);
  });

  test('traversal-lenker i notatet er brutte (QA-LNK-05)', async ({ page, request }) => {
    const res = await request.get(`/api/vaults/test/document?path=${encodeURIComponent(SIKKERHET)}`);
    const json = JSON.stringify(await res.json());
    expect(json).not.toMatch(/"dataVrLink":"internal","dataVrTarget":"\.\./);
    await openNote(page, SIKKERHET);
    await expect(page.locator('main article a[href*=".."]')).toHaveCount(0);
  });

  test('mermaid med click/HTML kjører ingen JS (QA-MER-05)', async ({ page }) => {
    await openNote(page, SIKKERHET);
    await page.waitForTimeout(1500);
    await expect(page.locator('main article svg a[href^="javascript:" i]')).toHaveCount(0);
    await expect(page.locator('main article svg [onclick]')).toHaveCount(0);
  });
});
