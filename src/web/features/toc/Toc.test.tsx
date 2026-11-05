import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TocEntry } from '../../../shared/api-types';
import { InlineToc } from './InlineToc';
import { Toc } from './Toc';
import { tocTree, visibleToc } from './toc-tree';

const entries: TocEntry[] = [
  { depth: 2, text: 'Problemet', id: 'problemet' },
  { depth: 2, text: 'Slik virker det', id: 'slik-virker-det' },
  { depth: 3, text: 'Konfigurasjon', id: 'konfigurasjon' },
  { depth: 5, text: 'For dypt', id: 'for-dypt' },
  { depth: 2, text: 'Hvor garantien slutter', id: 'hvor' },
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('toc-tree', () => {
  it('tar med nivå 2–4 og viser fra 3 overskrifter (PO-15, QA-TOC-02)', () => {
    expect(visibleToc(entries).map((e) => e.id)).toEqual(['problemet', 'slik-virker-det', 'konfigurasjon', 'hvor']);
    expect(visibleToc(entries.slice(0, 2))).toEqual([]);
  });

  it('nøster underoverskrifter', () => {
    const tree = tocTree(visibleToc(entries));
    expect(tree.map((n) => n.entry.id)).toEqual(['problemet', 'slik-virker-det', 'hvor']);
    expect(tree[1]?.children.map((n) => n.entry.id)).toEqual(['konfigurasjon']);
  });
});

describe('Toc', () => {
  it('lenker til ankrene', () => {
    render(
      <MemoryRouter initialEntries={['/v/test/x']}>
        <Toc entries={entries} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Innhold' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Konfigurasjon' })).toHaveAttribute('href', '/v/test/x#konfigurasjon');
  });

  it('scroll-spy markerer aktiv seksjon', () => {
    for (const [id, top] of [
      ['problemet', -400],
      ['slik-virker-det', 50],
      ['konfigurasjon', 900],
      ['hvor', 1600],
    ] as const) {
      const h = document.createElement('h2');
      h.id = id;
      h.getBoundingClientRect = vi.fn(() => ({ top }) as DOMRect);
      document.body.append(h);
    }
    render(
      <MemoryRouter initialEntries={['/v/test/x']}>
        <Toc entries={entries} />
      </MemoryRouter>,
    );
    act(() => {
      fireEvent.scroll(window);
    });
    expect(screen.getByRole('link', { name: 'Slik virker det' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Problemet' })).not.toHaveAttribute('aria-current');
  });

  it('rendrer ingenting for korte notater', () => {
    const { container } = render(
      <MemoryRouter>
        <Toc entries={entries.slice(0, 2)} />
        <InlineToc entries={entries.slice(0, 2)} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('InlineToc er sammenleggbar', () => {
    render(
      <MemoryRouter>
        <InlineToc entries={entries} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Innhold', { selector: 'summary span' })).toBeInTheDocument();
    expect(document.querySelector('details.toc-inline')).not.toHaveAttribute('open');
  });
});
