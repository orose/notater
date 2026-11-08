import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function Harness({ onClose }: { readonly onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Åpne
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        label="Test"
        className="theme-panel"
      >
        <button type="button">Inne i</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('åpnes med showModal og lukkes ved native close (Esc)', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Åpne' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Test' });
    expect(dialog).toHaveAttribute('open');
    (dialog as HTMLDialogElement).close();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it('lukkes ved klikk på bakteppet', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Åpne' }));
    fireEvent.click(screen.getByRole('dialog', { name: 'Test' }));
    expect(onClose).toHaveBeenCalled();
  });
});
