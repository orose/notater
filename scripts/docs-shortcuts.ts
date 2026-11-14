// `npm run docs:shortcuts` (F6, ADR-007 §5): skriver hurtigtast-tabellen i README.md fra kommandoregisteret,
// mellom `<!-- hurtigtaster:start -->` og `<!-- hurtigtaster:end -->`. `--check` endrer ingenting og
// avslutter med kode 1 hvis README er utdatert. Importerer bare ren TS (src/core/commands og src/core/keyboard).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { README_MARKERS, README_PRESENT_MARKERS, renderShortcutsMarkdown, shortcutGroups } from '../src/core/commands';

export const README_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md');

function replaceBetween(readme: string, markers: { readonly start: string; readonly end: string }, content: string): string {
  const start = readme.indexOf(markers.start);
  const end = readme.indexOf(markers.end);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`README mangler markørene ${markers.start} og ${markers.end}`);
  }
  return `${readme.slice(0, start + markers.start.length)}\n${content}\n${readme.slice(end)}`;
}

/**
 * README med hurtigtast-avsnittene erstattet: normal-modus og «I presentasjon» (present-modus, ADR-010 §3).
 * Avsnittet for presentasjon er valgfritt (eldre README uten markørene); normal-modus kaster hvis markørene mangler.
 */
export function updateReadme(readme: string): string {
  const normal = replaceBetween(readme, README_MARKERS, renderShortcutsMarkdown(shortcutGroups('docs')));
  if (!normal.includes(README_PRESENT_MARKERS.start)) return normal;
  const present = renderShortcutsMarkdown(shortcutGroups('docs', 'present'), 'Taster i lysbildeoversikten (`o`) og paletten (håndteres av komponentene selv):');
  return replaceBetween(normal, README_PRESENT_MARKERS, present);
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
