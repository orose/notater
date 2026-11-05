import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { BaseResult } from '../../../shared/api-types';
import { BaseBlock } from './BaseBlock';

const result: BaseResult = {
  warnings: [{ code: 'unknown-key', message: '1 ukjent nøkkel ignorert: cardSize', source: 'cardSize' }],
  views: [
    {
      type: 'table',
      name: 'Huskeliste',
      columns: [
        { id: 'file.name', label: 'file.name', width: 553 },
        { id: 'note.status', label: 'status' },
        { id: 'note.due', label: 'due' },
      ],
      grouped: true,
      indentProperties: false,
      totalRows: 2,
      warnings: [],
      groups: [
        {
          key: { type: 'string', value: 'Mine oppgaver' },
          label: 'Mine oppgaver',
          rows: [
            {
              path: 'oppgaver/Migrer til Java 21',
              cells: {
                'file.name': { type: 'string', value: 'Migrer til Java 21' },
                'note.status': { type: 'string', value: 'doing' },
                'note.due': { type: 'date', value: '2026-11-08', hasTime: false },
              },
            },
          ],
        },
        {
          key: null,
          label: '(ingen)',
          rows: [{ path: 'oppgaver/Oppdater README', cells: { 'file.name': { type: 'string', value: 'Oppdater README' } } }],
        },
      ],
    },
    {
      type: 'kanban',
      name: 'Kanban',
      groupBy: 'note.status',
      columns: [
        { id: 'file.name', label: 'file.name' },
        { id: 'file.tags', label: 'file.tags' },
      ],
      totalRows: 1,
      warnings: [],
      groups: [
        {
          key: { type: 'string', value: 'todo' },
          label: 'todo',
          rows: [
            {
              path: 'oppgaver/Oppdater README',
              cells: {
                'file.name': { type: 'string', value: 'Oppdater README' },
                'file.tags': { type: 'list', value: [{ type: 'tag', value: 'task' }] },
              },
            },
          ],
        },
        { key: null, label: '(ingen)', rows: [] },
      ],
    },
    { type: 'unsupported', name: 'Galleri', originalType: 'cards', warnings: [] },
  ],
};

function renderBase(extra: Partial<Parameters<typeof BaseBlock>[0]> = {}) {
  return render(
    <MemoryRouter>
      <BaseBlock vaultId="test" result={result} sourcePath="Oppgaver.base" {...extra} />
    </MemoryRouter>,
  );
}

describe('BaseBlock', () => {
  it('viser kilde, antall og faner per view', () => {
    renderBase();
    const region = screen.getByRole('region', { name: 'Base: Oppgaver' });
    expect(within(region).getByRole('link', { name: /Oppgaver\.base/ })).toHaveAttribute('href', '/v/test/Oppgaver.base');
    expect(within(region).getByText('2 resultater')).toBeInTheDocument();
    const tabs = within(region).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Huskeliste2', 'Kanban1', 'Galleri']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('tabell med grupperader, lenker, statusprikk og dato (dd.MM.yyyy)', () => {
    renderBase();
    const table = screen.getByRole('table');
    expect([...table.querySelectorAll('thead th')].map((c) => c.textContent)).toEqual(['file.name', 'status', 'due']);
    expect(within(table).getByRole('link', { name: 'Migrer til Java 21' })).toHaveAttribute('href', '/v/test/oppgaver/Migrer%20til%20Java%2021');
    expect(within(table).getByText('doing')).toHaveAttribute('data-s', 'doing');
    expect(within(table).getByText('08.11.2026')).toBeInTheDocument();
    expect(within(table).getByText('Mine oppgaver')).toBeInTheDocument();
    expect(within(table).getByText('(ingen)')).toBeInTheDocument();
  });

  it('piltaster bytter fane; kanban viser kolonner og kort', () => {
    renderBase();
    const tabs = screen.getAllByRole('tab');
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: 'ArrowRight' });
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    const lanes = document.querySelectorAll('.lane');
    expect(lanes).toHaveLength(2);
    expect(lanes[1]).toHaveClass('none');
    expect(screen.getByRole('link', { name: /Oppdater README/ })).toHaveClass('card');
    expect(screen.getByText('#task')).toBeInTheDocument();
  });

  it('ukjent view-type gir diskret kort', () => {
    renderBase();
    fireEvent.click(screen.getAllByRole('tab')[2] as HTMLElement);
    expect(screen.getByText('View-typen «cards» støttes ikke.')).toBeInTheDocument();
  });

  it('viser advarsler diskret', () => {
    renderBase();
    expect(screen.getByText('1 ukjent nøkkel ignorert: cardSize')).toBeInTheDocument();
  });

  it('bare navngitt view ved data-view (PO-12)', () => {
    renderBase({ viewName: 'Kanban' });
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(document.querySelector('.kanban')).not.toBeNull();
  });

  it('inline base-blokk uten kildefil og manglende resultat', () => {
    render(
      <MemoryRouter>
        <BaseBlock vaultId="test" result={undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: 'Base i notatet' })).toBeInTheDocument();
    expect(screen.getByText('Basen kunne ikke vises.')).toBeInTheDocument();
  });
});
