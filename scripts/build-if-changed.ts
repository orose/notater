// PO-4: `npm start` gjenbruker dist/web når kilden til nettsiden er uendret. Hasher innholdet i
// kildefilene (ikke mtime – git checkout og kopiering endrer mtime uten å endre innhold).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Alt `vite build` leser fra repoet (avhengigheter dekkes av package-lock.json). */
export const BUILD_INPUTS: readonly string[] = [
  'src/web',
  'src/shared',
  'docs/design',
  'vite.config.ts',
  'tsconfig.base.json',
  'tsconfig.web.json',
  'package.json',
  'package-lock.json',
];

const STAMP = 'dist/web-build.json';
const IGNORED = /(^|[\\/])(node_modules|\.DS_Store)$|\.test\.tsx?$/;

function listFiles(root: string, path: string, out: string[]): void {
  const full = join(root, path);
  if (!existsSync(full)) return;
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(full).sort()) {
      const child = join(path, entry);
      if (!IGNORED.test(child)) listFiles(root, child, out);
    }
  } else if (stat.isFile()) {
    out.push(path);
  }
}

export function buildHash(root: string): string {
  const files: string[] = [];
  for (const input of BUILD_INPUTS) listFiles(root, input, files);
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.split(sep).join('/'));
    hash.update('\0');
    hash.update(readFileSync(join(root, file)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function needsBuild(root: string, hash: string): boolean {
  if (!existsSync(join(root, 'dist/web/index.html'))) return true;
  try {
    const stamp = JSON.parse(readFileSync(join(root, STAMP), 'utf8')) as { hash?: unknown };
    return stamp.hash !== hash;
  } catch {
    return true;
  }
}

export function writeStamp(root: string, hash: string): void {
  writeFileSync(join(root, STAMP), `${JSON.stringify({ hash, builtAt: new Date().toISOString() }, null, 2)}\n`);
}

function main(): void {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const force = process.argv.includes('--force');
  const hash = buildHash(root);
  if (!force && !needsBuild(root, hash)) {
    console.log(`Nettsiden er uendret siden forrige bygg – gjenbruker ${relative(process.cwd(), join(root, 'dist/web')) || 'dist/web'}.`);
    return;
  }
  const vite = join(root, 'node_modules/vite/bin/vite.js');
  const result = spawnSync(process.execPath, [vite, 'build'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
  writeStamp(root, hash);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
