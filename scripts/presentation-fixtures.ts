// Henter serverens HAST for test-vault/presentasjon/ til fixtures for lysbildemodellens enhetstester
// (src/web/features/presentation/model/fixtures). Kjør mot en server som peker på test-vault:
//   npx tsx scripts/presentation-fixtures.ts http://127.0.0.1:4317
// Kjøres på nytt når QA endrer notatene i test-vault/presentasjon/.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOTES = [
  'Statusmøte uke 45',
  'Månedsrapport oktober',
  'Delte lysbilder',
  'Mye innhold',
  'Stor kodeblokk',
  'Uten overskrifter',
  'Innhold før agenda',
  'Langt innhold før agenda',
  'Mange agendapunkter',
  'Lysbildenivå',
];

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/web/features/presentation/model/fixtures');

async function main(base: string): Promise<void> {
  for (const name of NOTES) {
    const res = await fetch(`${base}/api/vaults/test/document?path=${encodeURIComponent(`presentasjon/${name}`)}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    const doc = (await res.json()) as { title: string; content: unknown; toc: unknown };
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ title: doc.title, content: doc.content, toc: doc.toc }));
    console.log(`Skrev ${name}.json`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv[2] ?? 'http://127.0.0.1:4317').catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
