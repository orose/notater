import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Tilgjengelig navn (aria-label) – bruk `labelledBy` hvis dialogen har synlig overskrift. */
  readonly label?: string;
  readonly labelledBy?: string;
  readonly className?: string;
  /** Dialogens egne taster (f.eks. `?` lukker hurtigtastoversikten). */
  readonly onKeyDown?: (event: KeyboardEvent<HTMLDialogElement>) => void;
  readonly children: ReactNode;
}

/**
 * Native `<dialog>` med `showModal()`: fokusfelle, Esc lukker, bakteppe-klikk lukker,
 * fokus returneres til elementet som åpnet dialogen.
 */
export function Modal({ open, onClose, label, labelledBy, className, onKeyDown, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    const onNativeClose = () => {
      onCloseRef.current();
      const target = returnFocus.current;
      returnFocus.current = null;
      if (target && target.isConnected) target.focus();
    };
    dialog.addEventListener('close', onNativeClose);
    return () => dialog.removeEventListener('close', onNativeClose);
  }, []);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={label}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        // Klikk på selve <dialog> utenfor boksen = bakteppet (padding inne i boksen teller ikke).
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (outside || rect.width === 0) event.currentTarget.close();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
