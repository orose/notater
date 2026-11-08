import { describe, expect, it } from 'vitest';
import { parseBaseDefinition } from './parse-base';
import type { BaseDefinition } from './base-definition';

const ok = (yaml: string): BaseDefinition => {
  const parsed = parseBaseDefinition(yaml);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.definition;
};

const OPPGAVER = `filters:
  and:
    - file.hasTag("task")
    - file.folder != "templates"
formulas:
  team: if(file.hasTag("team"), "Testgjengen", "Mine oppgaver")
views:
  - type: table
    name: Huskeliste
    filters:
      and:
        - status != "done"
    groupBy:
      property: formula.team
      direction: ASC
    order:
      - file.name
      - status
    sort:
      - property: priority
        direction: ASC
      - property: due
        direction: desc
    columnSize:
      file.name: 553
      note.status: 101
  - type: kanban
    name: Kanban
    groupBy:
      property: status
    groupOrder:
      - todo
      - doing
    order:
      - file.name
  - type: table
    name: Arkiv
    indentProperties: false
    limit: 10
`;

describe('parseBaseDefinition', () => {
  it('leser kundens Oppgaver.base', () => {
    const def = ok(OPPGAVER);
    expect(def.warnings).toEqual([]);
    expect(def.filters).toEqual({
      kind: 'and',
      children: [
        { kind: 'expr', source: 'file.hasTag("task")' },
        { kind: 'expr', source: 'file.folder != "templates"' },
      ],
    });
    expect([...def.formulas]).toEqual([['team', 'if(file.hasTag("team"), "Testgjengen", "Mine oppgaver")']]);
    const [huskeliste, kanban, arkiv] = def.views;
    expect(huskeliste).toMatchObject({
      type: 'table',
      name: 'Huskeliste',
      filters: { kind: 'and', children: [{ kind: 'expr', source: 'status != "done"' }] },
      groupBy: { property: 'formula.team', direction: 'ASC' },
      order: ['file.name', 'status'],
      sort: [
        { property: 'priority', direction: 'ASC' },
        { property: 'due', direction: 'DESC' },
      ],
      columnSize: { 'file.name': 553, 'note.status': 101 },
      indentProperties: true,
      limit: null,
      warnings: [],
    });
    expect(kanban).toMatchObject({ type: 'kanban', groupBy: { property: 'status', direction: 'ASC' }, groupOrder: ['todo', 'doing'] });
    expect(arkiv).toMatchObject({ indentProperties: false, limit: 10, sort: [], groupBy: null });
  });

  it('or, not og nøstede filtre; uttrykk direkte som streng', () => {
    const def = ok(`filters:
  or:
    - file.hasTag("team")
    - and:
        - file.inFolder("prosjekter")
        - not:
            - status == "done"
views:
  - type: table
    name: A
    filters: 'status == "todo"'
`);
    expect(def.filters).toEqual({
      kind: 'or',
      children: [
        { kind: 'expr', source: 'file.hasTag("team")' },
        {
          kind: 'and',
          children: [
            { kind: 'expr', source: 'file.inFolder("prosjekter")' },
            { kind: 'not', children: [{ kind: 'expr', source: 'status == "done"' }] },
          ],
        },
      ],
    });
    expect(def.views[0]!.filters).toEqual({ kind: 'expr', source: 'status == "todo"' });
  });

  it('ukjente nøkler gir advarsel på riktig nivå, ikke krasj', () => {
    const def = ok(`filters:
  and:
    - file.hasTag("task")
tull: 1
views:
  - type: table
    name: Med feil
    ukjentNøkkel: 123
  - type: gallery
    name: Ukjent view-type
`);
    expect(def.warnings).toEqual([expect.objectContaining({ code: 'unknown-key', source: 'tull' })]);
    expect(def.views[0]!.warnings).toEqual([expect.objectContaining({ code: 'unknown-key', source: 'ukjentNøkkel' })]);
    expect(def.views[0]!.warnings[0]!.message).toContain('ukjentNøkkel');
    expect(def.views[1]!.type).toBe('gallery');
  });

  it('feil form på kjente nøkler gir advarsel og ignoreres', () => {
    const def = ok(`filters:
  xor:
    - a
formulas: 5
views:
  - type: table
    name: V
    sort: feil
    order: file.name
    columnSize:
      file.name: bred
`);
    expect(def.filters).toBeNull();
    expect(def.formulas.size).toBe(0);
    expect(def.warnings.map((w) => w.code)).toEqual(['invalid-filter', 'invalid-value']);
    expect(def.views[0]!.order).toEqual(['file.name']);
    expect(def.views[0]!.sort).toEqual([]);
    expect(def.views[0]!.columnSize).toEqual({});
    expect(def.views[0]!.warnings.map((w) => w.code)).toEqual(['invalid-value', 'invalid-value']);
  });

  it('views uten navn får standardnavn; ingen views gir én standardtabell', () => {
    expect(ok('views:\n  - type: table\n').views[0]!.name).toBe('Tabell');
    expect(ok('views:\n  - type: kanban\n').views[0]!.name).toBe('Kanban');
    expect(ok('filters: file.hasTag("x")\n').views).toEqual([expect.objectContaining({ type: 'table', name: 'Tabell' })]);
    expect(ok('').views).toHaveLength(1);
  });

  it('formler med tall/bool tolkes som uttrykkstekst', () => {
    expect([...ok('formulas:\n  a: 5\n  b: true\n').formulas]).toEqual([
      ['a', '5'],
      ['b', 'true'],
    ]);
  });

  it('displayName fra properties', () => {
    expect(ok('properties:\n  note.status:\n    displayName: Status\n  file.name:\n    displayName: Oppgave\n').displayNames).toEqual({
      'note.status': 'Status',
      'file.name': 'Oppgave',
    });
  });

  it('ugyldig YAML gir feilkort med linjenummer (Sprintoversikt blokk 4)', () => {
    const parsed = parseBaseDefinition('filters:\n  and:\n    - file.hasTag("task"\nviews: [\n');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe('invalid-yaml');
    expect(parsed.error.message).toMatch(/^Kunne ikke lese base-definisjonen \(linje \d+\)/);
  });

  it('YAML som ikke er et objekt gir feilkort', () => {
    for (const yaml of ['- a\n- b\n', '42', '"tekst"']) {
      const parsed = parseBaseDefinition(yaml);
      expect(parsed.ok, yaml).toBe(false);
    }
  });
});
