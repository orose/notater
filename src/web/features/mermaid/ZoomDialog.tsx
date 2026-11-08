import { useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { Icon } from '../../shared/ui/Icon';
import { Modal } from '../../shared/ui/Modal';

interface ZoomDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly svg: string;
  readonly label: string;
}

interface View {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

const START: View = { scale: 1, x: 0, y: 0 };
const clamp = (n: number) => Math.min(8, Math.max(0.25, n));

/** Forstørret diagram: pan (dra), zoom (hjul/klyp, + / − / 0 på tastatur). Esc lukker. */
export function ZoomDialog({ open, onClose, svg, label }: ZoomDialogProps) {
  const [view, setView] = useState<View>(START);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const zoomBy = (factor: number) => setView((v) => ({ ...v, scale: clamp(v.scale * factor) }));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 40;
    switch (event.key) {
      case '+':
      case '=':
        zoomBy(1.25);
        break;
      case '-':
      case '−':
        zoomBy(0.8);
        break;
      case '0':
        setView(START);
        break;
      case 'ArrowLeft':
        setView((v) => ({ ...v, x: v.x + step }));
        break;
      case 'ArrowRight':
        setView((v) => ({ ...v, x: v.x - step }));
        break;
      case 'ArrowUp':
        setView((v) => ({ ...v, y: v.y + step }));
        break;
      case 'ArrowDown':
        setView((v) => ({ ...v, y: v.y - step }));
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    drag.current = { id: d.id, x: event.clientX, y: event.clientY };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setView(START);
        onClose();
      }}
      label="Diagram, forstørret"
      className="zoom-dialog"
    >
      <div className="bar">
        <span className="label">{label}</span>
        <span className="zoom-tools">
          <button type="button" className="icon-btn" aria-label="Zoom ut" onClick={() => zoomBy(0.8)}>
            −
          </button>
          <button type="button" className="icon-btn" aria-label="Tilbakestill zoom" onClick={() => setView(START)}>
            {Math.round(view.scale * 100)} %
          </button>
          <button type="button" className="icon-btn" aria-label="Zoom inn" onClick={() => zoomBy(1.25)}>
            +
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Lukk"
            onClick={(event) => event.currentTarget.closest('dialog')?.close()}
          >
            <Icon name="close" />
          </button>
        </span>
      </div>
      <div
        className="zoom-stage"
        tabIndex={0}
        role="application"
        aria-label={`${label}. Dra for å panorere, + og − zoomer, 0 tilbakestiller.`}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="zoom-content"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </Modal>
  );
}
