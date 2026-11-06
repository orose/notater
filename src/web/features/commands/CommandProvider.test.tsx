import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMediaQuery } from '../../test-support/match-media';
import { renderWithProviders } from '../../test-support/render-with-providers';
import { SearchProvider } from '../search';
import { WHICH_KEY_DELAY_MS } from '../keyboard';
import { CommandProvider } from './CommandProvider';
import { useCommands } from './use-commands';

const scrollTo = vi.fn();
const onOpenAppearance = vi.fn();

function HelpButton() {
  const { openShortcuts } = useCommands();
  return (
    <button type="button" onClick={openShortcuts}>
      Vis hurtigtaster
    </button>
  );
}

function setup(docPath = 'Velkommen') {
  return renderWithProviders(
    <SearchProvider vaultId="test">
      <CommandProvider vaultId="test" docPath={docPath} onOpenAppearance={onOpenAppearance}>
        <main>
          <input aria-label="Tekstfelt" />
          <button type="button">Knapp</button>
          <a href="#x">Lenke</a>
          <HelpButton />
        </main>
      </CommandProvider>
    </SearchProvider>,
    { route: `/v/test/${docPath}` },
  );
}

const key = (k: string, init: KeyboardEventInit = {}, target: Element | Document = document.body) => {
  act(() => {
    fireEvent.keyDown(target, { key: k, ...init });
  });
};

