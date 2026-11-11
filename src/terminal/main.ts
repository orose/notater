// Inngangen til `npm run present` (v3, ADR-011). Frittstående: starter ingen HTTP-server (T7).

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { runPresent } from './app/run-present';
import { nodeProcessHooks } from './features/screen';

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
});
process.exit(code);
