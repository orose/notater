import { describe, expect, it } from 'vitest';
import { ConfigError, resolveConfig } from './resolve-config';
import type { ConfigSources } from './resolve-config';

const BASE_FILE = JSON.stringify({
  $comment: 'tillatt',
  port: 4400,
  defaultVault: 'jobb',
  vaults: [
    { id: 'jobb', name: 'Jobbnotater', path: '~/Documents/Jobb', ignore: ['Maler/'] },
    { id: 'privat', path: './privat' },
  ],
});

function sources(overrides: Partial<ConfigSources> & { files?: Record<string, string> } = {}): ConfigSources {
  const files = overrides.files ?? { '/repo/vault-reader.config.json': BASE_FILE };
  return {
    argv: [],
    env: {},
    cwd: '/repo',
    homedir: '/Users/kunde',
    readFile: (path) => {
      const content = files[path];
      if (content === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return content;
    },
    fileExists: (path) => path in files,
    ...overrides,
  };
}

describe('resolveConfig – fil', () => {
  it('leser standardfila og løser stier (~ og relativ til konfigfila)', () => {
    const config = resolveConfig(sources());
    expect(config).toEqual({
      port: 4400,
      defaultVaultId: 'jobb',
      configFile: '/repo/vault-reader.config.json',
      vaults: [
        { id: 'jobb', name: 'Jobbnotater', root: '/Users/kunde/Documents/Jobb', ignore: ['Maler/'] },
        { id: 'privat', name: 'privat', root: '/repo/privat', ignore: [] },
      ],
    });
  });

  it('.local.json erstatter den sjekkede fila helt', () => {
    const local = JSON.stringify({ vaults: [{ id: 'lokal', path: '/data/v' }] });
    const config = resolveConfig(sources({ files: { '/repo/vault-reader.config.json': BASE_FILE, '/repo/vault-reader.config.local.json': local } }));
    expect(config.vaults.map((v) => v.id)).toEqual(['lokal']);
    expect(config.defaultVaultId).toBe('lokal');
    expect(config.port).toBe(4317);
  });

  it('--config og VAULT_READER_CONFIG, CLI vinner', () => {
    const other = JSON.stringify({ vaults: [{ id: 'annen', path: 'v' }] });
    const env = JSON.stringify({ vaults: [{ id: 'env', path: 'v' }] });
    const files = { '/etc/annen.json': other, '/repo/env.json': env };
    expect(resolveConfig(sources({ files, argv: ['--config', '/etc/annen.json'], env: { VAULT_READER_CONFIG: 'env.json' } })).vaults[0]!.root).toBe('/etc/v');
    expect(resolveConfig(sources({ files, env: { VAULT_READER_CONFIG: 'env.json' } })).vaults[0]!.id).toBe('env');
  });
});

describe('resolveConfig – overstyring (CLI > env > fil > standard)', () => {
  it('port', () => {
    expect(resolveConfig(sources({ env: { VAULT_READER_PORT: '5000' } })).port).toBe(5000);
    expect(resolveConfig(sources({ argv: ['--port', '6000'], env: { VAULT_READER_PORT: '5000' } })).port).toBe(6000);
  });

  it('--vault legger til ad hoc-vault «cli» som blir standard, øvrige beholdes', () => {
    const config = resolveConfig(sources({ argv: ['--vault', '~/Notater'] }));
    expect(config.defaultVaultId).toBe('cli');
    expect(config.vaults.map((v) => v.id)).toEqual(['jobb', 'privat', 'cli']);
    expect(config.vaults[2]).toEqual({ id: 'cli', name: 'Notater', root: '/Users/kunde/Notater', ignore: [] });
  });

  it('--vault uten konfigfil fungerer; relativ sti løses mot cwd', () => {
    const config = resolveConfig(sources({ files: {}, env: { VAULT_READER_VAULT: './mitt-vault' } }));
    expect(config.vaults).toEqual([{ id: 'cli', name: 'mitt-vault', root: '/repo/mitt-vault', ignore: [] }]);
  });

  it('--vault-id velger standard-vault', () => {
    expect(resolveConfig(sources({ argv: ['--vault-id', 'privat'] })).defaultVaultId).toBe('privat');
    expect(resolveConfig(sources({ env: { VAULT_READER_VAULT_ID: 'privat' } })).defaultVaultId).toBe('privat');
  });
});

describe('resolveConfig – validering (norske feilmeldinger)', () => {
  const fails = (overrides: Parameters<typeof sources>[0], message: RegExp) => {
    expect(() => resolveConfig(sources(overrides))).toThrow(ConfigError);
    expect(() => resolveConfig(sources(overrides))).toThrow(message);
  };
  const withFile = (content: unknown) => ({ files: { '/repo/vault-reader.config.json': JSON.stringify(content) } });

  it('manglende konfig', () => fails({ files: {} }, /Fant ingen konfigurasjon/));
  it('eksplisitt fil som mangler', () => fails({ argv: ['--config', '/nei.json'] }, /Kunne ikke lese konfigurasjonsfila/));
  it('ugyldig JSON', () => fails({ files: { '/repo/vault-reader.config.json': '{ nei' } }, /ikke gyldig JSON/));
  it('ingen vaults', () => fails(withFile({ vaults: [] }), /minst ett vault/));
  it('ugyldig id', () => fails(withFile({ vaults: [{ id: 'Jobb Notater', path: 'x' }] }), /id/));
  it('duplikat id', () => fails(withFile({ vaults: [{ id: 'a', path: 'x' }, { id: 'a', path: 'y' }] }), /brukt flere ganger/));
  it('mangler sti', () => fails(withFile({ vaults: [{ id: 'a' }] }), /path/));
  it('ukjent defaultVault', () => fails(withFile({ defaultVault: 'nei', vaults: [{ id: 'a', path: 'x' }] }), /defaultVault/));
  it('ugyldig port', () => fails({ argv: ['--port', '99999'] }, /port/i));
  it('ukjent --vault-id', () => fails({ argv: ['--vault-id', 'nei'] }, /nei/));
  it('ukjent flagg', () => fails({ argv: ['--host', '0.0.0.0'] }, /Ukjent/));
});
