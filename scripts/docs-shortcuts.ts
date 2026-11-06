// `npm run docs:shortcuts` (F6, ADR-007 §5): skriver hurtigtast-tabellen i README.md fra kommandoregisteret,
// mellom `<!-- hurtigtaster:start -->` og `<!-- hurtigtaster:end -->`. `--check` endrer ingenting og
// avslutter med kode 1 hvis README er utdatert. Importerer bare ren TS (commands/model og keyboard).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { README_MARKERS, renderShortcutsMarkdown, shortcutGroups } from '../src/web/features/commands/model/shortcut-docs';

export const README_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md');

/** README med hurtigtast-avsnittet erstattet. Kaster hvis markørene mangler. */
export function updateReadme(readme: string): string {
  const start = readme.indexOf(README_MARKERS.start);
  const end = readme.indexOf(README_MARKERS.end);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`README mangler markørene ${README_MARKERS.start} og ${README_MARKERS.end}`);
  }
  const table = renderShortcutsMarkdown(shortcutGroups('docs'));
  return `${readme.slice(0, start + README_MARKERS.start.length)}\n${table}\n${readme.slice(end)}`;
}

function main(argv: readonly string[]): number {
  const current = readFileSync(README_PATH, 'utf8');
  const next = updateReadme(current);
  if (argv.includes('--check')) {
    if (next === current) return 0;
    console.error('README.md er utdatert: kjør npm run docs:shortcuts');
    return 1;
  }
  if (next !== current) writeFileSync(README_PATH, next);
  console.log(next === current ? 'README.md er allerede oppdatert.' : 'Skrev hurtigtast-tabellen i README.md.');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
