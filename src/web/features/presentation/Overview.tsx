// Lysbildeoversikten (`o`, designsystem §12.8, AR-2-19): modal dialog med rutenett av de ekte lysbildene i miniatyr.
// Eier sine egne taster: piltaster/`hjkl` flytter (opp/ned geometrisk), Enter/klikk hopper, `o` og Esc lukker.

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Modal } from '../../shared/ui/Modal';
import type { SlideDeck } from './model';
import { SlideView, type DeckInfo } from './SlideView';

interface Props {
  readonly open: boolean;
  readonly deck: SlideDeck;
  readonly info: DeckInfo;
  readonly current: number;
  readonly onGo: (index: number) => void;
  readonly onClose: () => void;
}

/** Nærmeste knapp i raden over/under (geometrisk, tåler ujevne rader). */
function vertical(buttons: readonly HTMLElement[], from: number, direction: 1 | -1): number {
  const here = buttons[from]?.getBoundingClientRect();
  if (!here) return from;
  const cx = here.left + here.width / 2;
  let best = from;
  let bestRow = Infinity;
  let bestDx = Infinity;
  buttons.forEach((b, i) => {
    const r = b.getBoundingClientRect();
    const dy = (r.top - here.top) * direction;
    if (dy <= 2) return;
    const dx = Math.abs(r.left + r.width / 2 - cx);
    if (dy < bestRow - 2 || (Math.abs(dy - bestRow) <= 2 && dx < bestDx)) {
      best = i;
      bestRow = dy;
      bestDx = dx;
    }
  });
  return best;
}

const KIND_CAPTION: Record<string, string> = { title: 'tittel', agenda: 'agenda', transition: 'agenda ·' };

export function Overview({ open, deck, info, current, onGo, onClose }: Props) {
  const grid = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    grid.current?.querySelectorAll<HTMLButtonElement>('[data-testid="oversikt-lysbilde"]')[current]?.focus({ preventScroll: false });
  }, [open, current]);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const buttons = [...(grid.current?.querySelectorAll<HTMLButtonElement>('[data-testid="oversikt-lysbilde"]') ?? [])];
    const at = buttons.findIndex((b) => b === document.activeElement);
    const from = at === -1 ? current : at;
    let to: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'l':
        to = Math.min(buttons.length - 1, from + 1);
        break;
      case 'ArrowLeft':
      case 'h':
        to = Math.max(0, from - 1);
        break;
      case 'ArrowDown':
      case 'j':
        to = vertical(buttons, from, 1);
        break;
      case 'ArrowUp':
      case 'k':
        to = vertical(buttons, from, -1);
        break;
      case 'o':
        event.preventDefault();
        event.currentTarget.close();
        return;
      default:
        return;
    }
    event.preventDefault();
    buttons[to]?.focus();
  };

  return (
    <Modal open={open} onClose={onClose} label="Lysbildeoversikt" className="overview" onKeyDown={onKeyDown}>
      <div className="ov-head">
        <h2>Lysbildeoversikt</h2>
        <span className="sub">{deck.slides.length} lysbilder</span>
        <span className="ov-keys" aria-hidden="true">
          <span>
            <kbd className="k">←</kbd>
            <kbd className="k">→</kbd>
            <kbd className="k">↑</kbd>
            <kbd className="k">↓</kbd> velg
          </span>
          <span>
            <kbd className="k">↵</kbd> gå til
          </span>
          <span>
            <kbd className="k">Esc</kbd> lukk
          </span>
        </span>
      </div>
      <ul className="ov-grid" ref={grid}>
        {deck.slides.map((slide, i) => (
          <li key={slide.id}>
            <button
              type="button"
              className="ov-item"
              data-testid="oversikt-lysbilde"
              aria-current={i === current ? 'true' : undefined}
              aria-label={slide.label}
              tabIndex={i === current ? 0 : -1}
              onClick={() => {
                onGo(i);
                onClose();
              }}
            >
              <span className="thumb canvas" inert>
                <SlideView slide={slide} deck={info} mode="thumb" active />
              </span>
              <span className="cap" aria-hidden="true">
                <span className="no">{slide.number}</span>
                <span className="t">{slide.kind === 'content' ? slide.heading ?? info.title : slide.kind === 'title' ? info.title : (KIND_CAPTION[slide.kind] ?? '') + (slide.kind === 'transition' ? ` ${deck.agenda[slide.agendaIndex ?? 0]?.text ?? ''}` : '')}</span>
                {i === current ? <span className="now">NÅ</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
