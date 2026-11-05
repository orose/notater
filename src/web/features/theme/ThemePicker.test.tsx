import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemePicker } from './ThemePicker';
import { ThemeProvider } from './ThemeProvider';

function renderPicker() {
  const onClose = vi.fn();
  render(
    <ThemeProvider>
      <ThemePicker open onClose={onClose} />
    </ThemeProvider>,
  );
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Utseende' }) };
}

const root = document.documentElement;

describe('ThemePicker', () => {
  it('har modus, typografi, palett og ornamentikk', () => {
    const { dialog } = renderPicker();
    expect(within(dialog).getByRole('group', { name: 'Modus' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Typografi' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Palett' })).toBeInTheDocument();
    expect(within(dialog).getByRole('switch', { name: /Ornamentikk/ })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'System' })).toBeChecked();
  });

  it('endringer gjelder umiddelbart og lagres', () => {
    const { dialog } = renderPicker();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Mørk' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: /Terminal/ }));
    fireEvent.click(within(dialog).getByRole('radio', { name: /Signal/ }));
    expect(root.dataset).toMatchObject({ mode: 'dark', type: 'terminal', palette: 'signal' });
    expect(JSON.parse(localStorage.getItem('vault-leser.tema') ?? '{}')).toMatchObject({
      mode: 'dark',
      type: 'terminal',
      palette: 'signal',
    });
  });

  it('ornamentikk-bryteren slår av initial og seksjonsnummer (PO-19)', () => {
    const { dialog } = renderPicker();
    fireEvent.click(within(dialog).getByRole('switch', { name: /Ornamentikk/ }));
    expect(root.dataset.ornaments).toBe('off');
    expect(within(dialog).getByRole('switch', { name: /Ornamentikk/ })).not.toBeChecked();
  });

  it('merker anbefalte paletter for valgt typesett', () => {
    const { dialog } = renderPicker();
    const papir = within(dialog).getByRole('radio', { name: /Papir/ }).closest('label');
    expect(papir).toHaveTextContent('Anbefalt');
    const fosfor = within(dialog).getByRole('radio', { name: /Fosfor/ }).closest('label');
    expect(fosfor).not.toHaveTextContent('Anbefalt');
  });

  it('lukk-knappen lukker', () => {
    const { dialog, onClose } = renderPicker();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lukk' }));
    expect(onClose).toHaveBeenCalled();
  });
});
