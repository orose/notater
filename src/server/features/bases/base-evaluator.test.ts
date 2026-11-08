/** Evaluator mot vault-indeksen: lenker/properties, cache per snapshot og live reload (AK12, QA-IDX-13). */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BaseTableView } from '../../../shared/api-types';
import { testHighlighter } from '../../test-support/render-fixtures';
import { createInlineMetaExtractor } from '../vault-index';
import { createVaultRuntime } from '../vault-registry';
import type { VaultRuntime, VaultState } from '../vault-registry';
import { createBaseEvaluator } from './base-evaluator';

let dir: string;
let runtime: VaultRuntime;
const evaluator = createBaseEvaluator({ now: () => Date.UTC(2026, 10, 5, 12) });
const ctx = (s: VaultState) => ({ snapshot: s.snapshot, links: s.links });

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bases-live-'));
  cpSync(join(process.cwd(), 'test-vault'), dir, { recursive: true });
  runtime = createVaultRuntime(
    { id: 't', name: 'T', root: dir, ignore: [], hiddenProperties: [] },
    { highlighter: testHighlighter, createInitialExtractor: createInlineMetaExtractor, incrementalExtractor: createInlineMetaExtractor(), watch: null },
  );
  await runtime.ready();
}, 60_000);

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const inline = (s: VaultState, source: string, host = 'Velkommen.md') => evaluator.evaluate({ kind: 'inline', source, hostFilePath: host }, ctx(s));
const rows = (view: unknown) => (view as BaseTableView).groups.flatMap((g) => g.rows);

describe('createBaseEvaluator mot vaultet', () => {
  it('lenker i properties blir klikkbare wikilinks (oppløst eller brutt), også i lister', async () => {
    const s = await runtime.ready();
    const result = inline(s, 'filters: file.name == "Frontmatter-typer"\nviews:\n  - type: table\n    name: T\n    order: [lenke, lenkeliste, dato, datotid, liste, nestet, tags]\n');
    const cells = rows(result.views[0])[0]!.cells;
    expect(cells['note.lenke']).toEqual({ type: 'link', target: 'teknisk/Kafka/Kafka-grunnleggende', display: 'Kafka-grunnleggende' });
    expect(cells['note.lenkeliste']).toEqual({
      type: 'list',
      value: [
        { type: 'link', target: 'domene/Ordre', display: 'Ordre' },
        { type: 'link', target: null, display: 'Finnes ikke' },
      ],
    });
    expect(cells['note.dato']).toEqual({ type: 'date', value: '2026-11-05T00:00:00.000Z', hasTime: false });
    expect(cells['note.datotid']).toEqual({ type: 'date', value: '2026-11-05T14:30:00.000Z', hasTime: true });
    expect(cells['note.liste']).toEqual({ type: 'list', value: ['a', 'b', 'c'].map((value) => ({ type: 'string', value })) });
    expect(cells['note.nestet']!.type).toBe('string');
    expect(cells['note.tags']).toEqual({ type: 'list', value: [{ type: 'tag', value: 'qa' }, { type: 'tag', value: 'properties' }] });
  });

  it('uttrykk mot lenke-properties, nestede objekter, hasLink og this', async () => {
    const s = await runtime.ready();
    const names = (filter: string, host?: string) =>
      rows(inline(s, `filters: '${filter}'\nviews:\n  - type: table\n    name: T\n`, host).views[0]).map((r) => r.path);
    expect(names('lenke == link("Kafka-grunnleggende")')).toEqual(['edge/Frontmatter-typer']);
    expect(names('nestet.nivå1.nivå2 == "dypt"')).toEqual(['edge/Frontmatter-typer']);
    expect(names('file.hasLink("Frontmatter-typer")').length).toBeGreaterThan(0);
    expect(names('file.path == this.file.path', 'Sprintoversikt.md')).toEqual(['Sprintoversikt']);
    expect(names('file.hasTag("task") && file.ext == "md" && file.inFolder("templates") && file.folder != "templates"')).toEqual([
      'templates/sprint/Sprint-oppgave-mal',
    ]);
  });

  it('ukjent base-fil gir advarsel', async () => {
    const s = await runtime.ready();
    expect(evaluator.evaluate({ kind: 'file', filePath: 'Finnes ikke.base', view: null }, ctx(s))).toMatchObject({
      views: [],
      warnings: [{ code: 'missing-base' }],
    });
  });

  it('resultater caches per snapshot (samme objekt), men ikke når now()/today() brukes', async () => {
    const s = await runtime.ready();
    const a = evaluator.evaluate({ kind: 'file', filePath: 'Domene.base', view: null }, ctx(s));
    expect(evaluator.evaluate({ kind: 'file', filePath: 'Domene.base', view: null }, ctx(s))).toBe(a);
    const clock = 'filters: file.mtime < now()\nviews:\n  - type: table\n    name: T\n';
    expect(inline(s, clock)).not.toBe(inline(s, clock));
  });
});

describe('live reload (AK12): base-resultater følger endringer i vaultet', () => {
  it('nytt notat, endret status og slettet notat gir nye resultater', async () => {
    const before = await runtime.ready();
    const domene = () => evaluator.evaluate({ kind: 'file', filePath: 'Domene.base', view: null }, ctx(stateNow));
    let stateNow = before;
    expect(rows(domene().views[0])).toHaveLength(12);

    writeFileSync(join(dir, 'domene/Ny entitet.md'), '# Ny entitet\n');
    await runtime.applyChanges(['domene/Ny entitet.md']);
    stateNow = await runtime.ready();
    expect(stateNow.revision).toBe(before.revision + 1);
    expect(rows(domene().views[0]).map((r) => r.path)).toContain('domene/Ny entitet');

    const huskeliste = () => evaluator.evaluate({ kind: 'file', filePath: 'Oppgaver.base', view: 'Huskeliste' }, ctx(stateNow));
    expect(huskeliste().views[0]!.type === 'table' && (huskeliste().views[0] as BaseTableView).totalRows).toBe(13);
    const path = join(dir, 'oppgaver/Oppdater README.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('status: done', 'status: todo'));
    await runtime.applyChanges(['oppgaver/Oppdater README.md']);
    stateNow = await runtime.ready();
    expect((huskeliste().views[0] as BaseTableView).totalRows).toBe(14);

    rmSync(join(dir, 'domene/Ny entitet.md'));
    await runtime.applyChanges(['domene/Ny entitet.md']);
    stateNow = await runtime.ready();
    expect(rows(domene().views[0])).toHaveLength(12);
  });

  it('endret .base-fil gir ny definisjon', async () => {
    const path = join(dir, 'Domene.base');
    writeFileSync(path, readFileSync(path, 'utf8').replace('name: Domene', 'name: Domener'));
    await runtime.applyChanges(['Domene.base']);
    const s = await runtime.ready();
    expect(evaluator.evaluate({ kind: 'file', filePath: 'Domene.base', view: null }, ctx(s)).views[0]!.name).toBe('Domener');
  });
});
