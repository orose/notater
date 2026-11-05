import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { serve } from '@hono/node-server';
import { createApp } from './app/create-app';
import { createCodeHighlighter } from './features/code-highlight';
import type { CodeHighlighter } from './features/code-highlight';
import { ConfigError, resolveConfig } from './features/config';
import { watchVault } from './features/live-events';
import { createInlineMetaExtractor, createWorkerMetaExtractor } from './features/vault-index';
import { createVaultRegistry } from './features/vault-registry';

const HOST = '127.0.0.1'; // AK20: aldri konfigurerbar.

function loadConfig() {
  try {
    return resolveConfig({
      argv: process.argv.slice(2),
      env: process.env,
      cwd: process.cwd(),
      homedir: homedir(),
      readFile: (path) => readFileSync(path, 'utf8'),
      fileExists: existsSync,
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Konfigurasjonsfeil: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

const config = loadConfig();
for (const vault of config.vaults) {
  if (!existsSync(vault.root)) console.warn(`Advarsel: vaultet «${vault.id}» peker på ${vault.root}, som ikke finnes.`);
}

let highlighter: Promise<CodeHighlighter> | null = null;
const registry = createVaultRegistry(config, {
  highlighter: () => (highlighter ??= createCodeHighlighter()),
  createInitialExtractor: () => createWorkerMetaExtractor(),
  incrementalExtractor: createInlineMetaExtractor(),
  watch: (root, ignore, onBatch) => watchVault(root, ignore, onBatch),
  log: (message) => console.log(message),
});

const app = createApp({ webRoot: './dist/web', version: process.env.npm_package_version ?? '0.0.0', registry });

// overrideGlobalObjects: false – ellers erstattes global `Response`, som Shikis WASM-lasting trenger.
const server = serve({ fetch: app.fetch, hostname: HOST, port: config.port, overrideGlobalObjects: false }, (info) => {
  console.log(`Vault-leser kjører på http://${HOST}:${info.port}`);
});

// Standard-vaultet indekseres ved oppstart (AK17 måles fra start til «indeks klar»); øvrige lat.
registry
  .get(config.defaultVaultId)
  ?.ready()
  .then(() => highlighter?.then((h) => h.warmUp()))
  .catch((error: unknown) => console.error(error instanceof Error ? error.message : error));

const shutdown = (): void => {
  void registry.close().finally(() => server.close(() => process.exit(0)));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
