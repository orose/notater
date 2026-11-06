import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Backlink } from '../../../shared/api-types';
import { h, root } from '../../test-support/hast';
import { Backlinks } from './Backlinks';
import { OutgoingLinks } from './OutgoingLinks';
import { RailBacklinks } from './RailBacklinks';
import { collectOutgoingLinks } from './outgoing-links';

const backlinks: Backlink[] = [
  { source: 'domene/kafka/Kafka-transaksjoner', sourceTitle: 'Kafka-transaksjoner', snippet: '…bygger videre på idempotent produsent og legger til…', count: 1 },
  { source: 'Velkommen', sourceTitle: 'Velkommen', snippet: 'Se Idempotent produsent.', count: 2 },
];

describe('Backlinks', () => {
  it('lister kilder med tittel, mappe og utdrag med uthevet treff (AK10)', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
<MemoryRouter>
        <Backlinks vaultId="test" title="Idempotent produsent" backlinks={backlinks} />
      </MemoryRouter>
</QueryClientProvider>,
    );
    const section = screen.getByRole('region', { name: 'Tilbakelenker' });
    expect(within(section).getByText('2 notater')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Kafka-transaksjoner' })).toHaveAttribute('href', '/v/test/domene/kafka/Kafka-transaksjoner');
    expect(within(section).getByText('domene/kafka')).toHaveClass('bl-path');
    expect(section.querySelectorAll('mark')[0]).toHaveTextContent('idempotent produsent');
  });

  it('tom tilstand', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
<MemoryRouter>
        <Backlinks vaultId="test" title="X" backlinks={[]} />
      </MemoryRouter>
</QueryClientProvider>,
    );
    expect(screen.getByText('Ingen notater lenker hit ennå.')).toBeInTheDocument();
  });

  it('margen viser bare en kompakt lenke ned til seksjonen (PO-44)', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
<MemoryRouter initialEntries={['/v/test/x']}>
        <RailBacklinks backlinks={backlinks} />
      </MemoryRouter>
</QueryClientProvider>,
    );
    expect(screen.getByRole('link', { name: 'Tilbakelenker (2) ↓' })).toHaveAttribute('href', '/v/test/x#tilbakelenker');
    expect(screen.queryByRole('link', { name: 'Velkommen' })).toBeNull();
  });

  it('uthever hele lenketeksten, også filendelsen (PO-45)', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
<MemoryRouter>
        <Backlinks
          vaultId="test"
          title="Oppgaver"
          path="Oppgaver.base"
          backlinks={[{ source: 'Velkommen', sourceTitle: 'Velkommen', snippet: 'Oppgaver: Oppgaver.base og Sprintoversikt', count: 1 }]}
        />
      </MemoryRouter>
</QueryClientProvider>,
    );
    expect([...document.querySelectorAll('.bl-ctx mark')].map((m) => m.textContent)).toEqual(['Oppgaver', 'Oppgaver.base']);
  });

  it('lenker fra egenskaper merkes «fra egenskap» (PO-9, BUG-002)', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
<MemoryRouter>
        <Backlinks
          vaultId="test"
          title="Ordre"
          backlinks={[{ source: 'edge/Frontmatter-typer', sourceTitle: 'Frontmatter-typer', snippet: '', count: 1, fromProperty: true }]}
        />
      </MemoryRouter>
</QueryClientProvider>,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent(/fra egenskap/);
  });
});

describe('collectOutgoingLinks', () => {
  const content = root(
    h('p', {}, h('a', { href: '/v/test/domene/Kunde', dataVrLink: 'internal', dataVrTarget: 'domene/Kunde' }, 'Kunde')),
    h('p', {}, h('a', { href: '/v/test/domene/Kunde#mal', dataVrLink: 'internal', dataVrTarget: 'domene/Kunde', dataVrAnchor: 'mal' }, 'Kunde › Mål')),
    h('p', {}, h('a', { dataVrLink: 'unresolved', dataVrRaw: 'Outbox-mønster' }, 'Outbox-mønster')),
    h('p', {}, h('a', { href: '/v/test/x#a', dataVrLink: 'internal', dataVrTarget: 'x' }, 'selv')),
    h('a', { href: 'https://x', dataVrLink: 'external' }, 'ekstern'),
    h(
      'vr-embed',
      { dataStatus: 'ok', dataTarget: 'teknisk/Leveransegarantier', dataTitle: 'Leveransegarantier' },
      h('p', {}, h('a', { href: '/v/test/inne', dataVrLink: 'internal', dataVrTarget: 'inne' }, 'inne')),
    ),
  );

  it('grupperer per mål, teller, merker embeds og brutte, hopper over selvlenker og innhold i embeds', () => {
    expect(collectOutgoingLinks(content, 'x')).toEqual([
      { target: 'domene/Kunde', title: 'Kunde', count: 2, embed: false, broken: false },
      { target: null, title: 'Outbox-mønster', count: 1, embed: false, broken: true },
      { target: 'teknisk/Leveransegarantier', title: 'Leveransegarantier', count: 1, embed: true, broken: false },
    ]);
  });

  it('OutgoingLinks viser antall og «finnes ikke»', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
<MemoryRouter>
        <OutgoingLinks vaultId="test" links={collectOutgoingLinks(content, 'x')} />
      </MemoryRouter>
</QueryClientProvider>,
    );
    expect(screen.getByText('2 ganger')).toBeInTheDocument();
    expect(screen.getByText('finnes ikke')).toBeInTheDocument();
    expect(screen.getByText('1 gang · embed')).toBeInTheDocument();
  });
});
