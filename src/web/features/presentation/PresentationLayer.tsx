// Presentasjonslaget (ADR-010 §6): overlegg på notatets rute når `?lysbilde` finnes. Lerret (16:9, letterbox),
// gjeldende lysbilde ± naboene montert, krom (agendalinje, folio, fremdrift), kontroller, oversikt, svart skjerm,
// skjermleserkunngjøring og målelerret.

import './presentation.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { AgendaLine } from './AgendaLine';
import { CANVAS } from './fit/canvas';
import { MeasureCanvas } from './fit/MeasureCanvas';
import { agendaStartNumbers, agendaSubtitles, type Slide, type SlideDeck } from '../../../core/presentation';
import { Overview } from './Overview';
import { usePresentationControl, usePresentationView } from './presentation-context';
import { SlideView, type DeckInfo } from './SlideView';

/** Skalaen som får 1920 × 1080 til å passe i flaten (letterbox). */
export function stageScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(width / CANVAS.width, height / CANVAS.height);
}

/** Fremdrift i segmenter: ett per agendaseksjon; tittel/agenda/innledning er første segment (designsystem §12.6). */
function progressSegments(deck: SlideDeck): Array<{ readonly size: number; readonly start: number }> {
  const segs: Array<{ size: number; start: number }> = [];
  let last: number | null | undefined;
  deck.slides.forEach((s, i) => {
    const seg = s.kind === 'transition' || (s.agendaIndex !== null && s.agendaIndex !== last) ? s.agendaIndex : last;
    if (segs.length === 0 || seg !== last) segs.push({ size: 0, start: i });
    (segs[segs.length - 1] as { size: number }).size += 1;
    last = seg;
  });
  return segs;
}

const IDLE_MS = 1800;

function scrollTargetIn(unit: HTMLElement): HTMLElement {
  return unit.querySelector<HTMLElement>('pre, .table-wrap, .tabpanel, .kanban') ?? unit;
}

/** Rullehint og kantmaske for blokker med intern rulling (designsystem §12.7.4, PO-97). */
function useScrollHints(slideEl: HTMLElement | null, slideId: string | null) {
  useEffect(() => {
    if (!slideEl) return undefined;
    const cleanups: Array<() => void> = [];
    for (const unit of slideEl.querySelectorAll<HTMLElement>('.slide-unit.is-scroller')) {
      const target = scrollTargetIn(unit);
      if (target.tabIndex < 0) target.tabIndex = 0;
      if (!target.getAttribute('aria-label') && !target.getAttribute('role')) {
        target.setAttribute('role', 'region');
        target.setAttribute('aria-label', 'Blokk med intern rulling');
      }
      const update = () => {
        const line = parseFloat(getComputedStyle(target).lineHeight) || 40;
        const rest = Math.max(0, target.scrollHeight - target.clientHeight - target.scrollTop);
        const total = Math.round(target.scrollHeight / line);
        const lines = Math.ceil(rest / line);
        unit.classList.toggle('at-end', rest <= 1);
        unit.dataset.hint = rest <= 1 ? `Slutt · ${total} linjer` : `↓ ${lines} linjer til · ↑ ↓ ruller`;
      };
      update();
      target.addEventListener('scroll', update, { passive: true });
      cleanups.push(() => target.removeEventListener('scroll', update));
    }
    return () => cleanups.forEach((c) => c());
  }, [slideEl, slideId]);
}

