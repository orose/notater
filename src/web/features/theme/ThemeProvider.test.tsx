import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setMediaQuery } from '../../test-support/match-media';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './use-theme';

function Probe() {
  const { preferences, resolvedMode, setPreferences } = useTheme();
  return (
    <div>
      <output data-testid="mode">{resolvedMode}</output>
      <output data-testid="pref">{preferences.mode}</output>
      <button type="button" onClick={() => setPreferences({ palette: 'fosfor' })}>
        fosfor
      </button>
    </div>
  );
}

const root = document.documentElement;

describe('ThemeProvider', () => {
  it('setter attributtene på <html> fra lagret valg', () => {
    localStorage.setItem('vault-leser.tema', JSON.stringify({ mode: 'dark', type: 'terminal', palette: 'signal' }));
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(root.dataset).toMatchObject({ type: 'terminal', palette: 'signal', mode: 'dark' });
  });

  it('følger prefers-color-scheme live når modus er system', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    act(() => setMediaQuery('(prefers-color-scheme: dark)', true));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(root.dataset.mode).toBe('dark');
  });

  it('ignorerer OS-endring når modus er låst', () => {
    localStorage.setItem('vault-leser.tema', JSON.stringify({ mode: 'light' }));
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => setMediaQuery('(prefers-color-scheme: dark)', true));
    expect(root.dataset.mode).toBe('light');
  });

  it('husker endringer i localStorage', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fosfor' }));
    expect(root.dataset.palette).toBe('fosfor');
    expect(JSON.parse(localStorage.getItem('vault-leser.tema') ?? '{}')).toMatchObject({ palette: 'fosfor' });
  });

  it('⌘. / Ctrl+. bytter mellom lys og mørk', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.keyDown(document, { key: '.', metaKey: true });
    expect(root.dataset.mode).toBe('dark');
    expect(screen.getByTestId('pref')).toHaveTextContent('dark');
    fireEvent.keyDown(document, { key: '.', ctrlKey: true });
    expect(root.dataset.mode).toBe('light');
  });
});
