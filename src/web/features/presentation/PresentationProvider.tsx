// Presentasjonens tilstand (ADR-010 §3–§5): økt, kortstokk, posisjon, URL, fullskjerm, lagret nivå og live reload.
// Monteres i `VaultLayout` over `CommandProvider`. Visningen (`PresentationLayer`) leser `PresentationViewContext`.
//
// Økten avledes under render (forrige kortstokk → ny posisjon med `resolveSlide`), og kontrollen leser siste tilstand
// via en ref i hendelser. React Compiler kan da ikke bevare memoiseringen; vi bruker den ikke (bygget er uten
// kompilator), så regelen er slått av for denne fila.
/* eslint-disable react-hooks/preserve-manual-memoization */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { DocumentResponse, NoteDocument } from '../../../shared/api-types';
import { isImagePath, isNotFound, queryKeys, useDocument } from '../../shared/api';
import { safeLocalStorage } from '../../shared/storage';
import { buildOutline, headingAtReadingPosition, READING_LINE } from '../outline';
import { prepareContent, splitLeadingTitle } from '../note-view';
import { ingressOf } from '../properties';
import { useTheme } from '../theme';
import { createFitCache } from './fit/fit-cache';
import { baseIdsIn, cyrb53 } from './fit/fingerprint';
import { LAYOUT_VERSION } from './fit/layout-version';
import {
  agendaSubtitles,
  buildSlideDrafts,
  finalizeDeck,
  fromOutline,
  headingForSlide,
  resolveSlide,
  slideForHeading,
  type DraftFit,
  type HeadingLevel,
  type SlideDeck,
  type SlideDraft,
  type SlideDraftDeck,
} from './model';
import { PresentationControlContext, PresentationViewContext, type MeasureRequest, type PresentationView } from './presentation-context';
import type { LevelInfo, NoticeHandler, PresentationControl } from './presentation-control';
import { levelIn, presentationKey, readLevels, setLevelIn, writeLevels } from './presentation-storage';
import { slideParam, withSlideParam } from './presentation-url';
import { enterPresentationFullscreen, exitPresentationFullscreen, isPresentationFullscreen } from './fullscreen';

interface Session {
  readonly key: string;
  readonly level: HeadingLevel | null;
  readonly transitions: boolean;
  readonly overviewOpen: boolean;
  readonly blackout: boolean;
  /** Gjeldende lysbilde (sannheten under økten); `null` = start ved leseposisjonen. */
  readonly currentId: string | null;
  /** Overskriften ved leseposisjonen da presentasjonen ble startet med `Space p`/`:presenter`. */
  readonly startHeading: string | null;
  /** Rulleposisjonen ved start (Esc uten navigasjon: samme sted). */
  readonly startScroll: number | null;
  /** Startet med `present.start` i denne økten (ellers: reload, dyplenke eller Frem). */
  readonly started: boolean;
}

interface PendingStart {
  readonly key: string;
  readonly heading: string | null;
  readonly scroll: number;
}

interface PendingStop {
  readonly heading: string | null;
  readonly scroll: number | null;
  readonly title: string | null;
}

const HINT_KEY = 'vault-leser.presentasjon.hint';
const HINT_TIMES = 3;

function isNoteRoute(docPath: string): boolean {
  return docPath !== '' && !docPath.toLowerCase().endsWith('.base') && !isImagePath(docPath) && !/\.pdf$/i.test(docPath);
}

function readStored(vaultId: string, docPath: string): HeadingLevel | null {
  return levelIn(readLevels(safeLocalStorage()), presentationKey(vaultId, docPath));
}

function writeStored(vaultId: string, docPath: string, level: HeadingLevel | null): void {
  const storage = safeLocalStorage();
  writeLevels(storage, setLevelIn(readLevels(storage), presentationKey(vaultId, docPath), level));
}

function bumpHint(): boolean {
  try {
    const storage = safeLocalStorage();
    const n = Number(storage?.getItem(HINT_KEY) ?? '0') || 0;
    if (n >= HINT_TIMES) return false;
    storage?.setItem(HINT_KEY, String(n + 1));
    return true;
  } catch {
    return false;
  }
}

