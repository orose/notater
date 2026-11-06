import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseDocFixture, noteFixture, vaultsFixture } from '../../test-support/fixtures';
import { h, root } from '../../test-support/hast';
import { mockApi } from '../../test-support/mock-api';
import { renderWithProviders } from '../../test-support/render-with-providers';
import { readRecent } from '../recent';
import { SearchProvider } from '../search';
import { DocumentPage } from './DocumentPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(route: string) {
  return renderWithProviders(
    <SearchProvider vaultId="test">
      <Routes>
        <Route path="/v/:vaultId/*" element={<DocumentPage />} />
      </Routes>
    </SearchProvider>,
    { route },
  );
}

describe('DocumentPage – notat', () => {
  it('viser header med brødsmule, tittel, ingress, properties, tagger og metadata', async () => {
    mockApi({ '/api/vaults/test/document?path=domene/Ordre': noteFixture(), '/api/vaults': vaultsFixture });
    renderAt('/v/test/domene/Ordre');
    await screen.findByRole('heading', { level: 1, name: 'Ordre' });
    const main = screen.getByRole('main');
    expect(within(main).getByText('domene', { selector: '.crumb span' })).toBeInTheDocument();
    expect(within(main).getByText('Hvordan en ordre flyter gjennom systemet.')).toHaveClass('dek');
    expect(within(main).getByText('aktiv')).toHaveAttribute('data-s', 'done');
    expect(within(main).getByRole('button', { name: '#kafka/topic' })).toBeInTheDocument();
    expect(within(main).getByText(/Endret 3\. nov\. 2026/)).toBeInTheDocument();
    expect(within(main).getByText(/1 min lesing/)).toBeInTheDocument();
    expect(within(main).getByText('Bestilling')).toBeInTheDocument(); // alias
    expect(document.title).toBe('Ordre · Testvault');
  });

  it('har innhold, TOC i margen, lenker herfra og tilbakelenker', async () => {
    mockApi({ '/api/vaults/test/document?path=domene/Ordre': noteFixture(), '/api/vaults': vaultsFixture });
    renderAt('/v/test/domene/Ordre');
    const aside = await screen.findByRole('complementary', { name: 'På denne siden' });
    expect(within(aside).getByRole('navigation', { name: 'Innhold' })).toBeInTheDocument();
    expect(within(aside).getByText('Lenker herfra')).toBeInTheDocument();
    expect(within(aside).getByRole('link', { name: 'Kunde' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tilbakelenker' })).toBeInTheDocument();
    expect(document.querySelector('.prose p.lede')).toHaveTextContent('En ordre opprettes');
  });

  it('første H1 blir visningstittel og vises ikke dobbelt (PO-35)', async () => {
    mockApi({
      '/api/vaults/test/document?path=Velkommen': noteFixture({
        path: 'Velkommen',
        title: 'Velkommen',
        properties: [],
        content: root(h('h1', { id: 'velkommen-til-testvaultet' }, 'Velkommen til testvaultet'), '\n', h('p', {}, 'Dette er et vault.')),
        toc: [{ depth: 1, text: 'Velkommen til testvaultet', id: 'velkommen-til-testvaultet' }],
        backlinks: [{ source: 'Sprintoversikt', sourceTitle: 'Sprintoversikt', snippet: 'Tilbake til Velkommen.', count: 1 }],
      }),
      '/api/vaults': vaultsFixture,
    });
    renderAt('/v/test/Velkommen');
    await screen.findByRole('heading', { level: 1, name: 'Velkommen til testvaultet' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText('Velkommen', { selector: 'h1' })).not.toBeInTheDocument();
    expect(document.querySelector('.prose p.lede')).toHaveTextContent('Dette er et vault.');
    expect(document.title).toBe('Velkommen til testvaultet · Testvault');
    expect(readRecent('test')[0]).toEqual({ path: 'Velkommen', title: 'Velkommen til testvaultet' });
    // Utdrag i tilbakelenker uthever lenketeksten (filnavnet), ikke visningstittelen.
    expect(screen.getByText('Velkommen', { selector: '.bl-ctx mark' })).toBeInTheDocument();
  });

  it('lenke med ukjent seksjon gir toast etter navigering (README-QA regel 7)', async () => {
    mockApi({
      '/api/vaults/test/document?path=lenker/Lenketest': noteFixture({
        path: 'lenker/Lenketest',
        title: 'Lenketest',
        properties: [],
        content: root(
          h('p', {}, h('a', { href: '/v/test/domene/Ordre', dataVrLink: 'internal', dataVrTarget: 'domene/Ordre', dataVrAnchorMissing: 'true' }, 'Ordre › Borte')),
        ),
        toc: [],
        backlinks: [],
      }),
      '/api/vaults/test/document?path=domene/Ordre': noteFixture(),
      '/api/vaults': vaultsFixture,
    });
    renderAt('/v/test/lenker/Lenketest');
    fireEvent.click(await screen.findByRole('link', { name: 'Ordre › Borte' }));
    await screen.findByRole('heading', { level: 1, name: 'Ordre' });
    expect(await screen.findByText('Fant ikke seksjonen – viser toppen av notatet.')).toHaveClass('toast');
  });

  it('husker notatet i «Nylig åpnet»', async () => {
    mockApi({ '/api/vaults/test/document?path=domene/Ordre': noteFixture(), '/api/vaults': vaultsFixture });
    renderAt('/v/test/domene/Ordre');
    await screen.findByRole('heading', { level: 1 });
    expect(readRecent('test')[0]).toEqual({ path: 'domene/Ordre', title: 'Ordre' });
  });

  it('tag-klikk åpner søk på taggen', async () => {
    mockApi({ '/api/vaults/test/document?path=domene/Ordre': noteFixture(), '/api/vaults': vaultsFixture });
    renderAt('/v/test/domene/Ordre');
    fireEvent.click(await screen.findByRole('button', { name: '#domene' }));
    expect(screen.getByRole('combobox')).toHaveValue('#domene');
  });

  it('tomt notat får vennlig tom-tilstand (QA-IDX-05)', async () => {
    mockApi({
      '/api/vaults/test/document?path=edge/Tomt notat': noteFixture({ path: 'edge/Tomt notat', title: 'Tomt notat', properties: [], content: root(), toc: [], backlinks: [] }),
      '/api/vaults': vaultsFixture,
    });
    renderAt('/v/test/edge/Tomt%20notat');
    expect(await screen.findByText('Notatet er tomt.')).toBeInTheDocument();
  });

  it('dekoder URL-en per segment (QA-URL-04)', async () => {
    const api = mockApi({ '/api/vaults': vaultsFixture });
    renderAt('/v/test/edge/R%26D%20%E2%80%93%20sp%C3%B8rsm%C3%A5l%20og%20svar');
    await screen.findByRole('heading', { level: 1 });
    const call = api.calls.find((u) => u.pathname.endsWith('/document'));
    expect(call?.searchParams.get('path')).toBe('edge/R&D – spørsmål og svar');
  });

  it('ukjent notat gir «Dette notatet er ikke skrevet ennå» (QA-URL-07)', async () => {
    mockApi({ '/api/vaults': vaultsFixture });
    renderAt('/v/test/domene/Outbox-m%C3%B8nster');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeInTheDocument();
    expect(screen.getByText('domene/Outbox-mønster.md')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Søk etter «Outbox-mønster»' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Til forsiden' })).toHaveAttribute('href', '/v/test');
  });

  it('viser ikke-støttet-filer (canvas) via innholdet', async () => {
    mockApi({
      '/api/vaults/test/document?path=Tegning.canvas': noteFixture({
        path: 'Tegning.canvas',
        title: 'Tegning',
        properties: [],
        tags: [],
        aliases: [],
        toc: [],
        content: root(h('vr-unsupported', { dataKind: 'canvas', dataSource: '{}' })),
      }),
      '/api/vaults': vaultsFixture,
    });
    renderAt('/v/test/Tegning.canvas');
    expect(await screen.findByText('Canvas støttes ikke.')).toBeInTheDocument();
  });

  it('base-dokument vises som base', async () => {
    mockApi({ '/api/vaults/test/document?path=Oppgaver.base': baseDocFixture(), '/api/vaults': vaultsFixture });
    renderAt('/v/test/Oppgaver.base');
    expect(await screen.findByRole('heading', { level: 1, name: 'Oppgaver' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Base: Oppgaver' })).toBeInTheDocument();
  });

  it('bilder vises direkte uten /document-kall', async () => {
    const api = mockApi({ '/api/vaults': vaultsFixture });
    renderAt('/v/test/attachments/arkitektur.png');
    expect(await screen.findByRole('img', { name: 'arkitektur.png' })).toHaveAttribute(
      'src',
      '/api/vaults/test/assets?path=attachments%2Farkitektur.png',
    );
    expect(api.calls.some((u) => u.pathname.endsWith('/document'))).toBe(false);
  });
});
