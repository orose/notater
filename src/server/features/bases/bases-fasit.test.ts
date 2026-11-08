/**
 * QAs fasit (docs/test/bases-fasit.json) mot en temp-kopi av test-vault med fixture-mtimes
 * (PO-17: testene skriver aldri i repoets test-vault). Én test per fasitrad.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BaseKanbanView, BaseResult, BaseTableView, BaseView, VaultValue } from '../../../shared/api-types';
import { testHighlighter } from '../../test-support/render-fixtures';
import { createInlineMetaExtractor } from '../vault-index';
import { createVaultRuntime } from '../vault-registry';
import type { VaultState } from '../vault-registry';
import { createBaseEvaluator } from './base-evaluator';
import type { BaseRequest } from './base-request';

interface FasitView {
  readonly name: string;
  readonly type: string;
  readonly kolonner?: readonly (string | { readonly verdi: string | null; readonly etikett?: string; readonly kort: readonly string[] })[];
  readonly kortfelter?: readonly string[];
  readonly kolonnebredder?: Readonly<Record<string, number>>;
  readonly rader?: readonly string[];
  readonly grupper?: readonly { readonly verdi: string; readonly rader: readonly string[] }[];
  readonly antallRader?: number;
  readonly stottet?: boolean;
}
interface FasitRow {
  readonly sti: string;
  readonly 'file.name': string;
  readonly 'file.tags': readonly string[];
  readonly status: string | null;
  readonly priority: number | null;
  readonly due: string | null;
  readonly 'formula.team': string;
}

const repo = process.cwd();
const fasit = JSON.parse(readFileSync(join(repo, 'docs/test/bases-fasit.json'), 'utf8')) as {
  'Domene.base': { views: FasitView[]; skalIkkeVises: string[] };
  'Oppgaver.base': { globaltUtvalg: FasitRow[]; skalIkkeVises: string[]; views: FasitView[] };
  'Sprintoversikt.md': { blokker: { views?: FasitView[]; advarsler?: string[]; feil?: string }[] };
};

const docPath = (filePath: string): string => filePath.replace(/\.md$/, '');
const evaluator = createBaseEvaluator({ now: () => Date.UTC(2026, 10, 5, 12) });
let vaultDir: string;
let state: VaultState;

beforeAll(async () => {
  vaultDir = mkdtempSync(join(tmpdir(), 'bases-fasit-'));
  cpSync(join(repo, 'test-vault'), vaultDir, { recursive: true });
  execFileSync(process.execPath, [join(repo, 'test-vault-tools/sett-fixture-mtimes.mjs'), vaultDir], { stdio: 'ignore' });
  const runtime = createVaultRuntime(
    { id: 'test', name: 'Test', root: vaultDir, ignore: [], hiddenProperties: [] },
    { highlighter: testHighlighter, createInitialExtractor: createInlineMetaExtractor, incrementalExtractor: createInlineMetaExtractor(), watch: null },
  );
  state = await runtime.ready();
}, 60_000);

afterAll(() => {
  if (vaultDir) rmSync(vaultDir, { recursive: true, force: true });
});

const vault = () => ({ snapshot: state.snapshot, links: state.links });
const evaluate = (request: BaseRequest): BaseResult => evaluator.evaluate(request, vault());
const baseFile = (name: string, view: string | null = null): BaseResult => evaluate({ kind: 'file', filePath: name, view });
const viewOf = (result: BaseResult, name: string): BaseView => {
  const view = result.views.find((v) => v.name === name);
  if (!view) throw new Error(`mangler view ${name}`);
  return view;
};
const table = (result: BaseResult, name: string): BaseTableView => viewOf(result, name) as BaseTableView;
const kanban = (result: BaseResult, name: string): BaseKanbanView => viewOf(result, name) as BaseKanbanView;
const allPaths = (view: BaseTableView | BaseKanbanView): string[] => view.groups.flatMap((g) => g.rows.map((r) => r.path));

const sprintBlocks = (): string[] => {
  const text = readFileSync(join(vaultDir, 'Sprintoversikt.md'), 'utf8');
  return [...text.matchAll(/```base\n([\s\S]*?)```/g)].map((m) => m[1]!);
};
const sprint = (index: number): BaseResult => evaluate({ kind: 'inline', source: sprintBlocks()[index]!, hostFilePath: 'Sprintoversikt.md' });

describe('Domene.base (fasit §1)', () => {
  const [domene] = fasit['Domene.base'].views;
  const rows = domene!.rader!;

  it.each(rows.map((path, i) => [i + 1, path] as const))('rad %i er %s', (n, path) => {
    expect(allPaths(table(baseFile('Domene.base'), 'Domene'))[n - 1]).toBe(docPath(path));
  });

  it(`nøyaktig ${rows.length} rader, kolonner ${domene!.kolonner!.join(', ')}, ingen gruppering, ingen advarsler`, () => {
    const result = baseFile('Domene.base');
    const view = table(result, 'Domene');
    expect(view.totalRows).toBe(rows.length);
    expect(allPaths(view)).toHaveLength(rows.length);
    expect(view.columns.map((c) => c.id)).toEqual(domene!.kolonner);
    expect(view.columns[0]!.label).toBe('Navn');
    expect(view.grouped).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(view.warnings).toEqual([]);
  });

  it.each(fasit['Domene.base'].skalIkkeVises)('%s vises ikke', (path) => {
    expect(allPaths(table(baseFile('Domene.base'), 'Domene'))).not.toContain(docPath(path));
    expect(allPaths(table(baseFile('Domene.base'), 'Domene'))).not.toContain(path);
  });

  it('file.name-cellen er en streng (klienten lager lenke)', () => {
    expect(table(baseFile('Domene.base'), 'Domene').groups[0]!.rows[0]!.cells['file.name']).toEqual({ type: 'string', value: 'Adresse' });
  });
});

describe('Oppgaver.base – globalt utvalg (fasit §2.0)', () => {
  const rows = fasit['Oppgaver.base'].globaltUtvalg;
  const source = `${readFileSync(join(repo, 'test-vault/Oppgaver.base'), 'utf8').split('views:')[0]}views:
  - type: table
    name: Alle
    order: [file.name, file.tags, status, priority, due, formula.team]
`;
  const cellsFor = (path: string) => {
    const view = table(evaluate({ kind: 'inline', source, hostFilePath: 'Velkommen.md' }), 'Alle');
    return view.groups[0]!.rows.find((r) => r.path === docPath(path))?.cells;
  };
  const scalar = (v: VaultValue | undefined): unknown => {
    if (!v || v.type === 'null') return null;
    if (v.type === 'date') return v.value.slice(0, 10);
    if (v.type === 'list') return v.value.map(scalar);
    if (v.type === 'link') return v.display;
    return v.value;
  };

  it(`nøyaktig ${rows.length} notater`, () => {
    const view = table(evaluate({ kind: 'inline', source, hostFilePath: 'Velkommen.md' }), 'Alle');
    expect(view.totalRows).toBe(rows.length);
  });

  it.each(rows.map((r) => [r.sti, r] as const))('%s', (path, expected) => {
    const cells = cellsFor(path);
    expect(cells, path).toBeDefined();
    expect({
      'file.name': scalar(cells!['file.name']),
      'file.tags': scalar(cells!['file.tags']),
      status: scalar(cells!['note.status']),
      priority: scalar(cells!['note.priority']),
      due: scalar(cells!['note.due']),
      'formula.team': scalar(cells!['formula.team']),
    }).toEqual({
      'file.name': expected['file.name'],
      'file.tags': expected['file.tags'],
      status: expected.status,
      priority: expected.priority,
      due: expected.due,
      'formula.team': expected['formula.team'],
    });
    expect(cells!['file.tags']!.type === 'list' && cells!['file.tags']!.value.every((t) => t.type === 'tag')).toBe(true);
  });

  it.each(fasit['Oppgaver.base'].skalIkkeVises)('%s er ikke med', (path) => {
    const view = table(evaluate({ kind: 'inline', source, hostFilePath: 'Velkommen.md' }), 'Alle');
    expect(allPaths(view)).not.toContain(docPath(path));
  });
});

describe('Oppgaver.base – Huskeliste (fasit §2.1)', () => {
  const fasitView = fasit['Oppgaver.base'].views.find((v) => v.name === 'Huskeliste')!;
  const cases = fasitView.grupper!.flatMap((g, gi) => g.rader.map((path, i) => [g.verdi, i + 1, path, gi] as const));

  it.each(cases)('%s #%i: %s', (_group, n, path, gi) => {
    const view = table(baseFile('Oppgaver.base'), 'Huskeliste');
    expect(view.groups[gi]!.rows[n - 1]!.path).toBe(docPath(path));
  });

  it('grupper, antall, kolonner og bredder', () => {
    const view = table(baseFile('Oppgaver.base'), 'Huskeliste');
    expect(view.grouped).toBe(true);
    expect(view.groups.map((g) => [g.label, g.rows.length])).toEqual(fasitView.grupper!.map((g) => [g.verdi, g.rader.length]));
    expect(view.groups.map((g) => g.key)).toEqual(fasitView.grupper!.map((g) => ({ type: 'string', value: g.verdi })));
    expect(view.totalRows).toBe(13);
    expect(view.columns.map((c) => c.id)).toEqual(['file.name', 'note.status', 'note.due']);
    expect(view.columns.map((c) => c.label)).toEqual(['Navn', 'status', 'due']);
    expect(view.columns.map((c) => c.width ?? null)).toEqual([fasitView.kolonnebredder!['file.name'], fasitView.kolonnebredder!.status, null]);
    expect(view.indentProperties).toBe(true);
  });

  it('due vises som ren dato, manglende status som null', () => {
    const rows = table(baseFile('Oppgaver.base'), 'Huskeliste').groups.flatMap((g) => g.rows);
    expect(rows.find((r) => r.path === 'oppgaver/Migrer til Java 21')!.cells['note.due']).toEqual({
      type: 'date',
      value: '2026-11-08T00:00:00.000Z',
      hasTime: false,
    });
    expect(rows.find((r) => r.path === 'oppgaver/Sett opp Flyway-migreringer')!.cells['note.status']).toEqual({ type: 'null' });
  });
});

describe('Oppgaver.base – Kanban (fasit §2.2)', () => {
  const fasitView = fasit['Oppgaver.base'].views.find((v) => v.name === 'Kanban')!;
  const lanes = fasitView.kolonner as { verdi: string | null; etikett?: string; kort: string[] }[];
  const cases = lanes.flatMap((lane, li) => lane.kort.map((path, i) => [lane.etikett ?? lane.verdi, i + 1, path, li] as const));

  it.each(cases)('kolonne %s, kort %i: %s', (_label, n, path, li) => {
    const view = kanban(baseFile('Oppgaver.base'), 'Kanban');
    expect(view.groups[li]!.rows[n - 1]!.path).toBe(docPath(path));
  });

  it('17 kort i 6 kolonner i riktig rekkefølge, «(ingen)» sist med key null', () => {
    const view = kanban(baseFile('Oppgaver.base'), 'Kanban');
    expect(view.type).toBe('kanban');
    expect(view.groupBy).toBe('note.status');
    expect(view.groups.map((g) => g.label)).toEqual(lanes.map((l) => l.etikett ?? l.verdi));
    expect(view.groups.map((g) => g.rows.length)).toEqual(lanes.map((l) => l.kort.length));
    expect(view.groups.at(-1)!.key).toBeNull();
    expect(view.totalRows).toBe(17);
    expect(view.columns.map((c) => c.id)).toEqual(fasitView.kortfelter);
    expect(view.columns.map((c) => c.label)).toEqual(['Navn', 'Tagger']);
  });

  it('tagger på kortene er tag-verdier i original skrivemåte', () => {
    const view = kanban(baseFile('Oppgaver.base'), 'Kanban');
    const card = view.groups[0]!.rows.find((r) => r.path === 'oppgaver/Bytt til records i DTO-er')!;
    expect(card.cells['file.tags']).toEqual({ type: 'list', value: [{ type: 'tag', value: 'Task' }] });
  });

  it('![[Oppgaver.base#Kanban]] gir bare Kanban (PO-12)', () => {
    expect(baseFile('Oppgaver.base', 'Kanban').views.map((v) => v.name)).toEqual(['Kanban']);
  });
});

describe('Oppgaver.base – Arkiv (fasit §2.3, sortert på file.mtime fra fixture-mtimes)', () => {
  const fasitView = fasit['Oppgaver.base'].views.find((v) => v.name === 'Arkiv')!;
  const mtimes = JSON.parse(readFileSync(join(repo, 'docs/test/fixture-mtimes.json'), 'utf8')) as { filer: Record<string, string> };

  it.each(fasitView.rader!.map((path, i) => [i + 1, path] as const))('rad %i er %s', (n, path) => {
    const view = table(baseFile('Oppgaver.base'), 'Arkiv');
    const row = view.groups[0]!.rows[n - 1]!;
    expect(row.path).toBe(docPath(path));
    expect(row.cells['file.mtime']).toEqual({ type: 'date', value: new Date(mtimes.filer[path]!).toISOString(), hasTime: true });
  });

  it('kolonner, indentProperties: false, 4 rader', () => {
    const view = table(baseFile('Oppgaver.base'), 'Arkiv');
    expect(view.columns.map((c) => [c.id, c.label])).toEqual([
      ['file.name', 'Navn'],
      ['note.status', 'status'],
      ['file.mtime', 'Endret'],
    ]);
    expect(view.indentProperties).toBe(false);
    expect(view.totalRows).toBe(fasitView.rader!.length);
  });
});

describe('Sprintoversikt.md – inline ```base (fasit §3)', () => {
  const blocks = fasit['Sprintoversikt.md'].blokker;

  it.each(blocks[0]!.views![0]!.rader!.map((path, i) => [i + 1, path] as const))('Kritisk rad %i er %s', (n, path) => {
    expect(allPaths(table(sprint(0), 'Kritisk'))[n - 1]).toBe(docPath(path));
  });

  it('Kritisk: 4 rader', () => {
    expect(table(sprint(0), 'Kritisk').totalRows).toBe(4);
  });

  const team = blocks[1]!.views![0]!;
  const teamLanes = team.kolonner as { verdi: string; kort: string[] }[];
  it.each(teamLanes.flatMap((lane, li) => lane.kort.map((path, i) => [lane.verdi, i + 1, path, li] as const)))(
    'Team: kolonne %s, kort %i: %s',
    (_lane, n, path, li) => {
      expect(kanban(sprint(1), 'Team').groups[li]!.rows[n - 1]!.path).toBe(docPath(path));
    },
  );

  it('Team: 5 kort i 3 kolonner, ingen «(ingen)», kortfelter', () => {
    const view = kanban(sprint(1), 'Team');
    expect(view.groups.map((g) => g.label)).toEqual(teamLanes.map((l) => l.verdi));
    expect(view.totalRows).toBe(5);
    expect(view.columns.map((c) => c.id)).toEqual(team.kortfelter!.map((k) => (k.includes('.') ? k : `note.${k}`)));
  });

  it('Med feil: 18 rader på file.name + advarsler om ukjent funksjon, nøkkel og view-type (B8, B9)', () => {
    const result = sprint(2);
    const medFeil = table(result, 'Med feil');
    expect(medFeil.totalRows).toBe(blocks[2]!.views![0]!.antallRader);
    const names = medFeil.groups[0]!.rows.map((r) => (r.cells['file.name'] as { value: string }).value);
    expect(names).toEqual([...names].sort(new Intl.Collator('nb', { numeric: true, sensitivity: 'base' }).compare));
    const all = [...result.warnings, ...result.views.flatMap((v) => v.warnings)];
    expect(all.some((w) => w.code === 'unknown-function' && w.source === 'file.finnesIkke')).toBe(true);
    expect(all.some((w) => w.code === 'unknown-key' && w.source === 'ukjentNøkkel')).toBe(true);
    const gallery = viewOf(result, 'Ukjent view-type');
    expect(gallery).toMatchObject({ type: 'unsupported', originalType: 'gallery' });
    expect(gallery.warnings.some((w) => w.code === 'unknown-view-type')).toBe(true);
  });

  it('ugyldig YAML gir feilkort med linjenummer', () => {
    const result = sprint(3);
    expect(result.views).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'invalid-yaml', message: expect.stringMatching(/Kunne ikke lese base-definisjonen \(linje \d+\)/) })]);
  });
});

describe('PO-34: ukjent view', () => {
  it('![[Oppgaver.base#Ukjent]] gir ingen views og en advarsel med tilgjengelige views', () => {
    const result = baseFile('Oppgaver.base', 'Ukjent');
    expect(result.views).toEqual([]);
    expect(result.warnings).toEqual([
      {
        code: 'unknown-view',
        message: 'Viewet «Ukjent» finnes ikke. Tilgjengelige views: «Huskeliste», «Kanban», «Arkiv».',
        source: 'Ukjent',
        availableViews: ['Huskeliste', 'Kanban', 'Arkiv'],
      },
    ]);
  });
});
