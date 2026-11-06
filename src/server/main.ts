import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { serve } from '@hono/node-server';
import { createApp } from './app/create-app';
import { describeListenError } from './app/listen-error';
import { createCodeHighlighter } from './features/code-highlight';
import type { CodeHighlighter } from './features/code-highlight';
import { ConfigError, resolveConfig } from './features/config';
import { watchVault } from './features/live-events';
import { createInlineMetaExtractor, createWorkerMetaExtractor } from './features/vault-index';
import { createVaultRegistry } from './features/vault-registry';
import { createActivityTracker } from './shared/activity';

const HOST = '127.0.0.1'; // AK20: aldri konfigurerbar.
/** Bakgrunnsarbeid venter til det har vært stille så lenge etter siste API-forespørsel (BUG-008). */
const QUIET_MS = 150;

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
// Bakgrunnsarbeid (søkeindeks, Shiki-oppvarming, forhåndsrendering) kjører bare når ingen forespørsler pågår.
const activity = createActivityTracker({ quietMs: QUIET_MS });
const registry = createVaultRegistry(config, {
  highlighter: () => (highlighter ??= createCodeHighlighter()),
  createInitialExtractor: () => createWorkerMetaExtractor(),
  incrementalExtractor: createInlineMetaExtractor(),
  watch: (root, ignore, onBatch) => watchVault(root, ignore, onBatch),
  idle: activity.idle,
  log: (message) => console.log(message),
});

const app = createApp({ webRoot: './dist/web', version: process.env.npm_package_version ?? '0.0.0', registry, activity });

// overrideGlobalObjects: false – ellers erstattes global `Response`, som Shikis WASM-lasting trenger.
const server = serve({ fetch: app.fetch, hostname: HOST, port: config.port, overrideGlobalObjects: false }, (info) => {
  console.log(`Vault-leser kjører på http://${HOST}:${info.port}`);
});

// Opptatt port o.l.: kort norsk melding og exit 1 i stedet for en ubehandlet stakk.
server.on('error', (error: unknown) => {
  const message = describeListenError(error, HOST, config.port);
  if (message === null) throw error;
  console.error(message);
  process.exit(1);
});

// Standard-vaultet indekseres ved oppstart (AK17 måles fra start til «indeks klar»); øvrige lat.
const defaultVault = registry.get(config.defaultVaultId);
defaultVault
  ?.ready()
  .then(() => highlighter?.then((h) => h.warmUp(activity.idle, defaultVault.codeLanguages())))
  .catch((error: unknown) => console.error(error instanceof Error ? error.message : error));

const shutdown = (): void => {
  void registry.close().finally(() => server.close(() => process.exit(0)));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