/** Overskrift-id-ene i lesevisningen, i dokumentrekkefølge (samme leselinje som `za`/TOC, PO-53). */
function readingHeading(): string | null {
  // Øverst i notatet (ikke rullet): start på tittellysbildet, selv om første overskrift står høyt på siden.
  if (window.scrollY < 1) return null;
  const headings = [...document.querySelectorAll<HTMLElement>('#innhold .prose :is(h1, h2, h3, h4, h5, h6)[id]')];
  // Nederst på siden kan siste seksjon ikke nå leselinjen: da gjelder siste overskrift som er synlig i øvre del.
  const root = document.documentElement;
  if (window.scrollY + window.innerHeight >= root.scrollHeight - 2) {
    const visible = headings.filter((h) => h.getBoundingClientRect().top < window.innerHeight * BOTTOM_READING_LINE);
    const last = visible[visible.length - 1];
    if (last) return last.id;
  }
  return headingAtReadingPosition(headings.map((h) => h.id));
}

/** Leselinjen når siden er rullet helt ned (siste seksjon kan ikke komme høyere). */
const BOTTOM_READING_LINE = 0.75;

/** Gir lesevisningen plass under siste seksjon, så overskriften kan stå ved leselinjen etter avslutning (PO-87). */
function makeRoomBelow(el: HTMLElement): void {
  const main = document.getElementById('innhold');
  if (!main) return;
  const needed = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.18 + window.innerHeight - document.documentElement.scrollHeight;
  if (needed > 0) {
    main.style.paddingBottom = `${Math.ceil(needed) + 8}px`;
    main.setAttribute('data-present-room', '');
  }
}

interface Prepared {
  readonly doc: NoteDocument;
  readonly title: string;
  readonly source: ReturnType<typeof fromOutline>;
}

const preparedCache = new WeakMap<NoteDocument, Prepared>();

/** Dokument → disposisjon med diskré embedding alltid på (S1) → modellens kilde. Memoisert per dokumentobjekt. */
function prepare(doc: NoteDocument): Prepared {
  const hit = preparedCache.get(doc);
  if (hit) return hit;
  const display = splitLeadingTitle(doc);
  const outline = buildOutline(prepareContent(display.content), display.toc, true);
  const prepared = { doc, title: display.title, source: fromOutline(outline, display.title) };
  preparedCache.set(doc, prepared);
  return prepared;
}

/** Cachenøkkel for et utkast (AR-2-12): innhold + det som påvirker layout. Palett og lys/mørk er ikke med. */
function draftKey(draft: SlideDraft, deck: SlideDraftDeck, subtitles: readonly string[][], doc: NoteDocument, typeset: string): string {
  let context: unknown = null;
  if (draft.kind === 'agenda' || draft.kind === 'transition') context = { agenda: deck.agenda.map((a) => a.text), subtitles };
  if (draft.preamble || draft.kind === 'title') context = { title: deck.title, ingress: ingressOf(doc.properties), properties: doc.properties, aliases: doc.aliases, path: doc.path, mtime: doc.mtime };
  const bases = draft.units.flatMap((u) => baseIdsIn(u.node)).map((id) => doc.bases[id] ?? null);
  const content = JSON.stringify([draft.kind, draft.address.agenda, draft.heading, draft.continued, draft.units, bases, context]);
  return `${LAYOUT_VERSION}|${typeset}|${cyrb53(content)}`;
}

