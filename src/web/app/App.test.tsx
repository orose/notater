import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { noteFixture, treeFixture, vaultsFixture } from '../test-support/fixtures';
import { mockApi } from '../test-support/mock-api';
import { App } from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(path: string) {
  window.history.replaceState(null, '', path);
  mockApi({
    '/api/vaults': vaultsFixture,
    '/api/vaults/test/tree': treeFixture,
    '/api/vaults/test/document?path=Velkommen': noteFixture({ path: 'Velkommen', title: 'Velkommen', properties: [] }),
    '/api/vaults/test/document?path=domene/Ordre': noteFixture(),
  });
  return render(<App />);
}

describe('App', () => {
  it('/ sender til standardvaultet og viser forsiden (Velkommen)', async () => {
    setup('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Velkommen' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/v/test');
  });

  it('har landemerker: nav, main, aside og hopp-til-innhold', async () => {
    setup('/v/test/domene/Ordre');
    await screen.findByRole('heading', { level: 1, name: 'Ordre' });
    expect(screen.getByRole('navigation', { name: 'Vault' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'På denne siden' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hopp til innhold' })).toHaveAttribute('href', '#innhold');
  });

  it('klikk på intern lenke navigerer, og nettleser-tilbake går tilbake (AK11)', async () => {
    setup('/v/test/domene/Ordre');
    await screen.findByRole('heading', { level: 1, name: 'Ordre' });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Vault' })).getByRole('link', { name: 'Velkommen' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Velkommen' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/v/test/Velkommen');
    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe('/v/test/domene/Ordre'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ordre' })).toBeInTheDocument();
  });

  it('mobil-skuffen åpnes og lukkes med Esc; fokus tilbake til menyknappen', async () => {
    setup('/v/test/domene/Ordre');
    await screen.findByRole('heading', { level: 1, name: 'Ordre' });
    const menu = screen.getByRole('button', { name: 'Åpne navigasjon' });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Vault' })).toHaveAttribute('data-open', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });

  it('Utseende åpner temavelgeren', async () => {
    setup('/v/test/domene/Ordre');
    await screen.findByRole('heading', { level: 1, name: 'Ordre' });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Vault' })).getByRole('button', { name: 'Utseende' }));
    expect(screen.getByRole('dialog', { name: /Utseende/ })).toBeInTheDocument();
  });

  it('ukjent vault gir forklaring', async () => {
    setup('/v/finnes-ikke/x');
    expect(await screen.findByText('Fant ikke vaultet «finnes-ikke»')).toBeInTheDocument();
  });
});
