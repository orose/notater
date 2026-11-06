import { describe, expect, it } from 'vitest';
import { collectPackages, DEFAULT_DAYS, evaluateAges, packumentUrl, parseArgs } from './check-dependency-age.mjs';

// ADR-006: logikken i avhengighetsalder-sjekken, uten nettverk.
const lock = {
  lockfileVersion: 3,
  packages: {
    '': { name: 'vault-reader', version: '0.1.0' },
    'node_modules/hono': { version: '4.13.13', resolved: 'https://registry.npmjs.org/hono/-/hono-4.13.13.tgz' },
    'node_modules/@types/node': { version: '22.20.5', resolved: 'https://registry.npmjs.org/@types/node/-/node-22.20.5.tgz' },
    'node_modules/a/node_modules/@types/node': { version: '22.20.5' },
    'node_modules/vitest/node_modules/hono': { version: '4.12.0' },
    'node_modules/alias': { name: 'string-width', version: '4.2.3' },
    'node_modules/lokal': { link: true, resolved: 'pakker/lokal' },
    'node_modules/fra-git': { version: '1.0.0', resolved: 'git+ssh://git@github.com/x/y.git#abc' },
    'node_modules/bundlet': { version: '1.0.0', inBundle: true },
  },
};

describe('check-dependency-age (ADR-006)', () => {
  it('samler unike navn@versjon, også nøstede og alias, og hopper over rot, lenker, git og bundlede', () => {
    expect(collectPackages(lock)).toEqual([
      { name: '@types/node', version: '22.20.5' },
      { name: 'hono', version: '4.12.0' },
      { name: 'hono', version: '4.13.13' },
      { name: 'string-width', version: '4.2.3' },
    ]);
  });

  it('avviser lockfil uten «packages»', () => {
    expect(() => collectPackages({ lockfileVersion: 1, dependencies: {} })).toThrow(/lockfileVersion 2 eller 3/);
  });

  it('flagger versjoner yngre enn grensen og finner eldste/yngste', () => {
    const now = new Date('2026-11-06T12:00:00Z');
    const times = new Map<string, Record<string, string>>([
      ['hono', { '4.12.0': '2026-01-01T00:00:00Z', '4.13.13': '2026-10-16T12:00:00Z' }],
      ['@types/node', { '22.20.5': '2026-10-16T12:00:01Z' }],
      ['string-width', { '4.2.3': '2021-08-30T00:00:00Z' }],
    ]);
    const result = evaluateAges(collectPackages(lock), times, { now, days: DEFAULT_DAYS });
    // Grensen: nøyaktig 21 dager er ok, ett sekund mindre er for ungt.
    expect(result.tooYoung.map((p) => `${p.name}@${p.version}`)).toEqual(['@types/node@22.20.5']);
    expect(result.tooYoung[0]).toMatchObject({ ageDays: 20 });
    expect(result.youngest).toMatchObject({ name: '@types/node', ageDays: 20 });
    expect(result.oldest).toMatchObject({ name: 'string-width', ageDays: 1894 });
    expect(result.checked).toBe(4);

    const strict = evaluateAges(collectPackages(lock), times, { now, days: 22 });
    expect(strict.tooYoung.map((p) => `${p.name}@${p.version}`)).toEqual(['@types/node@22.20.5', 'hono@4.13.13']);
    expect(evaluateAges(collectPackages(lock), times, { now, days: 0 }).tooYoung).toEqual([]);
  });

  it('rapporterer versjoner uten publiseringstid som manglende', () => {
    const result = evaluateAges([{ name: 'hono', version: '9.9.9' }], new Map([['hono', {}]]), { now: new Date() });
    expect(result.missing).toEqual([{ name: 'hono', version: '9.9.9' }]);
    expect(result.youngest).toBeUndefined();
  });

  it('leser --days og --registry, med 21 som standard', () => {
    expect(parseArgs([])).toEqual({ days: 21, lock: 'package-lock.json', registry: undefined });
    expect(parseArgs(['--days', '30']).days).toBe(30);
    expect(parseArgs(['--days=7', '--registry=https://nexus.example/npm/']).registry).toBe('https://nexus.example/npm/');
    expect(() => parseArgs(['--days', 'tre'])).toThrow(/heltall/);
    expect(() => parseArgs(['--ukjent'])).toThrow(/Ukjent argument/);
  });

  it('bygger packument-URL med kodet scope', () => {
    expect(packumentUrl('https://registry.npmjs.org/', '@types/node')).toBe('https://registry.npmjs.org/@types%2fnode');
    expect(packumentUrl('https://nexus.example/repository/npm', 'hono')).toBe('https://nexus.example/repository/npm/hono');
  });
});
