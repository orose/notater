import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vaultsFixture } from '../../test-support/fixtures';
import { mockApi } from '../../test-support/mock-api';
import { renderWithProviders } from '../../test-support/render-with-providers';
import { VaultPicker } from './VaultPicker';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VaultPicker (B6)', () => {
  it('viser vaultnavn og bytter vault via meny', async () => {
    mockApi({ '/api/vaults': vaultsFixture });
    renderWithProviders(<VaultPicker vaultId="test" />, { route: '/v/test/Velkommen' });
    expect(await screen.findByText('Testvault')).toHaveClass('vault-name');
    const button = screen.getByRole('button', { name: 'Bytt vault (2 konfigurert)' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('list', { name: 'Vaults' });
    expect(within(menu).getByRole('link', { name: /Testvault/ })).toHaveAttribute('aria-current', 'true');
    fireEvent.click(within(menu).getByRole('link', { name: /Jobb/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/v/jobb');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('skjuler bytteknappen med bare ett vault', async () => {
    mockApi({ '/api/vaults': { ...vaultsFixture, vaults: vaultsFixture.vaults.slice(0, 1) } });
    renderWithProviders(<VaultPicker vaultId="test" />);
    await screen.findByText('Testvault');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
