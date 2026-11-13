// `npm run present` (ADR-011 M2, PO-119): ren JavaScript uten tsx. Sjekker Node, bygger terminalbunten med esbuild
// bare når kilden er endret, og kjører bunten i SAMME prosess. Uten en tsx-forelder får appen signalene selv
// (SIGTERM/SIGHUP når vinduet lukkes), og oppstarten slipper TypeScript-lasteren (~0,3 s).
// npm-skriptet er `exec node scripts/present.mjs`: `exec` erstatter npm sitt `sh -c` med Node, så npm venter på selve
// appen. Uten det kunne skallet dø av SIGHUP før appen hadde gjenopprettet terminalen (F-1, PO-119).
//
//   npm run present -- "<notat>" [flagg]      bygger ved behov og starter
//   node scripts/present.mjs --bygg            bare bygg (tvunget)

import './check-node.js';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

/** Alt bunten bygges fra (pakkene i node_modules er eksterne og dekkes av lockfila). */
export const PRESENT_INPUTS = ['src/terminal', 'src/core', 'src/server', 'src/shared', 'docs/design/terminal/farger.json', 'package.json', 'package-lock.json'];
export const OUT_DIR = 'dist/terminal';
export const BUNDLE = `${OUT_DIR}/present.mjs`;
export const WORKER = `${OUT_DIR}/meta-worker.cjs`;
const STAMP = `${OUT_DIR}/stamp.json`;
const IGNORED = /(^|[\\/])(node_modules|\.DS_Store|__snapshots__)$|\.test\.tsx?$/;

function listFiles(root, path, out) {
  const full = join(root, path);
  if (!existsSync(full)) return;
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(full).sort()) {
      const child = join(path, entry);
      if (!IGNORED.test(child)) listFiles(root, child, out);
    }
  } else if (stat.isFile()) out.push({ path: path.split(sep).join('/'), size: stat.size, mtimeMs: stat.mtimeMs });
}

/**
 * Fingeravtrykk av kilden: sti, størrelse og endringstid (bare `stat`, ~5 ms). Endret tid uten endret innhold
 * (f.eks. `git checkout`) gir et unødvendig, men ufarlig bygg.
 */
export function sourceStamp(root) {
  const files = [];
  for (const input of PRESENT_INPUTS) listFiles(root, input, files);
  const hash = createHash('sha256');
  for (const f of files) hash.update(`${f.path}\0${f.size}\0${f.mtimeMs}\n`);
  return hash.digest('hex');
}

export function needsBuild(root, stamp) {
  if (!existsSync(join(root, BUNDLE)) || !existsSync(join(root, WORKER))) return true;
  try {
    return JSON.parse(readFileSync(join(root, STAMP), 'utf8')).stamp !== stamp;
  } catch {
    return true;
  }
}

/** Bygger bunten og worker-koden (esbuild lastes bare her). */
export async function buildPresent(root) {
  const { build } = await import('esbuild');
  mkdirSync(join(root, OUT_DIR), { recursive: true });
  const common = { bundle: true, platform: 'node', target: 'node22', logLevel: 'warning', absWorkingDir: root };
  await Promise.all([
    build({ ...common, entryPoints: ['src/terminal/main.ts'], outfile: BUNDLE, format: 'esm', packages: 'external' }),
    // Workerne kjører koden som tekst (`new Worker(kode, { eval: true })`), så den bundles helt, som i serveren.
    build({ ...common, entryPoints: ['src/server/features/vault-index/meta-worker.ts'], outfile: WORKER, format: 'cjs' }),
  ]);
}

export async function ensureBuilt(root, force = false) {
  const stamp = sourceStamp(root);
  if (!force && !needsBuild(root, stamp)) return false;
  await buildPresent(root);
  writeFileSync(join(root, STAMP), `${JSON.stringify({ stamp, builtAt: new Date().toISOString() }, null, 2)}\n`);
  return true;
}

async function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  if (process.argv.includes('--bygg')) {
    await ensureBuilt(root, true);
    process.stderr.write(`Bygget ${BUNDLE}.\n`);
    return;
  }
  await ensureBuilt(root);
  await import(pathToFileURL(join(root, BUNDLE)).href);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Kunne ikke starte presentasjonen: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