export function PresentationLayer() {
  const view = usePresentationView();
  const control = usePresentationControl();
  const stageRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pointer, setPointer] = useState(false);
  const [slideEl, setSlideEl] = useState<HTMLElement | null>(null);

  const deck = view?.deck ?? null;
  const index = view?.index ?? 0;
  const slide: Slide | null = deck?.slides[index] ?? null;

  const drafts = view?.drafts ?? null;
  const doc = view?.doc ?? null;
  const vaultId = view?.vaultId ?? '';
  const bases = view?.bases ?? null;
  const subtitles = useMemo(() => (drafts ? agendaSubtitles(drafts) : []), [drafts]);
  // Stabil så lenge kortstokken er den samme: lysbildene rendres ikke på nytt ved hvert bytte (AK-2-13).
  const info = useMemo<DeckInfo | null>(() => {
    if (!drafts || !doc || !bases) return null;
    return {
      vaultId,
      doc,
      bases,
      title: drafts.title,
      agenda: deck?.agenda ?? drafts.agenda,
      subtitles,
      startNumbers: deck ? agendaStartNumbers(deck) : [],
      total: deck?.slides.length ?? 0,
    };
  }, [vaultId, doc, bases, drafts, deck, subtitles]);

  // Letterbox: lerretet skaleres som helhet; ingen ny måling ved resize (ADR-010 §2).
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => {
      const k = stageScale(el.clientWidth, el.clientHeight);
      setScale(k);
      // Varselsonen (toast) legges over lysbildets bunnlinje (folio, fremdrift), ikke oppå den.
      // Lerretet er sentrert i scenen (letterbox).
      const stage = el.getBoundingClientRect();
      const bottom = stage.top + (stage.height + CANVAS.height * k) / 2;
      const root = document.documentElement.style;
      root.setProperty('--present-scale', String(k));
      root.setProperty('--present-bottom-gap', `${Math.max(0, window.innerHeight - bottom)}px`);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--present-scale');
      document.documentElement.style.removeProperty('--present-bottom-gap');
    };
  }, [view !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fokus i presentasjonen ved start og etter bytte (Space skal ikke aktivere en knapp i et skjult lysbilde).
  const slideId = slide?.id ?? null;
  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const active = document.activeElement;
    if (!active || active === document.body || !region.contains(active) || active.closest('[hidden]')) region.focus({ preventScroll: true });
  }, [slideId]);

  useScrollHints(slideEl, slideId);

  // Toasten skal ikke dekke bunnlinjen: på tittellysbildet ligger den under «Endret …» (ingen folio der, PO-95),
  // ellers over folio og fremdrift (se presentation.css).
  const onTitle = slide?.kind === 'title';
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--present-toast-lift', onTitle ? '0' : '112');
    return () => {
      root.removeProperty('--present-toast-lift');
    };
  }, [onTitle]);

  // ↑/↓ ruller blokken på gjeldende lysbilde (PO-94).
  const scrollN = view?.scrollRequest.n ?? 0;
  const scrollDir = view?.scrollRequest.direction ?? 1;
  useEffect(() => {
    if (scrollN === 0 || !slideEl) return;
    const unit = slideEl.querySelector<HTMLElement>('.slide-unit.is-scroller');
    if (!unit) return;
    const target = scrollTargetIn(unit);
    const line = parseFloat(getComputedStyle(target).lineHeight) || 40;
    target.scrollBy({ top: scrollDir * line * 3, behavior: 'auto' });
  }, [scrollN, scrollDir, slideEl]);

  // Musekontroller vises ved bevegelse og skjules (med pekeren) etter 1,8 s.
  useEffect(() => {
    if (!pointer) return undefined;
    const t = setTimeout(() => setPointer(false), IDLE_MS);
    return () => clearTimeout(t);
  }, [pointer]);

  // Touch (designsystem §12.2): sveip ≥ 50 px, eller trykk på venstre tredjedel (forrige) / resten (neste).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') touch.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const start = touch.current;
      touch.current = null;
      if (e.pointerType !== 'touch' || !start || !control) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) control.next();
        else control.previous();
        return;
      }
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
      const target = e.target as Element;
      if (target.closest('a, button, input, summary, [role="tab"], [tabindex]:not([tabindex="-1"]), .is-scroller')) return;
      const box = e.currentTarget.getBoundingClientRect();
      if (e.clientX - box.left < box.width / 3) control.previous();
      else control.next();
    },
    [control],
  );

  if (!view || !info) return null;
  const kind = slide?.kind ?? 'title';
  const showLine = slide !== null && slide.kind === 'content' && slide.heading !== null && info.agenda.length > 0;
  const announcement = view.blackout ? 'Svart skjerm. Trykk b eller punktum for å fortsette.' : (slide?.label ?? '');
  // Gjeldende lysbilde først i DOM-en, naboene (forhåndsmontert, skjult) etter (ADR-010 §2).
  const mounted = deck ? [index, index - 1, index + 1].flatMap((i) => (deck.slides[i] ? [deck.slides[i]] : [])) : [];

  return (
    <div
      className={pointer ? 'present is-pointer' : 'present'}
      role="region"
      aria-label="Presentasjon"
      aria-roledescription="lysbildeserie"
      data-kind={kind}
      data-blackout={view.blackout ? '' : undefined}
      tabIndex={-1}
      ref={regionRef}
      onMouseMove={() => setPointer(true)}
    >
      {kind !== 'title' ? <h1 className="sr-only">{info.title}</h1> : null}
      <div className="m-top">
        <span className="ttl">{info.title}</span>
        <button type="button" className="m-btn" aria-label="Avslutt presentasjon" onClick={() => control?.stop()}>
          ✕
        </button>
      </div>
      <div className="stage" ref={stageRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className="canvas-box" data-testid="lerret" style={{ '--stage-scale': String(scale) } as CSSProperties}>
          <div className="canvas">
            {showLine && slide ? <AgendaLine agenda={info.agenda} current={slide.agendaIndex} progress={slide.progress} /> : null}
            {mounted.map((s) => (
              <div key={s.id} className={s === slide ? 'slide-frame is-active' : 'slide-frame'} ref={s === slide ? setSlideEl : undefined} hidden={s !== slide}>
                <SlideView slide={s} deck={info} mode="view" active={s === slide} />
              </div>
            ))}
            {deck ? (
              <>
                <div className="slide-foot">
                  <span className="foot-title">{info.title}</span>
                  <span className="folio" data-testid="lysbildenummer">
                    <b>{index + 1}</b> / {deck.slides.length}
                  </span>
                </div>
                <div className="progress" role="progressbar" aria-label="Fremdrift" aria-valuemin={1} aria-valuenow={index + 1} aria-valuemax={deck.slides.length}>
                  {progressSegments(deck).map((seg) => {
                    const done = Math.max(0, Math.min(seg.size, index + 1 - seg.start));
                    return (
                      <span key={seg.start} className="seg" style={{ '--n': String(seg.size) } as CSSProperties} aria-hidden="true">
                        <span className="fill" style={{ width: `${(done / seg.size) * 100}%` }} />
                      </span>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-ctrl">
        <button type="button" className="p-btn" onClick={() => control?.toggleOverview()}>
          Oversikt <kbd className="k">o</kbd>
        </button>
        <button type="button" className="p-btn" aria-label="Avslutt presentasjon" onClick={() => control?.stop()}>
          Avslutt <kbd className="k">Esc</kbd>
        </button>
      </div>
      <div className="m-bar">
        <button type="button" className="m-btn" aria-label="Forrige lysbilde" onClick={() => control?.previous()}>
          ‹
        </button>
        <span className="folio-m" aria-hidden="true">
          {deck ? `${index + 1} / ${deck.slides.length}` : ''}
        </span>
        <button type="button" className="m-btn" onClick={() => control?.toggleOverview()}>
          Oversikt
        </button>
        <button type="button" className="m-btn" aria-label="Neste lysbilde" onClick={() => control?.next()}>
          Neste ›
        </button>
      </div>
      <p className="m-hint">Snu telefonen for større visning</p>
      <div className={view.blackout ? 'blackout is-on' : 'blackout'} data-testid="svart-skjerm" aria-hidden="true" />
      <div className="sr-only" role="status" aria-live="polite" data-testid="lysbilde-kunngjoring">
        {announcement}
      </div>
      {deck ? <Overview open={view.overviewOpen} deck={deck} info={info} current={index} onGo={view.go} onClose={view.closeOverview} /> : null}
      <MeasureCanvas requests={view.measure} deck={info} onMeasured={view.onMeasured} />
    </div>
  );
}
