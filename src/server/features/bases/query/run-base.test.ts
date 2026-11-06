import { describe, expect, it } from 'vitest';
import type { BaseKanbanView, BaseResult, BaseTableView } from '../../../../shared/api-types';
import { parseBaseDefinition } from '../definition/parse-base';
import type { FakeFile } from '../expression/test-subject';
import { dateValue } from '../expression/values';
import { runBase } from './run-base';
import { fakeRecordSource } from './test-records';

const FILES: FakeFile[] = [
  { path: 'a/Alfa.md', tags: ['task'], props: { status: 'todo', priority: 2, due: dateValue(Date.UTC(2026, 0, 3), false), estimat: 3 } },
  { path: 'a/beta.md', tags: ['task', 'team'], props: { status: 'doing', priority: 1, estimat: 5, relatert: { kind: 'link', filePath: 'b/Gamma.md', docPath: 'b/Gamma', display: 'Gamma' } } },
  { path: 'b/Gamma.md', tags: ['task/x'], props: { status: 'Todo', priority: 2, due: dateValue(Date.UTC(2026, 0, 1), false) } },
  { path: 'b/Delta.md', tags: [], props: { status: 'blocked' } },
  { path: 'b/Epsilon.md', tags: ['task'], props: { priority: 10 } },
  { path: 'c/bilde.png' },
];

function run(yaml: string, view: string | null = null, files: FakeFile[] = FILES): BaseResult {
  const parsed = parseBaseDefinition(yaml);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return runBase(parsed.definition, fakeRecordSource(files), { view, thisFile: null, nowMs: Date.UTC(2026, 0, 2) }).result;
}
const names = (view: BaseTableView | BaseKanbanView): string[][] => view.groups.map((g) => g.rows.map((r) => r.path.split('/').pop()!));
const first = (result: BaseResult): BaseTableView => result.views[0] as BaseTableView;

describe('runBase – filtre', () => {
  it('globalt filter og view-filter kombineres med and', () => {
    const result = run(`filters: file.hasTag("task")
views:
  - type: table
    name: T
    filters:
      and:
        - priority == 2
`);
    expect(names(first(result))).toEqual([['Alfa', 'Gamma']]);
  });

  it('or, not (= ingen av) og nøsting', () => {
    const result = run(`filters:
  or:
    - file.inFolder("b")
    - and:
        - file.hasTag("team")
        - not:
            - status == "done"
views:
  - type: table
    name: T
    filters:
      not:
        - status == "blocked"
        - file.ext == "png"
`);
    expect(names(first(result))).toEqual([['beta', 'Epsilon', 'Gamma']]);
  });

  it('ledd med parse-feil eller ukjent funksjon ignoreres (O8/B8) med advarsel', () => {
    const result = run(`filters:
  and:
    - file.hasTag("task")
    - file.finnesIkke("x")
    - 'status == '
views:
  - type: table
    name: T
`);
    expect(first(result).totalRows).toBe(4);
    expect(result.warnings.map((w) => w.code).sort()).toEqual(['parse-error', 'unknown-function']);
  });

  it('uten filter er alle filer med (også ikke-markdown)', () => {
    expect(first(run('views:\n  - type: table\n    name: T\n')).totalRows).toBe(FILES.length);
  });
});

