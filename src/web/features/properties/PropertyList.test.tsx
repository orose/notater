import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { PropertyEntry } from '../../../shared/api-types';
import { PropertyList } from './PropertyList';

const props: PropertyEntry[] = [
  { key: 'type', value: { type: 'string', value: 'konsept' } },
  { key: 'status', value: { type: 'string', value: 'aktiv' } },
  { key: 'kilde', value: { type: 'string', value: 'https://kafka.apache.org/kip-98' } },
  { key: 'farlig', value: { type: 'string', value: 'javascript:alert(1)' } },
  { key: 'relatert', value: { type: 'link', target: 'domene/Kunde', display: 'Kunde' } },
  { key: 'brutt', value: { type: 'link', target: null, display: 'Finnes ikke' } },
  { key: 'eier', value: { type: 'null' } },
  { key: 'antall', value: { type: 'number', value: 42 } },
  { key: 'ferdig', value: { type: 'boolean', value: true } },
  { key: 'frist', value: { type: 'date', value: '2026-11-08', hasTime: false } },
  {
    key: 'liste',
    value: { type: 'list', value: [{ type: 'string', value: 'a' }, { type: 'string', value: 'b' }] },
  },
  { key: 'tags', value: { type: 'list', value: [{ type: 'tag', value: 'kafka' }] } },
  { key: 'aliases', value: { type: 'list', value: [{ type: 'string', value: 'x' }] } },
  { key: 'cssclasses', value: { type: 'string', value: 'wide' } },
  { key: 'publish', value: { type: 'boolean', value: true } },
  { key: 'position', value: { type: 'string', value: 'x' } },
  { key: 'description', value: { type: 'string', value: 'Ingress' } },
];

function renderList(extra: Partial<Parameters<typeof PropertyList>[0]> = {}) {
  const onTagClick = vi.fn();
  render(
    <MemoryRouter>
      <PropertyList vaultId="test" properties={props} aliases={['idempotens', 'enable.idempotence']} onTagClick={onTagClick} {...extra} />
    </MemoryRouter>,
  );
  return { onTagClick };
}

describe('PropertyList', () => {
  it('viser properties som <dl> med etiketter, og skjuler tekniske felt (PO-22)', () => {
    renderList();
    const terms = screen.getAllByRole('term').map((t) => t.textContent);
    expect(terms).toEqual(['type', 'status', 'kilde', 'farlig', 'relatert', 'brutt', 'eier', 'antall', 'ferdig', 'frist', 'liste', 'Aliaser']);
  });

  it('skjuler ekstra properties fra hiddenProperties', () => {
    renderList({ hidden: ['type'] });
    expect(screen.queryByRole('term', { name: 'type' })).toBeNull();
    expect(screen.getAllByRole('term')[0]).toHaveTextContent('status');
  });

  it('rendrer verdityper', () => {
    renderList();
    expect(screen.getByText('aktiv')).toHaveAttribute('data-s', 'done');
    expect(screen.getByRole('link', { name: /kafka\.apache\.org/ })).toHaveAttribute('target', '_blank');
    expect(screen.getByText('javascript:alert(1)').closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'Kunde' })).toHaveAttribute('href', '/v/test/domene/Kunde');
    expect(screen.getByText('Finnes ikke')).toHaveClass('broken');
    expect(screen.getByText('ikke satt')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ferdig' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'ferdig' })).toBeDisabled();
    expect(screen.getByText('8. nov. 2026')).toBeInTheDocument();
    expect(screen.getByText('idempotens, enable.idempotence')).toBeInTheDocument();
  });

  it('rendrer ingenting uten synlige properties', () => {
    const { container } = render(
      <MemoryRouter>
        <PropertyList vaultId="test" properties={[]} aliases={[]} onTagClick={() => {}} />
      </MemoryRouter>,
    );
    expect(container.querySelector('dl')).toBeNull();
  });

  it('tagger i verdier er klikkbare', () => {
    const { onTagClick } = renderList({
      properties: [{ key: 'emne', value: { type: 'tag', value: 'kafka' } }],
    });
    fireEvent.click(screen.getByRole('button', { name: '#kafka' }));
    expect(onTagClick).toHaveBeenCalledWith('kafka');
  });
});
