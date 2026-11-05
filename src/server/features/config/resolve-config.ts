import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { parseArgs } from 'node:util';

export interface VaultConfig {
  /** `[a-z0-9-]+`, brukes i URL-er. */
  readonly id: string;
  readonly name: string;
  /** Absolutt sti til vault-roten. */
  readonly root: string;
  /** Vault-relative mappeprefikser som ikke indekseres. */
  readonly ignore: readonly string[];
  /** PO-22: property-nøkler som ikke sendes i dokument-API-et (i tillegg til de som alltid skjules). */
  readonly hiddenProperties: readonly string[];
}

export interface AppConfig {
  readonly port: number;
  readonly defaultVaultId: string;
  readonly vaults: readonly VaultConfig[];
  /** Konfigfila som ble brukt, `null` hvis kun CLI/env. */
  readonly configFile: string | null;
}

/** Alt `resolveConfig` trenger fra omverdenen – gjør presedenslogikken testbar uten filsystem. */
export interface ConfigSources {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly homedir: string;
  readFile(path: string): string;
  fileExists(path: string): boolean;
}

/** Konfigurasjonsfeil med én tydelig norsk melding (vises ved oppstart, exit 1). */
export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export const DEFAULT_PORT = 4317;
const CONFIG_FILE = 'vault-reader.config.json';
const LOCAL_CONFIG_FILE = 'vault-reader.config.local.json';
const VAULT_ID = /^[a-z0-9-]+$/;
const CLI_VAULT_ID = 'cli';

/** Presedens CLI > env > fil > standard (ADR-005). Ren funksjon. */
export function resolveConfig(sources: ConfigSources): AppConfig {
  const args = parseCliArgs(sources.argv);
  const expand = (path: string, base: string): string =>
    path === '~' || path.startsWith('~/') ? resolve(sources.homedir, path.slice(2)) : resolve(base, path);

  const explicitConfig = args.config ?? sources.env.VAULT_READER_CONFIG;
  const cliVault = args.vault ?? sources.env.VAULT_READER_VAULT;
  const configFile = explicitConfig
    ? expand(explicitConfig, sources.cwd)
    : [LOCAL_CONFIG_FILE, CONFIG_FILE].map((f) => resolve(sources.cwd, f)).find((f) => sources.fileExists(f)) ?? null;

  if (configFile === null && !cliVault) {
    throw new ConfigError(
      `Fant ingen konfigurasjon. Lag ${CONFIG_FILE} (eller ${LOCAL_CONFIG_FILE}) i ${sources.cwd}, ` +
        'eller start med --vault <sti>.',
    );
  }

  const file = configFile ? readConfigFile(configFile, sources) : null;
  const fileBase = configFile ? dirname(configFile) : sources.cwd;
  let vaults: VaultConfig[] = file ? parseVaults(file.vaults, configFile!, (p) => expand(p, fileBase), cliVault !== undefined) : [];
  let defaultVaultId = file?.defaultVault ?? vaults[0]?.id;

  if (cliVault) {
    const root = expand(cliVault, sources.cwd);
    vaults = [...vaults.filter((v) => v.id !== CLI_VAULT_ID), { id: CLI_VAULT_ID, name: basename(root), root, ignore: [], hiddenProperties: [] }];
    defaultVaultId = CLI_VAULT_ID;
  }
  if (defaultVaultId !== undefined && !vaults.some((v) => v.id === defaultVaultId)) {
    throw new ConfigError(`defaultVault «${defaultVaultId}» finnes ikke blant vaultene i ${configFile}.`);
  }

  const selectedId = args['vault-id'] ?? sources.env.VAULT_READER_VAULT_ID;
  if (selectedId !== undefined) {
    if (!vaults.some((v) => v.id === selectedId)) {
      throw new ConfigError(`Vault-id «${selectedId}» finnes ikke. Kjente id-er: ${vaults.map((v) => v.id).join(', ')}.`);
    }
    defaultVaultId = selectedId;
  }

  const port = parsePort(args.port ?? sources.env.VAULT_READER_PORT ?? file?.port ?? DEFAULT_PORT);
  return { port, defaultVaultId: defaultVaultId!, vaults, configFile };
}

