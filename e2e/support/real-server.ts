// Felles hjelpere for å starte den EKTE serveren mot en kopi av et vault (PO-17).
// Brukes av globalSetup (test-vault-kopi) og av ytelsestesten (generert 2000-vault).
// Ingenting her skriver i repoet: vault-kopi, konfig og web-bygg havner i en temp-mappe.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
/** Kan overstyres med E2E_PORT (f.eks. når flere kjører e2e samtidig på samme maskin). Hjelpeservere bruker E2E_PORT + n. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 4318);
export const E2E_VAULT_ID = 'test';

export interface RunningServer {
  readonly process: ChildProcess;
  readonly port: number;
  /** Millisekunder fra spawn til `GET /api/vaults` rapporterer `ready`. */
  readonly readyAfterMs: number;
  /** `indexMs` slik serveren selv rapporterer det. */
  readonly indexMs: number | null;
  readonly log: () => string;
  stop(): Promise<void>;
}

/** Ny temp-mappe utenfor repoet. */
export function makeTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Kopierer test-vault/ til `<dir>/vault` og setter fixture-mtimes (docs/test/fixture-mtimes.json). */
export function copyTestVault(dir: string): string {
  const vault = join(dir, 'vault');
  cpSync(join(REPO, 'test-vault'), vault, { recursive: true });
  const result = spawnSync(process.execPath, [join(REPO, 'test-vault-tools/sett-fixture-mtimes.mjs'), vault], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`sett-fixture-mtimes feilet: ${result.stderr}`);
  return vault;
}

/** Bygger web til `<dir>/dist/web` (serverens webRoot er `./dist/web` relativt til cwd). */
export function buildWeb(dir: string): void {
  const outDir = join(dir, 'dist/web');
  mkdirSync(outDir, { recursive: true });
  const result = spawnSync(process.execPath, [join(REPO, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`vite build feilet:\n${result.stdout}\n${result.stderr}`);
}

export function writeConfig(dir: string, vaultPath: string, port: number, extra: Record<string, unknown> = {}): string {
  const file = join(dir, 'vault-reader.e2e.json');
  writeFileSync(
    file,
    JSON.stringify({ port, defaultVault: E2E_VAULT_ID, vaults: [{ id: E2E_VAULT_ID, name: 'Testvault (e2e-kopi)', path: vaultPath, ...extra }] }, null, 2),
  );
  return file;
}

/**
 * Starter `src/server/main.ts` med `--config <fil>` og cwd = `dir` (der `dist/web` ligger).
 * Venter til standard-vaultet er indeksert.
 */
export async function startServer(dir: string, configFile: string, port: number, timeoutMs = 60_000, vaultId = E2E_VAULT_ID): Promise<RunningServer> {
  const started = performance.now();
  const child = spawn(process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), join(REPO, 'src/server/main.ts'), '--config', configFile], {
    cwd: dir,
    env: { ...process.env, TZ: 'Europe/Oslo', VAULT_READER_PORT: undefined, VAULT_READER_VAULT: undefined, VAULT_READER_CONFIG: undefined },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
  child.stderr?.on('data', (d: Buffer) => (output += d.toString()));
  let exited = false;
  child.on('exit', () => (exited = true));

  const base = `http://127.0.0.1:${port}`;
  let indexMs: number | null = null;
  let readyAfterMs = -1;
  while (performance.now() - started < timeoutMs) {
    if (exited) throw new Error(`Serveren avsluttet under oppstart:\n${output}`);
    try {
      const res = await fetch(`${base}/api/vaults`);
      if (res.ok) {
        const body = (await res.json()) as { vaults: { id: string; status: string; indexMs?: number }[] };
        const vault = body.vaults.find((v) => v.id === vaultId);
        if (vault?.status === 'ready') {
          readyAfterMs = performance.now() - started;
          indexMs = vault.indexMs ?? null;
          break;
        }
        if (vault?.status === 'error') throw new Error(`Vaultet kunne ikke indekseres:\n${output}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Vaultet')) throw error;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  if (readyAfterMs < 0) {
    child.kill('SIGKILL');
    throw new Error(`Serveren ble ikke klar innen ${timeoutMs} ms:\n${output}`);
  }
  return {
    process: child,
    port,
    readyAfterMs,
    indexMs,
    log: () => output,
    stop: () =>
      new Promise<void>((done) => {
        if (exited) return done();
        const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
        child.once('exit', () => {
          clearTimeout(timer);
          done();
        });
        child.kill('SIGTERM');
      }),
  };
}

export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