describe('runBase – formler', () => {
  it('formler kan bruke andre formler og vises som kolonner', () => {
    const result = run(`filters: file.hasTag("task")
formulas:
  dobbel: estimat * 2
  pluss: formula.dobbel + 1
  merke: if(formula.pluss > 10, "stor", "liten")
views:
  - type: table
    name: T
    order: [file.name, formula.pluss, formula.merke]
`);
    const rows = first(result).groups[0]!.rows;
    expect(rows.map((r) => [r.cells['formula.pluss'], r.cells['formula.merke']])).toEqual([
      [{ type: 'number', value: 7 }, { type: 'string', value: 'liten' }],
      [{ type: 'number', value: 11 }, { type: 'string', value: 'stor' }],
      [{ type: 'null' }, { type: 'string', value: 'liten' }],
      [{ type: 'null' }, { type: 'string', value: 'liten' }],
    ]);
    expect(first(result).columns.map((c) => c.label)).toEqual(['Navn', 'pluss', 'merke']);
  });

  it('syklus gir advarsel og tom verdi, ikke uendelig rekursjon', () => {
    const result = run(`formulas:
  a: formula.b + 1
  b: formula.a + 1
  c: formula.c
views:
  - type: table
    name: T
    order: [formula.a, formula.c]
`);
    expect(result.warnings.filter((w) => w.code === 'formula-cycle')).toHaveLength(2);
    expect(first(result).groups[0]!.rows[0]!.cells['formula.a']).toEqual({ type: 'null' });
  });

  it('ukjent formel og ukjent funksjon i formel gir advarsel', () => {
    const result = run(`formulas:
  x: tull(1)
views:
  - type: table
    name: T
    order: [formula.mangler, formula.x]
`);
    expect(result.warnings.map((w) => w.code)).toEqual(['unknown-function']);
    expect(first(result).warnings.map((w) => w.code)).toEqual(['unknown-formula']);
  });
});

describe('runBase – sortering (B2/B3/B5)', () => {
  it('flere nøkler, tall numerisk, tomme verdier sist også ved DESC', () => {
    const result = run(`views:
  - type: table
    name: T
    filters: file.ext == "md"
    sort:
      - property: priority
        direction: DESC
      - property: due
        direction: ASC
`);
    expect(names(first(result))).toEqual([['Epsilon', 'Gamma', 'Alfa', 'beta', 'Delta']]);
  });

  it('uten sort: file.name stigende med nb-kollasjon (case-ufølsom)', () => {
    expect(names(first(run('filters: file.ext == "md"\nviews:\n  - type: table\n    name: T\n')))).toEqual([
      ['Alfa', 'beta', 'Delta', 'Epsilon', 'Gamma'],
    ]);
  });

  it('limit kutter etter sortering', () => {
    expect(names(first(run('filters: file.ext == "md"\nviews:\n  - type: table\n    name: T\n    limit: 2\n')))).toEqual([['Alfa', 'beta']]);
  });
});

describe('runBase – gruppering', () => {
  it('table: groupBy med direction, «(ingen)» sist', () => {
    const view = first(
      run(`filters: file.ext == "md"
views:
  - type: table
    name: T
    groupBy:
      property: priority
      direction: DESC
`),
    );
    expect(view.grouped).toBe(true);
    expect(view.groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['10', 1],
      ['2', 2],
      ['1', 1],
      ['(ingen)', 1],
    ]);
    expect(view.groups[0]!.key).toEqual({ type: 'number', value: 10 });
    expect(view.groups.at(-1)!.key).toBeNull();
  });

  it('kanban: groupOrder først (også tomme, PO-11), så øvrige alfabetisk (case-sensitivt, B6), så «(ingen)»', () => {
    const view = run(`filters: file.ext == "md"
views:
  - type: kanban
    name: K
    groupBy:
      property: status
    groupOrder: [todo, doing, done]
`).views[0] as BaseKanbanView;
    expect(view.groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['todo', 1],
      ['doing', 1],
      ['done', 0],
      ['blocked', 1],
      ['Todo', 1],
      ['(ingen)', 1],
    ]);
    expect(view.groups[2]!.key).toEqual({ type: 'string', value: 'done' });
    expect(view.groupBy).toBe('note.status');
    expect(view.columns.map((c) => c.id)).toEqual(['file.name']);
  });

  it('kanban uten groupBy: én kolonne + advarsel', () => {
    const view = run('views:\n  - type: kanban\n    name: K\n').views[0] as BaseKanbanView;
    expect(view.groups).toHaveLength(1);
    expect(view.warnings.map((w) => w.code)).toEqual(['missing-group-by']);
  });

  it('dato-grupper får norsk etikett', () => {
    const view = first(run('filters: due\nviews:\n  - type: table\n    name: T\n    groupBy: due\n'));
    expect(view.groups.map((g) => g.label)).toEqual(['01.01.2026', '03.01.2026']);
  });
});

