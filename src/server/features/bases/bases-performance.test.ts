/**
 * Ytelse (slice 3/4): evaluering av en base over 2000 notater < 50 ms. Bruker et syntetisk
 * snapshot i minnet (samme form som generate-large-vault.mjs: ~15 % oppgaver, nestede tagger,
 * domenemapper), så testen ikke trenger disk eller worker-tråder.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BaseTableView } from '../../../shared/api-types';
import { createLinkResolver } from '../links';
import { describeVaultPath, extractNoteMeta } from '../vault-index';
import type { IndexedNote, VaultFile, VaultSnapshot } from '../vault-index';
import { createBaseEvaluator } from './base-evaluator';
import type { BaseVaultContext } from './base-evaluator';

const NOTE_COUNT = 2000;
const BUDGET_MS = 50;
const STATUSES = ['todo', 'doing', 'done', 'blocked', 'Todo'];
const FOLDERS = ['domene', 'domene/delt', 'oppgaver', 'arkitektur/adr', 'møter/2026', 'templates', 'prosjekter/q4/sprint-12'];

function syntheticVault(): BaseVaultContext {
  const files = new Map<string, VaultFile>();
  const notes = new Map<string, IndexedNote>();
  const baseSources = new Map<string, string>();
  for (let i = 0; i < NOTE_COUNT; i++) {
    const folder = FOLDERS[i % FOLDERS.length]!;
    const isTask = i % 7 === 0;
    const tags = isTask ? (i % 3 === 0 ? '[task, team]' : '[task/backend]') : i % 11 === 0 ? '[kafka-topic]' : '[notat]';
    const fm = [`tags: ${tags}`, isTask && i % 13 !== 0 ? `status: ${STATUSES[i % STATUSES.length]}` : null, isTask ? `priority: ${(i % 4) + 1}` : null, isTask ? `due: 2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}` : null]
      .filter(Boolean)
      .join('\n');
    const source = `---\n${fm}\n---\n# Notat ${i}\n\nTekst med [[Notat ${(i * 7) % NOTE_COUNT}]] og #inline-${i % 5}.\n`;
    const info = describeVaultPath(`${folder}/Notat ${i}.md`);
    const file: VaultFile = { ...info, diskPath: info.filePath, size: source.length, mtimeMs: Date.UTC(2026, 0, 1) + i * 60_000, ctimeMs: Date.UTC(2025, 0, 1) };
    files.set(file.filePath, file);
    notes.set(file.filePath, { file, meta: extractNoteMeta(source), body: source });
  }
  for (const name of ['Oppgaver.base', 'Domene.base']) {
    const info = describeVaultPath(name);
    const text = readFileSync(join(process.cwd(), 'test-vault', name), 'utf8');
    files.set(name, { ...info, diskPath: name, size: text.length, mtimeMs: 0, ctimeMs: 0 });
    baseSources.set(name, text);
  }
  const snapshot: VaultSnapshot = { files, notes, baseSources };
  return { snapshot, links: createLinkResolver(files.values()) };
}

let vault: BaseVaultContext;
beforeAll(() => {
  vault = syntheticVault();
}, 60_000);

/**
 * Median av flere kalde kjøringer: ny evaluator hver gang (ingen cache, postkilden bygges på nytt).
 * Måler CPU-tid for prosessen (ikke veggklokke), så testen ikke blir ustabil når maskinen er
 * belastet av andre testfiler/e2e-servere i parallell. Evalueringen er synkron og entrådet.
 */
function medianColdMs(filePath: string, runs = 7): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const evaluator = createBaseEvaluator({ now: () => Date.UTC(2026, 10, 5) });
    const started = process.cpuUsage();
    evaluator.evaluate({ kind: 'file', filePath, view: null }, vault);
    const used = process.cpuUsage(started);
    times.push((used.user + used.system) / 1000);
  }
  return times.sort((a, b) => a - b)[Math.floor(runs / 2)]!;
}

describe(`ytelse: ${NOTE_COUNT} notater`, () => {
  it('Oppgaver.base (3 views, formel, gruppering, kanban) gir forventet form', () => {
    const result = createBaseEvaluator().evaluate({ kind: 'file', filePath: 'Oppgaver.base', view: null }, vault);
    expect(result.warnings).toEqual([]);
    const tasks = [...vault.snapshot.notes.values()].filter((n) => n.meta.tags.some((t) => t.startsWith('task')) && n.file.folder !== 'templates').length;
    expect(result.views[1]!.type === 'kanban' && result.views[1]!.totalRows).toBe(tasks);
    expect((result.views[0] as BaseTableView).groups.map((g) => g.label)).toEqual(['Mine oppgaver', 'Testgjengen']);
  });

  it.each(['Oppgaver.base', 'Domene.base'])(`%s evalueres på under ${BUDGET_MS} ms (median av kalde kjøringer)`, (filePath) => {
    medianColdMs(filePath, 3); // oppvarming av JIT
    expect(medianColdMs(filePath)).toBeLessThan(BUDGET_MS);
  });

  it('gjentatt evaluering på samme snapshot treffer cachen', () => {
    const evaluator = createBaseEvaluator();
    const first = evaluator.evaluate({ kind: 'file', filePath: 'Oppgaver.base', view: null }, vault);
    expect(evaluator.evaluate({ kind: 'file', filePath: 'Oppgaver.base', view: null }, vault)).toBe(first);
  });
});
