// Inngangen til `npm run present` (v3, ADR-011). Frittstående: starter ingen HTTP-server (T7).
// Kjøres som esbuild-bunt fra `scripts/present.mjs` (M2, PO-119: én prosess, ingen tsx-forelder) eller direkte med tsx.

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { runPresent } from './app/run-present';
import { nodeProcessHooks } from './features/screen';

// I bunten ligger worker-koden ferdig bygget ved siden av (`dist/terminal/meta-worker.cjs`); fra kilden bygges den i minnet.
const workerFile = new URL('./meta-worker.cjs', import.meta.url);
const workerSource = existsSync(workerFile) ? () => readFile(workerFile, 'utf8') : undefined;

const code = await runPresent({
  argv: process.argv.slice(2),
  config: {
    env: process.env,
    cwd: process.cwd(),
    homedir: homedir(),
    readFile: (path) => readFileSync(path, 'utf8'),
    fileExists: existsSync,
  },
  input: process.stdin,
  output: process.stdout,
  hooks: nodeProcessHooks(),
  timers: { setTimeout: (cb, ms) => setTimeout(cb, ms), clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout) },
  stderr: (text) => process.stderr.write(text),
  ...(workerSource ? { vaultOptions: { workerSource } } : {}),
});
process.exit(code);