export function PresentationProvider({ vaultId, docPath, children }: { readonly vaultId: string; readonly docPath: string; readonly children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { preferences } = useTheme();
  const typeset = preferences.type;
  const isNote = isNoteRoute(docPath);
  const param = isNote ? slideParam(location.search) : null;
  const docKey = `${vaultId}\n${docPath}`;

  const query = useDocument(vaultId, docPath, param !== null);
  const doc = query.data?.kind === 'note' && query.data.path === docPath ? query.data : null;
  const notFound = query.isError && isNotFound(query.error);
  const active = param !== null && !notFound;

  // ------------------------------------------------------------------ økten
  const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  let current = session;
  if (active && (!session || session.key !== docKey)) {
    const pending = pendingStart?.key === docKey ? pendingStart : null;
    current = {
      key: docKey,
      level: readStored(vaultId, docPath),
      transitions: true,
      overviewOpen: false,
      blackout: false,
      currentId: param === '' ? null : param,
      startHeading: pending?.heading ?? null,
      startScroll: pending?.scroll ?? null,
      started: pending !== null,
    };
    setSession(current);
    if (pending) setPendingStart(null);
  } else if (!active && session) {
    current = null;
    setSession(null);
  }
  const [storedVersion, setStoredVersion] = useState(0);
  const storedLevel = useMemo(() => {
    void storedVersion; // leser lagringen på nytt etter `:presenter h<n>`
    return isNote ? readStored(vaultId, docPath) : null;
  }, [vaultId, docPath, isNote, storedVersion]);

  // ------------------------------------------------------------------ kortstokken
  const prepared = useMemo(() => (active && doc ? prepare(doc) : null), [active, doc]);
  const level = current?.level ?? null;
  const drafts = useMemo(() => (prepared ? buildSlideDrafts(prepared.source, { slideLevel: level }) : null), [prepared, level]);
  const subtitles = useMemo(() => (drafts ? agendaSubtitles(drafts) : []), [drafts]);
  const [cache] = useState(() => createFitCache());
  const [fitVersion, setFitVersion] = useState(0);
  const keys = useMemo(
    () => (drafts && doc ? drafts.drafts.map((d) => draftKey(d, drafts, subtitles, doc, typeset)) : []),
    [drafts, subtitles, doc, typeset],
  );
  const { fits, measure } = useMemo(() => {
    void fitVersion; // nye måleresultater i cachen
    const out: Record<string, DraftFit> = {};
    const missing: MeasureRequest[] = [];
    drafts?.drafts.forEach((d, i) => {
      const key = keys[i] as string;
      const hit = cache.get({ content: key, typeset, layoutVersion: LAYOUT_VERSION });
      if (hit) out[d.baseId] = hit;
      else missing.push({ draft: d, key });
    });
    return { fits: out, measure: missing };
  }, [drafts, keys, typeset, fitVersion, cache]);
  const transitions = current?.transitions ?? true;
  const freshDeck = useMemo<SlideDeck | null>(
    () => (drafts && measure.length === 0 ? finalizeDeck(drafts, { drafts: fits, compactAgendaLine: false, complete: true }, { transitions }) : null),
    [drafts, fits, measure.length, transitions],
  );

  // Dobbel buffer: forrige kortstokk vises til den nye er målt (live reload, typesett-bytte). Ny kortstokk ⇒
  // posisjonen finnes igjen med `resolveSlide` mot den forrige (ADR-010 §5).
  const [shown, setShown] = useState<{ readonly key: string; readonly deck: SlideDeck } | null>(null);
  if (freshDeck && shown?.deck !== freshDeck) {
    if (current && current.currentId !== null && shown?.key === docKey) {
      const r = resolveSlide(freshDeck.slides, current.currentId, shown.deck.slides);
      const id = freshDeck.slides[r.index]?.id ?? null;
      if (id !== current.currentId) {
        current = { ...current, currentId: id };
        setSession(current);
      }
    }
    setShown({ key: docKey, deck: freshDeck });
  }
  const deck = active && current ? (freshDeck ?? (shown?.key === docKey ? shown.deck : null)) : null;

  // ------------------------------------------------------------------ posisjon
  let index = 0;
  if (deck && current) {
    index = current.currentId === null ? slideForHeading(deck, current.startHeading) : Math.max(0, resolveSlide(deck.slides, current.currentId, []).index);
    const id = deck.slides[index]?.id ?? null;
    if (id !== null && id !== current.currentId) {
      current = { ...current, currentId: id };
      setSession(current);
    }
  }
  const resolvedId = deck?.slides[index]?.id ?? null;

  const onMeasured = useCallback<PresentationView['onMeasured']>(
    (results) => {
      for (const { key, fit } of results) cache.set({ content: key, typeset: key.split('|')[1] ?? '', layoutVersion: LAYOUT_VERSION }, fit);
      setFitVersion((v) => v + 1);
    },
    [cache],
  );

  // `document.fonts` `loadingdone`: fontmetrikken kan ha endret seg – mål alt på nytt (AR-2-12).
  useEffect(() => {
    if (!active || typeof document.fonts?.addEventListener !== 'function') return undefined;
    const onDone = () => {
      cache.clear();
      setFitVersion((v) => v + 1);
    };
    document.fonts.addEventListener('loadingdone', onDone);
    return () => document.fonts.removeEventListener('loadingdone', onDone);
  }, [active, cache]);

  // Gjeldende id inn i URL-en (replace, etter visning; Tilbake avslutter, ADR-010 §4).
  useEffect(() => {
    if (!active || !resolvedId || param === resolvedId) return;
    void navigate({ pathname: location.pathname, search: withSlideParam(location.search, resolvedId), hash: location.hash }, { replace: true, state: location.state });
  }, [active, resolvedId, param, location, navigate]);

  // ------------------------------------------------------------------ varsler
  const noticeRef = useRef<NoticeHandler | null>(null);
  const notify = useCallback((message: string, keys?: readonly string[]) => noticeRef.current?.(message, keys), []);

  // ------------------------------------------------------------------ fullskjerm
  const [fullscreen, setFullscreen] = useState(false);
  const exitingFullscreen = useRef(false);
  const stateRef = useRef<{ session: Session | null; deck: SlideDeck | null; index: number; active: boolean }>({ session: null, deck: null, index: 0, active: false });
  useLayoutEffect(() => {
    stateRef.current = { session: current, deck, index, active };
  });

  useEffect(() => {
    if (!active) return undefined;
    const onChange = () => {
      const on = isPresentationFullscreen();
      setFullscreen(on);
      if (on) return;
      if (exitingFullscreen.current) {
        exitingFullscreen.current = false;
        return;
      }
      // PO-92: nettleseren tok Esc (eller F11). Presentasjonen fortsetter; oversikten lukkes.
      setSession((s) => (s ? { ...s, overviewOpen: false } : s));
      notify('Fullskjerm av – Esc igjen avslutter presentasjonen. f slår fullskjerm på.', ['Esc', 'f']);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [active, notify]);

  const requestFullscreen = useCallback(() => {
    if (!document.fullscreenEnabled) return;
    void enterPresentationFullscreen().then((outcome) => {
      if (outcome === 'denied') notify('Fullskjerm ble ikke tillatt. Presentasjonen virker også i vindu.');
    });
  }, [notify]);

  // ------------------------------------------------------------------ start og slutt av økten
  const startedFor = useRef<string | null>(null);
  const pendingStop = useRef<PendingStop | null>(null);
  const restoreScrollMode = useRef<ScrollRestoration | null>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!active) {
      if (root.getAttribute('data-present') !== 'on') return;
      root.removeAttribute('data-present');
      for (const el of document.querySelectorAll('[data-present-inert]')) {
        el.removeAttribute('inert');
        el.removeAttribute('data-present-inert');
      }
      return;
    }
    root.setAttribute('data-present', 'on');
    for (const el of document.querySelectorAll('.app, .topbar, .skip-link')) {
      if (!el.hasAttribute('inert')) {
        el.setAttribute('inert', '');
        el.setAttribute('data-present-inert', '');
      }
    }
  });

  // Etter avslutning: lesevisningen står ved seksjonen for gjeldende lysbilde (PO-87). Kjøres etter at
  // `useDocumentScroll` har sett navigasjonen (barnets layout-effekt kjører først).
  useLayoutEffect(() => {
    if (active || !pendingStop.current) return;
    const stop = pendingStop.current;
    pendingStop.current = null;
    if (restoreScrollMode.current) {
      const mode = restoreScrollMode.current;
      restoreScrollMode.current = null;
      requestAnimationFrame(() => {
        window.history.scrollRestoration = mode;
      });
    }
    if (stop.scroll !== null) window.scrollTo(0, stop.scroll);
    else if (stop.heading) {
      const el = document.getElementById(stop.heading);
      if (el) {
        const top = el.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * READING_LINE - 4) {
          makeRoomBelow(el);
          window.scrollTo(0, Math.max(0, top + window.scrollY - window.innerHeight * 0.18));
        }
      }
    } else window.scrollTo(0, 0);
    document.getElementById('innhold')?.focus({ preventScroll: true });
    notify(stop.title ? `Presentasjonen er avsluttet. Du står ved «${stop.title}». Space p starter herfra.` : 'Presentasjonen er avsluttet. Space p starter herfra.', ['Space', 'p']);
  });

  // Plassen under siste seksjon (PO-87) fjernes ved neste navigasjon.
  useEffect(() => {
    const main = document.getElementById('innhold');
    if (main?.hasAttribute('data-present-room')) {
      main.style.paddingBottom = '';
      main.removeAttribute('data-present-room');
    }
  }, [location.pathname]);

  // Ny økt: hint (de første gangene), toast etter reload (PO-88) og S7.
  useEffect(() => {
    if (!active || !current || !drafts) {
      if (!active) startedFor.current = null;
      return;
    }
    if (startedFor.current === current.key) return;
    startedFor.current = current.key;
    if (drafts.validLevels.length === 0) notify('Ingen overskrifter – lysbildene er delt på --- og der innholdet ikke får plass. Ingen agenda.');
    else if (!current.started && document.fullscreenEnabled) notify('Fullskjerm er av etter ny lasting – trykk f eller skriv :fullskjerm for å slå den på igjen.', ['f']);
    else if (current.started && bumpHint()) notify('Presentasjon: Esc avslutter · o oversikt · ? taster', ['Esc', 'o', '?']);
  }, [active, current, drafts, notify]);

  // Notatet slettes under presentasjon: lesevisningen viser «finnes ikke» (BUG-006), presentasjonen er borte.
  const wasActive = useRef(false);
  useEffect(() => {
    if (param !== null && notFound && wasActive.current) {
      void exitPresentationFullscreen();
      notify('Notatet finnes ikke lenger – presentasjonen er avsluttet.');
    }
    wasActive.current = active;
  }, [param, notFound, active, notify]);

  // Avslutning utenfra (Tilbake, lenke): gå ut av fullskjerm.
  useEffect(() => {
    if (active) return undefined;
    if (isPresentationFullscreen()) {
      exitingFullscreen.current = true;
      void exitPresentationFullscreen();
    }
    return undefined;
  }, [active]);

  // ------------------------------------------------------------------ kontrollen
  const [scrollRequest, setScrollRequest] = useState<PresentationView['scrollRequest']>({ direction: 1, n: 0 });

  const go = useCallback((target: number) => {
    const { deck: d } = stateRef.current;
    if (!d || d.slides.length === 0) return;
    const i = Math.max(0, Math.min(d.slides.length - 1, target));
    const id = d.slides[i]?.id ?? null;
    setSession((s) => (s ? { ...s, currentId: id, blackout: false, overviewOpen: false } : s));
  }, []);

  const step = useCallback(
    (delta: number) => {
      const { session: s, index: i } = stateRef.current;
      if (!s) return;
      if (s.blackout) {
        setSession((x) => (x ? { ...x, blackout: false } : x));
        return;
      }
      go(i + delta);
    },
    [go],
  );

  const stop = useCallback(() => {
    const { session: s, deck: d, index: i, active: on } = stateRef.current;
    if (!on || !s) return;
    // Esc uten å ha blatt: tilbake til nøyaktig samme rulleposisjon (AK-2-01).
    const unchanged = d !== null && s.started && s.startScroll !== null && slideForHeading(d, s.startHeading) === i;
    const heading = d ? headingForSlide(d, i, (id) => document.getElementById(id) !== null) : null;
    const title = heading ? (document.getElementById(heading)?.textContent?.replace(/#$/, '').trim() ?? null) : null;
    pendingStop.current = { heading, scroll: unchanged ? s.startScroll : null, title };
    if (isPresentationFullscreen()) {
      exitingFullscreen.current = true;
      void exitPresentationFullscreen();
    }
    const loc = window.location;
    // React Router legger `state` i `history.state.usr`.
    if ((window.history.state as { usr?: { presentationFrom?: boolean } } | null)?.usr?.presentationFrom) {
      // Nettleseren skal ikke gjenopprette rulleposisjonen fra starten: vi går til seksjonen for lysbildet (PO-87).
      restoreScrollMode.current = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
      void navigate(-1);
    }
    else void navigate({ pathname: loc.pathname, search: withSlideParam(loc.search, null), hash: loc.hash }, { replace: true });
  }, [navigate]);

  const levels = useCallback((): readonly LevelInfo[] => {
    const data = queryClient.getQueryData<DocumentResponse>(queryKeys.document(vaultId, docPath));
    if (data?.kind !== 'note') return [];
    const p = prepare(data);
    const auto = buildSlideDrafts(p.source, { slideLevel: null });
    return auto.validLevels.map((l) => {
      const d = buildSlideDrafts(p.source, { slideLevel: l });
      const count = finalizeDeck(d, { drafts: {}, compactAgendaLine: false, complete: false }, { transitions: true }).slides.length;
      return { level: l, agendaLevel: d.agendaLevel, slides: count };
    });
  }, [queryClient, vaultId, docPath]);

  const control = useMemo<PresentationControl>(
    () => ({
      active,
      slideLevel: drafts?.slideLevel ?? null,
      storedLevel,
      transitions,
      overviewOpen: current?.overviewOpen ?? false,
      blackout: current?.blackout ?? false,
      fullscreen,
      levels,
      start: (lvl) => {
        if (lvl !== undefined) {
          writeStored(vaultId, docPath, lvl === 'auto' ? null : lvl);
          setStoredVersion((v) => v + 1);
        }
        if (stateRef.current.active) {
          if (lvl !== undefined) setSession((s) => (s ? { ...s, level: lvl === 'auto' ? null : lvl } : s));
          return;
        }
        if (!isNote) return;
        // Synkront i brukergesten (ADR-010 §4): fullskjerm før navigasjonen.
        requestFullscreen();
        setPendingStart({ key: docKey, heading: readingHeading(), scroll: window.scrollY });
        const loc = window.location;
        void navigate({ pathname: loc.pathname, search: withSlideParam(loc.search, ''), hash: loc.hash }, { state: { presentationFrom: true } });
      },
      next: () => step(1),
      previous: () => step(-1),
      first: () => {
        if (!stateRef.current.session?.blackout) go(0);
      },
      last: () => {
        if (!stateRef.current.session?.blackout) go((stateRef.current.deck?.slides.length ?? 1) - 1);
      },
      scroll: (direction) => setScrollRequest((r) => ({ direction, n: r.n + 1 })),
      toggleOverview: () => {
        if (stateRef.current.session?.blackout) return;
        setSession((s) => (s ? { ...s, overviewOpen: !s.overviewOpen } : s));
      },
      toggleBlackout: () => setSession((s) => (s ? { ...s, blackout: !s.blackout, overviewOpen: false } : s)),
      setTransitions: (on) => setSession((s) => (s ? { ...s, transitions: on } : s)),
      toggleFullscreen: () => {
        if (isPresentationFullscreen()) {
          exitingFullscreen.current = true;
          void exitPresentationFullscreen();
        } else if (!document.fullscreenEnabled) notify('Fullskjerm er ikke tilgjengelig her. Presentasjonen virker også i vindu.');
        else requestFullscreen();
      },
      escape: () => {
        const s = stateRef.current.session;
        if (!stateRef.current.active || !s) return false;
        if (s.overviewOpen) setSession((x) => (x ? { ...x, overviewOpen: false } : x));
        else if (s.blackout) setSession((x) => (x ? { ...x, blackout: false } : x));
        else stop();
        return true;
      },
      stop,
      setNoticeHandler: (handler) => {
        noticeRef.current = handler;
      },
    }),
    [active, drafts?.slideLevel, storedLevel, transitions, current?.overviewOpen, current?.blackout, fullscreen, levels, vaultId, docPath, isNote, requestFullscreen, docKey, navigate, step, go, stop, notify],
  );

  const view = useMemo<PresentationView | null>(() => {
    if (!active || !doc || !drafts || !current) return null;
    return {
      vaultId,
      doc,
      bases: doc.bases,
      drafts,
      deck,
      index,
      overviewOpen: current.overviewOpen,
      blackout: current.blackout,
      measure,
      onMeasured,
      go,
      closeOverview: () => setSession((s) => (s ? { ...s, overviewOpen: false } : s)),
      scrollRequest,
    };
  }, [active, doc, drafts, current, vaultId, deck, index, measure, onMeasured, go, scrollRequest]);

  return (
    <PresentationControlContext.Provider value={control}>
      <PresentationViewContext.Provider value={view}>{children}</PresentationViewContext.Provider>
    </PresentationControlContext.Provider>
  );
}
