#!/usr/bin/env node
// ADR-006: alle versjoner i package-lock.json skal være minst N dager gamle (standard 21), slik at
// bedriftsbrannmurer (f.eks. Sonatype Nexus Firewall) ikke setter dem i karantene, og ferske
// (potensielt kompromitterte) versjoner ikke havner hos kunden.
//
// Ren Node (22.22+), ingen avhengigheter. Slår opp publiseringstid for hver pakke i registryet.
//
// Bruk:
//   npm run check:deps                    # 21 dager, registry fra npm-konfig eller registry.npmjs.org
//   npm run check:deps -- --days 30
//   node scripts/check-dependency-age.mjs --lock package-lock.json --registry https://nexus.firma.no/repository/npm/
//
// Utgangskode: 0 = alt eldre enn grensen, 1 = minst én versjon er for ny, 2 = oppslag feilet / ugyldig bruk.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Unike { name, version } fra en lockfil (lockfileVersion 2/3). Rotpakken, lenker og ikke-registry-kilder hoppes over. */
export function collectPackages(lock) {
  if (!lock || typeof lock.packages !== 'object') {
    throw new Error('package-lock.json mangler «packages» (krever lockfileVersion 2 eller 3).');
  }
  const seen = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '' || entry.link || entry.inBundle || !entry.version) continue;
    // Pakker fra git, filer o.l. har ingen publiseringstid i registryet.
    if (entry.resolved && !/^https?:\/\//.test(entry.resolved)) continue;
    const name = entry.name ?? path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const key = `${name}@${entry.version}`;
    if (!seen.has(key)) seen.set(key, { name, version: entry.version });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/**
 * Slår sammen pakkeliste og publiseringstider (times: Map<name, Record<version, ISO-dato>>) og deler i
 * for nye / mangler tid / ok. Alder i hele dager, avrundet ned.
 */
export function evaluateAges(packages, times, { now = new Date(), days = DEFAULT_DAYS } = {}) {
  const tooYoung = [];
  const missing = [];
  const checked = [];
  for (const pkg of packages) {
    const published = times.get(pkg.name)?.[pkg.version];
    if (!published) {
      missing.push(pkg);
      continue;
    }
    const ageDays = Math.floor((now.getTime() - new Date(published).getTime()) / DAY_MS);
    const item = { ...pkg, published, ageDays };
    checked.push(item);
    if (ageDays < days) tooYoung.push(item);
  }
  const byAge = (a, b) => a.ageDays - b.ageDays || a.name.localeCompare(b.name);
  checked.sort(byAge);
  tooYoung.sort(byAge);
  return { tooYoung, missing, youngest: checked[0], oldest: checked.at(-1), checked: checked.length };
}

/** `--days 30`, `--days=30`, `--lock <sti>`, `--registry <url>`. */
export function parseArgs(argv) {
  const opts = { days: DEFAULT_DAYS, lock: 'package-lock.json', registry: undefined };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s, 2);
    const value = () => inline ?? argv[++i];
    if (flag === '--days') opts.days = Number(value());
    else if (flag === '--lock') opts.lock = value();
    else if (flag === '--registry') opts.registry = value();
    else throw new Error(`Ukjent argument: ${argv[i]}`);
  }
  if (!Number.isInteger(opts.days) || opts.days < 0) throw new Error('--days må være et heltall ≥ 0.');
  return opts;
}

export function packumentUrl(registry, name) {
  const base = registry.endsWith('/') ? registry : `${registry}/`;
  return base + name.replace('/', '%2f');
}

async function fetchTimes(registry, names, concurrency = 8) {
  const times = new Map();
  const failures = [];
  const queue = [...names];
  async function worker() {
    for (let name = queue.shift(); name; name = queue.shift()) {
      try {
        // Full packument (ikke «corgi»): bare den har feltet «time».
        const res = await fetch(packumentUrl(registry, name), { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const doc = await res.json();
        times.set(name, doc.time ?? {});
      } catch (error) {
        failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { times, failures };
}

async function main() {
  // Node sin fetch følger bare HTTPS_PROXY/NO_PROXY med NODE_USE_ENV_PROXY=1 (Node 22.21+/24.5+).
  if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
    const child = spawnSync(process.execPath, process.argv.slice(1), {
      stdio: 'inherit',
      env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
    });
    process.exit(child.status ?? 2);
  }

  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const registry = opts.registry ?? process.env.npm_config_registry ?? 'https://registry.npmjs.org/';
  const lock = JSON.parse(readFileSync(resolve(opts.lock), 'utf8'));
  const packages = collectPackages(lock);
  const names = [...new Set(packages.map((p) => p.name))];
  console.log(`Sjekker ${packages.length} pakkeversjoner (${names.length} pakker) mot ${registry} – grense ${opts.days} dager …`);

  const { times, failures } = await fetchTimes(registry, names);
  const result = evaluateAges(packages, times, { days: opts.days });

  if (result.oldest && result.youngest) {
    const fmt = (p) => `${p.name}@${p.version} (${p.published.slice(0, 10)}, ${p.ageDays} dager)`;
    console.log(`Eldste:  ${fmt(result.oldest)}`);
    console.log(`Yngste:  ${fmt(result.youngest)}`);
  }
  for (const failure of failures) console.error(`Oppslag feilet: ${failure}`);
  for (const pkg of result.missing.filter((p) => times.has(p.name))) {
    console.error(`Fant ingen publiseringstid for ${pkg.name}@${pkg.version}`);
  }
  if (result.tooYoung.length > 0) {
    console.error(`\n${result.tooYoung.length} versjon(er) er yngre enn ${opts.days} dager:`);
    for (const p of result.tooYoung) console.error(`  ${p.name}@${p.version}  ${p.published.slice(0, 10)}  (${p.ageDays} dager)`);
    console.error('\nSe docs/arkitektur/ADR-006-avhengighetspolicy.md for hvordan lockfila oppdateres.');
    process.exit(1);
  }
  if (failures.length > 0 || result.missing.length > 0) process.exit(2);
  console.log(`OK: alle ${result.checked} versjoner er minst ${opts.days} dager gamle.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
