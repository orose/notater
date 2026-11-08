import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResponse } from '../../../shared/api-types';
import { mockApi } from '../../test-support/mock-api';
import { renderWithProviders } from '../../test-support/render-with-providers';
import { CommandProvider } from '../commands';
import { pushRecent } from '../recent';
import { SearchProvider } from './SearchProvider';
import { useOpenSearch } from './use-open-search';

afterEach(() => {
  vi.unstubAllGlobals();
});

const response: SearchResponse = {
  query: 'idempot',
  revision: 1,
  hits: [
    { path: 'domene/kafka/Idempotent produsent', title: 'Idempotent produsent', kind: 'note', matchedField: 'title', score: 9 },
    { path: 'domene/Ordre', title: 'Ordre', kind: 'note', matchedField: 'alias', alias: 'Idempotens', score: 5 },
    {
      path: 'arkitektur/ADR-014',
      title: 'ADR-014',
      kind: 'note',
      matchedField: 'content',
      snippet: { text: '…vi velger idempotent produsent…', highlights: [[11, 21]] },
      score: 2,
    },
  ],
};

function Opener({ query }: { readonly query?: string }) {
  const open = useOpenSearch();
  return (
    <button type="button" onClick={() => open(query)}>
      Søk
    </button>
  );
}

function setup(query?: string) {
  mockApi({
    '/api/vaults/test/search': response,
    '/api/vaults': { vaults: [{ id: 'test', name: 'Test', status: 'ready', noteCount: 80, revision: 1 }], defaultVaultId: 'test' },
  });
  return renderWithProviders(
    // ⌘K ligger i kommandoregisteret (ADR-007 §6), så paletten testes med CommandProvider.
    <SearchProvider vaultId="test">
      <CommandProvider vaultId="test" docPath="Velkommen" onOpenAppearance={() => {}}>
        <Opener query={query} />
      </CommandProvider>
    </SearchProvider>,
    { route: '/v/test/Velkommen' },
  );
}

describe('CommandPalette', () => {
  it('bunnlinjen viser Ctrl ↵ utenfor macOS (PO-36)', () => {
    setup();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByText(/ny fane/)).toHaveTextContent('Ctrl ↵ ny fane');
  });

  it('bunnlinjen viser ⌘ ↵ på macOS (PO-36)', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    setup();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByText(/ny fane/)).toHaveTextContent('⌘ ↵ ny fane');
    vi.restoreAllMocks();
  });

  it('valgt treff hentes i forkant (PO-51)', async () => {
    const api = (() => {
      setup();
      return (fetch as unknown as { mock: { calls: unknown[][] } }).mock;
    })();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'idempot' } });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    await waitFor(() =>
      expect(api.calls.map((c) => String(c[0]))).toContain('/api/vaults/test/document?path=domene%2Fkafka%2FIdempotent%20produsent'),
    );
  });

  it('⌘K åpner, viser grupperte treff og Enter åpner valgt notat', async () => {
    setup();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Hurtigsøk' });
    const input = within(dialog).getByRole('combobox');
    fireEvent.change(input, { target: { value: 'idempot' } });
    await waitFor(() => expect(within(dialog).getAllByRole('option')).toHaveLength(3));
    expect(within(dialog).getByText('Notater')).toBeInTheDocument();
    expect(within(dialog).getByText('Innhold')).toBeInTheDocument();
    expect(within(dialog).getByText('alias: Idempotens')).toBeInTheDocument();
    expect(dialog.querySelector('.res .x mark')).toHaveTextContent('idempotent');

    const options = within(dialog).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1]?.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/v/test/domene/Ordre');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Enter før søket har svart åpner første treff når det kommer', async () => {
    setup();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'idempot' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/v/test/domene/kafka/Idempotent%20produsent'));
  });

  it('åpnes med forhåndsutfylt spørring (tagg-klikk)', async () => {
    setup('#kafka');
    fireEvent.click(screen.getByRole('button', { name: 'Søk' }));
    expect(screen.getByRole('combobox')).toHaveValue('#kafka');
  });

  it('viser «Nylig åpnet» før man skriver', () => {
    pushRecent('test', { path: 'domene/Kunde', title: 'Kunde' });
    setup();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Hurtigsøk' });
    expect(within(dialog).getByText('Nylig åpnet')).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /Kunde/ })).toBeInTheDocument();
  });

  it('viser tom tilstand ved ingen treff', async () => {
    mockApi({ '/api/vaults/test/search': { query: 'zookeper', revision: 1, hits: [] }, '/api/vaults': { vaults: [], defaultVaultId: 'test' } });
    renderWithProviders(
      <SearchProvider vaultId="test">
        <Opener />
      </SearchProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Søk' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zookeper' } });
    expect(await screen.findByText('Ingen treff for «zookeper»')).toBeInTheDocument();
  });

  it('Esc (native close) lukker', async () => {
    setup();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Hurtigsøk' }) as HTMLDialogElement;
    act(() => dialog.close());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('⌘K i åpen palett lukker (dialogens egen tast)', () => {
    setup();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'k', metaKey: true });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it(':-modus: kommandoer med hurtigtast, deaktiverte med begrunnelse, Backspace over : gir søk', () => {
    setup();
    fireEvent.keyDown(document, { key: ':', shiftKey: true });
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue(':');
    expect(screen.getByRole('listbox', { name: 'Kommandoer' })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: ':fold alle' } });
    const foldAll = screen.getAllByRole('option')[0] as HTMLElement;
    expect(foldAll).toHaveAttribute('data-command-id', 'outline.foldAll');
    expect(foldAll).toHaveAttribute('aria-disabled', 'true');
    expect(foldAll).toHaveTextContent('Notatet har ingen overskrifter');
    expect([...foldAll.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['z', 'M']);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('listbox', { name: 'Søkeresultater' })).toBeInTheDocument();
  });

  it(':tema gir underliste; Enter på verdi lukker paletten og kjører kommandoen', async () => {
    setup();
    fireEvent.keyDown(document, { key: ':', shiftKey: true });
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: ':tem' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue(':tema ');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringMatching(/^AaTidsskrift/),
      expect.stringMatching(/^AaTerminal/),
      expect.stringMatching(/^Il1Klartekst/),
    ]);
    fireEvent.change(input, { target: { value: ':tema kla' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.type).toBe('klartekst'));
  });

  it('kommandomodus: feltet heter «Kommando», ⇥ fullfører, Ctrl n/p flytter, E492 og E475 ved ingen treff', () => {
    setup();
    fireEvent.keyDown(document, { key: ':', shiftKey: true });
    const input = screen.getByRole('combobox', { name: 'Kommando' });
    fireEvent.change(input, { target: { value: ':bre' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input).toHaveValue(':bredde');
    fireEvent.change(input, { target: { value: ':' } });
    const first = screen.getAllByRole('option')[0];
    expect(first).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'n', ctrlKey: true });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'p', ctrlKey: true });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(input, { target: { value: ':wq' } });
    expect(screen.getByText('E492')).toBeInTheDocument();
    expect(screen.getByText('Ingen kommando heter «wq».')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: ':tema xyz' } });
    expect(screen.getByText('E475')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('combobox', { name: 'Søk i notater' })).toBe(input);
  });
});