describe('runBase – kolonner og verdier', () => {
  it('order, columnSize normalisert (status = note.status), displayName, duplikater fjernes', () => {
    const view = first(
      run(`properties:
  note.status:
    displayName: Status
views:
  - type: table
    name: T
    order: [file.name, status, note.status, file.tags, file.mtime, file.folder]
    columnSize:
      file.name: 300
      status: 90
`),
    );
    expect(view.columns).toEqual([
      { id: 'file.name', label: 'Navn', width: 300 },
      { id: 'note.status', label: 'Status', width: 90 },
      { id: 'file.tags', label: 'Tagger' },
      { id: 'file.mtime', label: 'Endret' },
      { id: 'file.folder', label: 'Mappe' },
    ]);
  });

  it('celler: tagger, datoer, lister, lenker og mappe', () => {
    const view = first(run('filters: file.name == "beta"\nviews:\n  - type: table\n    name: T\n    order: [file.tags, relatert, file.mtime, file.folder, formula.x]\nformulas:\n  x: \'[1, "a"]\'\n'));
    expect(view.groups[0]!.rows[0]!.cells).toEqual({
      'file.tags': { type: 'list', value: [{ type: 'tag', value: 'task' }, { type: 'tag', value: 'team' }] },
      'note.relatert': { type: 'link', target: 'b/Gamma', display: 'Gamma' },
      'file.mtime': { type: 'date', value: '2026-11-01T12:00:00.000Z', hasTime: true },
      'file.folder': { type: 'string', value: 'a' },
      'formula.x': { type: 'list', value: [{ type: 'number', value: 1 }, { type: 'string', value: 'a' }] },
    });
  });

  it('ukjent file-felt i order gir advarsel og tom celle', () => {
    const view = first(run('views:\n  - type: table\n    name: T\n    order: [file.navn]\n'));
    expect(view.warnings.map((w) => w.code)).toEqual(['unknown-property']);
    expect(view.groups[0]!.rows[0]!.cells['file.navn']).toEqual({ type: 'null' });
  });

  it('lenke-property kan sammenlignes med link()', () => {
    const view = first(run('filters: relatert == link("b/Gamma")\nviews:\n  - type: table\n    name: T\n'));
    expect(names(view)).toEqual([['beta']]);
  });
});

describe('runBase – views', () => {
  const yaml = `views:
  - type: table
    name: Første
  - type: cards
    name: Kort
  - type: kanban
    name: Tavle
    groupBy: status
`;

  it('ukjent view-type blir unsupported uten å påvirke andre (B9)', () => {
    const result = run(yaml);
    expect(result.views.map((v) => [v.name, v.type])).toEqual([
      ['Første', 'table'],
      ['Kort', 'unsupported'],
      ['Tavle', 'kanban'],
    ]);
    expect(result.views[1]).toMatchObject({ originalType: 'cards', warnings: [{ code: 'unknown-view-type' }] });
  });

  it('navngitt view (PO-12), også uten hensyn til store/små bokstaver', () => {
    expect(run(yaml, 'Tavle').views.map((v) => v.name)).toEqual(['Tavle']);
    expect(run(yaml, 'tavle').views.map((v) => v.name)).toEqual(['Tavle']);
  });

  it('ukjent view (PO-34): ingen views, advarsel med tilgjengelige views', () => {
    const result = run(yaml, 'Finnes ikke');
    expect(result.views).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'unknown-view', source: 'Finnes ikke', availableViews: ['Første', 'Kort', 'Tavle'] }),
    ]);
  });
});
