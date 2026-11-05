#!/usr/bin/env node
// Setter deterministiske mtimes (fra docs/test/fixture-mtimes.json) på en KOPI av test-vault/.
// Git bevarer ikke mtime, så uten dette er Arkiv-viewet i Oppgaver.base (sort: file.mtime) ikke deterministisk.
//
// Bruk:  node test-vault-tools/sett-fixture-mtimes.mjs <vault-kopi>
// Nekter å kjøre direkte mot repoets test-vault/ med mindre --i-repo er gitt (B1-ånd: tester endrer ikke fixturen).
// Ren Node 22, ingen avhengigheter.

import { readFileSync, readdirSync, utimesSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const her = dirname(fileURLToPath(import.meta.url));
const repo = resolve(her, '..');
const args = process.argv.slice(2);
const mål = args.find((a) => !a.startsWith('--'));
if (!mål) {
  console.error('Bruk: node test-vault-tools/sett-fixture-mtimes.mjs <vault-kopi> [--i-repo]');
  process.exit(1);
}
const vault = resolve(mål);
if (vault === resolve(repo, 'test-vault') && !args.includes('--i-repo')) {
  console.error('Nekter å endre repoets test-vault/ direkte. Kopier den først (f.eks. fs.cpSync til en temp-mappe), eller bruk --i-repo.');
  process.exit(1);
}
const fasit = JSON.parse(readFileSync(join(repo, 'docs/test/fixture-mtimes.json'), 'utf8'));
const standard = new Date(fasit.standard);

function* filer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* filer(p);
    else yield p;
  }
}

let n = 0;
for (const fil of filer(vault)) {
  const rel = relative(vault, fil).split('\\').join('/').normalize('NFC');
  const t = fasit.filer[rel] ? new Date(fasit.filer[rel]) : standard;
  utimesSync(fil, t, t);
  n++;
}
for (const rel of Object.keys(fasit.filer)) {
  if (!existsSync(join(vault, rel))) console.warn(`Advarsel: ${rel} finnes ikke i ${vault}`);
}
console.log(`Satte mtime på ${n} filer i ${vault}`);