interface RawConfigFile {
  readonly port?: unknown;
  readonly defaultVault?: string;
  readonly vaults?: unknown;
}

function parseCliArgs(argv: readonly string[]): Record<'config' | 'vault' | 'vault-id' | 'port', string | undefined> {
  try {
    const { values } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        config: { type: 'string' },
        vault: { type: 'string' },
        'vault-id': { type: 'string' },
        port: { type: 'string' },
      },
    });
    return values as Record<'config' | 'vault' | 'vault-id' | 'port', string | undefined>;
  } catch (error) {
    throw new ConfigError(
      `Ukjent eller ugyldig kommandolinjeflagg (${error instanceof Error ? error.message : String(error)}). ` +
        'Gyldige flagg: --config <fil>, --vault <sti>, --vault-id <id>, --port <n>.',
    );
  }
}

function readConfigFile(path: string, sources: ConfigSources): RawConfigFile {
  let text: string;
  try {
    text = sources.readFile(path);
  } catch {
    throw new ConfigError(`Kunne ikke lese konfigurasjonsfila ${path}.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ConfigError(`${path} er ikke gyldig JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ConfigError(`${path} må inneholde et JSON-objekt.`);
  const raw = parsed as Record<string, unknown>;
  if (raw.defaultVault !== undefined && typeof raw.defaultVault !== 'string') {
    throw new ConfigError(`defaultVault i ${path} må være en tekst (vault-id).`);
  }
  return { port: raw.port, defaultVault: raw.defaultVault as string | undefined, vaults: raw.vaults };
}

function parseVaults(raw: unknown, file: string, expand: (path: string) => string, allowEmpty: boolean): VaultConfig[] {
  if (raw === undefined && allowEmpty) return [];
  if (!Array.isArray(raw) || (raw.length === 0 && !allowEmpty)) {
    throw new ConfigError(`${file} må ha «vaults» med minst ett vault ({ "id", "path" }).`);
  }
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const where = `vaults[${index}] i ${file}`;
    if (!entry || typeof entry !== 'object') throw new ConfigError(`${where} må være et objekt.`);
    const { id, name, path, ignore, hiddenProperties } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !VAULT_ID.test(id)) {
      throw new ConfigError(`${where}: «id» må bestå av små bokstaver, tall og bindestrek (fikk ${JSON.stringify(id)}).`);
    }
    if (seen.has(id)) throw new ConfigError(`Vault-id «${id}» er brukt flere ganger i ${file}.`);
    seen.add(id);
    if (typeof path !== 'string' || path.trim() === '') throw new ConfigError(`${where}: «path» mangler.`);
    if (name !== undefined && typeof name !== 'string') throw new ConfigError(`${where}: «name» må være tekst.`);
    if (ignore !== undefined && (!Array.isArray(ignore) || ignore.some((i) => typeof i !== 'string'))) {
      throw new ConfigError(`${where}: «ignore» må være en liste med mappeprefikser.`);
    }
    if (hiddenProperties !== undefined && (!Array.isArray(hiddenProperties) || hiddenProperties.some((i) => typeof i !== 'string'))) {
      throw new ConfigError(`${where}: «hiddenProperties» må være en liste med property-navn.`);
    }
    const root = expand(path);
    return {
      id,
      name: (name as string | undefined) ?? id,
      root: isAbsolute(root) ? root : resolve(root),
      ignore: (ignore as string[] | undefined) ?? [],
      hiddenProperties: (hiddenProperties as string[] | undefined) ?? [],
    };
  });
}

function parsePort(value: unknown): number {
  const port = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`Ugyldig port «${String(value)}». Bruk et heltall mellom 1 og 65535.`);
  }
  return port;
}