beforeEach(() => {
  scrollTo.mockReset();
  onOpenAppearance.mockReset();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  setMediaQuery('(prefers-reduced-motion: reduce)', false);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('CommandProvider: tastatur → kommandoer', () => {
  it('j ruller ned (myk); G og gg hopper til bunnen/toppen', () => {
    setup();
    key('j');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: expect.any(Number), behavior: 'smooth' });
    key('G', { shiftKey: true });
    key('g');
    key('g');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
  });

  it('prefers-reduced-motion: rulling uten animasjon', () => {
    setMediaQuery('(prefers-reduced-motion: reduce)', true);
    setup();
    key('d', { ctrlKey: true });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: expect.any(Number), behavior: 'auto' });
  });

  it('⌘K og / åpner notatsøk, : åpner kommandomodus', () => {
    setup();
    key('k', { metaKey: true });
    expect(screen.getByRole('combobox')).toHaveValue('');
    act(() => (screen.getByRole('dialog', { name: 'Hurtigsøk' }) as HTMLDialogElement).close());
    key('/', { shiftKey: true });
    expect(screen.getByRole('combobox')).toHaveValue('');
    act(() => (screen.getByRole('dialog', { name: 'Hurtigsøk' }) as HTMLDialogElement).close());
    key(':', { shiftKey: true });
    expect(screen.getByRole('combobox')).toHaveValue(':');
  });

  it('⌘. og Ctrl+. bytter lys/mørk – også i tekstfelt (inTextFields)', () => {
    setup();
    key('.', { metaKey: true });
    expect(document.documentElement.dataset.mode).toBe('dark');
    key('.', { ctrlKey: true }, screen.getByRole('textbox', { name: 'Tekstfelt' }));
    expect(document.documentElement.dataset.mode).toBe('light');
  });

  it('Space t åpner Utseende', () => {
    setup();
    key(' ');
    key('t');
    expect(onOpenAppearance).toHaveBeenCalledOnce();
  });

  it('P7: i tekstfelt virker ikke j, : eller Space-sekvenser', () => {
    setup();
    const field = screen.getByRole('textbox', { name: 'Tekstfelt' });
    key('j', {}, field);
    key(':', { shiftKey: true }, field);
    key(' ', {}, field);
    key('t', {}, field);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(onOpenAppearance).not.toHaveBeenCalled();
  });

  it('P7: bak en modal dialog er motoren inaktiv', () => {
    setup();
    key('?', { shiftKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Hurtigtaster' });
    key('j', {}, dialog);
    key(':', { shiftKey: true }, dialog);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('Space på en knapp beholder sin vanlige funksjon (ikke leader); på en lenke er den leader', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Knapp' });
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    act(() => {
      button.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    const link = screen.getByRole('link', { name: 'Lenke' });
    const onLink = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    act(() => {
      link.dispatchEvent(onLink);
    });
    expect(onLink.defaultPrevented).toBe(true);
  });

  it('en tast som allerede er håndtert (defaultPrevented) ignoreres', () => {
    setup();
    const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
    event.preventDefault();
    act(() => {
      document.body.dispatchEvent(event);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('tast på deaktivert kommando gir begrunnelsen som toast (AR-1.1-02)', () => {
    setup();
    key(' ');
    key('d');
    expect(screen.getByText('Diskré embedding – dette notatet: Kommer snart')).toBeInTheDocument();
  });

  it('Space w bytter lesebredde (huskes) og gir toast med tasttegn', () => {
    setup();
    key(' ');
    key('w');
    expect(document.documentElement.dataset.width).toBe('full');
    expect(JSON.parse(localStorage.getItem('vault-leser.visning') ?? '{}')).toEqual({ v: 1, width: 'full' });
    expect(screen.getByText('Full bredde')).toBeInTheDocument();
    key(' ');
    key('w');
    expect(document.documentElement.hasAttribute('data-width')).toBe(false);
    expect(screen.getByText('Leseoptimalisert bredde')).toBeInTheDocument();
  });

  it('Space z slår på zen; Esc går ut; Esc med påbegynt sekvens avbryter bare sekvensen', () => {
    setup();
    key(' ');
    key('z');
    expect(document.documentElement.dataset.zen).toBe('on');
    key('g');
    key('Escape');
    expect(document.documentElement.dataset.zen).toBe('on');
    key('Escape');
    expect(document.documentElement.hasAttribute('data-zen')).toBe(false);
  });

  it('which-key vises etter 400 ms med leader-kommandoene, og Esc skjuler den', () => {
    vi.useFakeTimers();
    setup();
    key(' ');
    expect(screen.queryByTestId('leader-hint')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(WHICH_KEY_DELAY_MS);
    });
    const hint = screen.getByTestId('leader-hint');
    expect([...hint.querySelectorAll('li kbd')].map((k) => k.textContent)).toEqual(['w', 'd', 'z', 'm', 't']);
    expect(hint).toHaveTextContent('bredde');
    key('Escape');
    expect(screen.queryByTestId('leader-hint')).not.toBeInTheDocument();
  });
});

describe('?-oversikten', () => {
  it('? åpner «Hurtigtaster» med gruppene i rekkefølge, par slått sammen', () => {
    setup();
    key('?', { shiftKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Hurtigtaster' });
    expect(within(dialog).getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Hurtigtaster',
      'Navigasjon',
      'Lesing',
      'Visning',
      'Søk og kommandoer',
    ]);
    const rows = within(dialog).getAllByTestId('hurtigtast-rad');
    const toggle = rows.find((r) => r.dataset.commandId === 'theme.toggleMode');
    expect(within(toggle as HTMLElement).getByTestId('hurtigtast-navn')).toHaveTextContent('Bytt lys/mørk');
    expect(
      within(toggle as HTMLElement)
        .getAllByTestId('hurtigtast-binding')
        .map((b) => [...b.querySelectorAll('kbd')].map((k) => k.textContent)),
    ).toEqual([['Space', 'm'], ['Ctrl .']]);
    // PO-69: par-rad med begge kommandoene.
    const scroll = rows.find((r) => r.dataset.commandIds === 'scroll.down scroll.up') as HTMLElement;
    expect(within(scroll).getByTestId('hurtigtast-navn')).toHaveTextContent('Rull ned / opp');
    expect([...scroll.querySelectorAll<HTMLElement>('[data-command-id]')].map((c) => [c.dataset.commandId, c.textContent])).toEqual([
      ['scroll.down', 'j'],
      ['scroll.up', 'k'],
    ]);
    // Enkel rad: id-en står på raden, ikke inne i den.
    expect((toggle as HTMLElement).querySelectorAll('[data-command-id]')).toHaveLength(0);
    expect(dialog).not.toHaveTextContent('⌘');
  });

  it('lukkes med ? (dialogens egen tast)', () => {
    setup();
    key('?', { shiftKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Hurtigtaster' });
    key('?', { shiftKey: true }, dialog);
    expect(screen.queryByRole('dialog', { name: 'Hurtigtaster' })).not.toBeInTheDocument();
  });

  it('kan åpnes fra andre deler av appen (useCommands)', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Vis hurtigtaster' }));
    expect(screen.getByRole('dialog', { name: 'Hurtigtaster' })).toBeInTheDocument();
  });
});
