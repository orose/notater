import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { treeFixture, vaultsFixture } from '../../test-support/fixtures';
import { mockApi } from '../../test-support/mock-api';
import { renderWithProviders } from '../../test-support/render-with-providers';
import { SearchProvider } from '../search';
import { Sidebar } from './Sidebar';
import { pushRecent } from '../recent';

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(routes: Record<string, unknown> = {}) {
  mockApi({ '/api/vaults': vaultsFixture, '/api/vaults/test/tree': treeFixture, ...routes });
  const onOpenTheme = vi.fn();
  renderWithProviders(
    <SearchProvider vaultId="test">
      <Sidebar id="sidebar" vaultId="test" currentPath="domene/Kunde" open={false} onOpenTheme={onOpenTheme} onNavigate={() => {}} />
    </SearchProvider>,
    { route: '/v/test/domene/Kunde' },
  );
  return { onOpenTheme };
}

describe('Sidebar', () => {
  it('er et nav-landemerke med vault, søk, filtre, mapper og bunnlinje', async () => {
    const { onOpenTheme } = setup();
    const nav = screen.getByRole('navigation', { name: 'Vault' });
    expect(await within(nav).findByRole('link', { name: 'Kunde' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('heading', { name: /Mapper/ })).toHaveTextContent('5');
    expect(within(nav).getByRole('button', { name: /Søk i notater/ })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole('button', { name: 'Utseende' }));
    expect(onOpenTheme).toHaveBeenCalled();
  });

  it('søkeknappen åpner ⌘K', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Søk i notater/ }));
    expect(screen.getByRole('dialog', { name: 'Hurtigsøk' })).toBeInTheDocument();
  });

  it('viser Ctrl K utenfor macOS (PO-36)', () => {
    setup();
    expect(screen.getByRole('button', { name: /Søk i notater/ })).toHaveTextContent('Ctrl K');
  });

  it('viser ⌘K på macOS (PO-36)', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    setup();
    expect(screen.getByRole('button', { name: /Søk i notater/ })).toHaveTextContent('⌘K');
    vi.restoreAllMocks();
  });

  it('filteret «Bases» viser bare .base-filer', async () => {
    setup();
    await screen.findByRole('link', { name: 'Kunde' });
    fireEvent.click(screen.getByRole('button', { name: 'Bases' }));
    expect(screen.getByRole('button', { name: 'Bases' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Oppgaver.base' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kunde' })).toBeNull();
  });

  it('filteret «Nylig» viser nylig åpnede notater', async () => {
    pushRecent('test', { path: 'teknisk/Callouts', title: 'Callouts' });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Nylig' }));
    expect(screen.getByRole('link', { name: 'Callouts' })).toHaveAttribute('href', '/v/test/teknisk/Callouts');
  });

  it('tagger filtrerer sidepanelet; × fjerner filteret', async () => {
    setup({
      '/api/vaults/test/tags': { vaultId: 'test', tags: [{ tag: 'kafka', count: 2 }] },
      '/api/vaults/test/search': {
        query: '#kafka',
        revision: 1,
        hits: [{ path: 'domene/Ordre', title: 'Ordre', kind: 'note', matchedField: 'content', score: 1 }],
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: /#kafka/ }));
    expect(await screen.findByRole('link', { name: 'Ordre' })).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: 'Fjern filter #kafka' });
    fireEvent.click(chip);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Fjern filter #kafka' })).toBeNull());
  });

  it('skjuler taggseksjonen når serveren ikke har /tags', async () => {
    setup();
    await screen.findByRole('link', { name: 'Kunde' });
    expect(screen.queryByRole('heading', { name: 'Tagger' })).toBeNull();
  });
});
