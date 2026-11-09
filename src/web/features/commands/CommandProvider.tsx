import './commands.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { VaultId } from '../../../shared/api-types';
import { isImagePath } from '../../shared/api';
import { isApple } from '../../shared/ui/shortcuts';
import {
  LEADER_KEY,
  SEQUENCE_TIMEOUT_MS,
  WHICH_KEY_DELAY_MS,
  chordCandidates,
  createKeyEngine,
  effectiveKeyTarget,
  formatKeySequence,
  hasOpenModal,
  isSpaceActivationTarget,
  isTextEntryTarget,
  parseChord,
  type KeyEngine,
  type PendingSequence,
} from '../keyboard';
import { usePresentationControl } from '../presentation';
import { usePalette, type PaletteCommandItem, type PaletteCommandSource } from '../search';
import { PALETTES, PALETTE_INFO, TYPES, TYPE_INFO, useTheme } from '../theme';
import { useOutlineControl } from '../outline';
import { ZenHint, useViewSettings } from '../view-settings';
import { CommandsContext, type CommandsContextValue } from './commands-context';
import { createCommandHandlers } from './handlers';
import { COMMAND_CATALOG, type CommandId } from './model/catalog';
import type { CommandContext, CommandPorts, CommandRoute, PresentationPort, ViewSnapshot } from './model/command-context';
import { GROUP_LABELS, type CommandSpecBody } from './model/command-types';
import { commandPaletteOptions, paletteArgumentError, paletteArgumentHeading } from './model/palette-options';
import { createCommandRegistry } from './model/registry';
import { createScrollPort } from './scroll';
import { ShortcutHelp } from './ShortcutHelp';
import { WhichKey, type WhichKeyItem } from './WhichKey';

interface CommandProviderProps {
  readonly vaultId: VaultId;
  /** Gjeldende dokument ('' = vaultets forside). */
  readonly docPath: string;
  /** Åpner Utseende (eies av layouten). */
  readonly onOpenAppearance: () => void;
  readonly children: ReactNode;
}


const TOAST_MS = 4000;

/** Uten `PresentationProvider` (tester, forsiden): ingen presentasjon. */
const NO_PRESENTATION: PresentationPort = {
  active: false,
  slideLevel: null,
  storedLevel: null,
  transitions: true,
  overviewOpen: false,
  blackout: false,
  fullscreen: false,
  levels: () => [],
  start: () => {},
  next: () => {},
  previous: () => {},
  first: () => {},
  last: () => {},
  scroll: () => {},
  toggleOverview: () => {},
  toggleBlackout: () => {},
  setTransitions: () => {},
  toggleFullscreen: () => {},
  escape: () => false,
  stop: () => {},
};

/** Tidskonstanter leses fra tokens (`--leader-delay`, `--sequence-timeout`, designsystem §11.2). */
function cssMs(name: string, fallback: number): number {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const value = raw.endsWith('ms') ? parseFloat(raw) : raw.endsWith('s') ? parseFloat(raw) * 1000 : NaN;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function routeOf(vaultId: VaultId, docPath: string): CommandRoute {
  const kind = docPath === '' ? 'home' : docPath.toLowerCase().endsWith('.base') ? 'base' : isImagePath(docPath) || /\.pdf$/i.test(docPath) ? 'asset' : 'note';
  return { kind, vaultId, docPath: docPath === '' ? null : docPath };
}


/**
 * Kommandoregisteret i React (ADR-007): handlere + porter, én `keydown`-lytter på `window` (boblefase),
 * which-key, `?`-oversikten, toast, og kommandomodus i paletten. Monteres i `VaultLayout` innenfor
 * `SearchProvider`.
 */
export function CommandProvider({ vaultId, docPath, onOpenAppearance, children }: CommandProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const palette = usePalette();
  const theme = useTheme();
  const [platform] = useState<'apple' | 'other'>(() => (isApple() ? 'apple' : 'other'));
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, setPending] = useState<PendingSequence | null>(null);
  const [toast, setToast] = useState<{ readonly message: string; readonly keys: readonly string[]; readonly id: number } | null>(null);
  const viewSettings = useViewSettings();

  const registry = useMemo(() => createCommandRegistry(createCommandHandlers()), []);
  const scroll = useMemo(() => createScrollPort(), []);

  // BUG-014: en ny toast erstatter zen-hintet i varselsonen i stedet for å legge seg over det.
  const { dismissZenHint } = viewSettings;
  const showToast = useCallback(
    (message: string, keys: readonly string[] = []) => {
      dismissZenHint();
      setToast((t) => ({ message, keys, id: (t?.id ?? 0) + 1 }));
    },
    [dismissZenHint],
  );
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const { setPreferences, toggleMode, preferences, resolvedMode } = theme;
  const { toggleWidth, setZen, zen, width, toggleDiscreet, isDiscreet } = viewSettings;
  const outlineControl = useOutlineControl();
  const presentationControl = usePresentationControl();
  const presentation: PresentationPort = presentationControl ?? NO_PRESENTATION;
  const mode = presentation.active ? 'present' : 'normal';
  useEffect(() => {
    if (!presentationControl) return undefined;
    presentationControl.setNoticeHandler(showToast);
    return () => presentationControl.setNoticeHandler(null);
  }, [presentationControl, showToast]);
  const ports = useMemo<CommandPorts>(
    () => ({
      scroll,
      history: { back: () => void navigate(-1), forward: () => void navigate(1) },
      palette: { openSearch: palette.openSearch, openCommands: palette.openCommands },
      help: { openShortcuts: () => setHelpOpen(true) },
      appearance: { open: onOpenAppearance },
      theme: {
        resolvedMode,
        toggleMode,
        setMode: (mode) => setPreferences({ mode }),
        setType: (type) => {
          const match = TYPES.find((t) => t === type);
          if (match) setPreferences({ type: match });
        },
        setPalette: (value) => {
          const match = PALETTES.find((p) => p === value);
          if (match) setPreferences({ palette: match });
        },
        types: TYPES.map((t) => ({
          value: t,
          label: TYPE_INFO[t].name,
          description: TYPE_INFO[t].description,
          current: preferences.type === t,
          visual: { specimen: t === 'klartekst' ? 'Il1' : 'Aa' },
        })),
        palettes: PALETTES.map((p) => {
          const info = PALETTE_INFO[p];
          const swatch = info[resolvedMode];
          const recommended = info.recommendedFor === preferences.type ? ` · anbefalt for ${TYPE_INFO[info.recommendedFor].name}` : '';
          return {
            value: p,
            label: info.name,
            description: `${info.description}${recommended}`,
            current: preferences.palette === p,
            visual: { swatch: [swatch.bg, swatch.text, swatch.accent, swatch.accent2] },
          };
        }),
      },
      view: {
        toggleWidth: () => {
          const next = toggleWidth();
          showToast(next === 'full' ? 'Full bredde' : 'Leseoptimalisert bredde', ['Space', 'w']);
        },
        toggleDiscreet: () => {
          if (!docPath) return;
          const on = toggleDiscreet(vaultId, docPath);
          const none = (outlineControl?.noteEmbeds ?? 0) === 0 ? ' – ingen innebygde notater her ennå' : '';
          showToast(`Diskré embedding ${on ? 'på' : 'av'} for dette notatet${none}`, ['Space', 'd']);
        },
        toggleZen: () => setZen(!zen),
        exitZen: () => {
          if (!zen) return false;
          setZen(false);
          return true;
        },
      },
      outline: {
        toggleAtReadingPosition: () => {
          if (!outlineControl?.toggleAtReadingPosition()) showToast('Ingen seksjon her');
        },
        foldAll: () => {
          outlineControl?.foldAll();
          showToast('Alle seksjoner er foldet', ['z', 'R']);
        },
        unfoldAll: () => {
          outlineControl?.unfoldAll();
          showToast('Alle seksjoner er foldet ut', ['z', 'M']);
        },
      },
      presentation,
      toast: showToast,
    }),
    [presentation, scroll, navigate, palette.openSearch, palette.openCommands, onOpenAppearance, resolvedMode, toggleMode, setPreferences, preferences.type, preferences.palette, showToast, toggleWidth, setZen, zen, outlineControl, toggleDiscreet, vaultId, docPath],
  );

  const foldableHeadings = outlineControl?.foldableHeadings ?? 0;
  const noteEmbeds = outlineControl?.noteEmbeds ?? 0;
  const discreet = docPath ? isDiscreet(vaultId, docPath) : false;
  const view = useMemo<ViewSnapshot>(
    () => ({ width, discreet, zen, noteEmbeds, foldableHeadings }),
    [width, discreet, zen, noteEmbeds, foldableHeadings],
  );
  const ctx = useMemo<CommandContext>(() => ({ mode, route: routeOf(vaultId, docPath), view, ports }), [mode, vaultId, docPath, view, ports]);
  const ctxRef = useRef(ctx);
  useLayoutEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  /** Kjører en kommando; deaktivert ⇒ begrunnelsen som toast (AR-1.1-02). */
  const execute = useCallback(
    (id: CommandId, args: Readonly<Record<string, string>> = {}, from: 'key' | 'palette' = 'key') => {
      const current = ctxRef.current;
      const command = registry.get(id);
      const availability = command.isEnabled(current);
      if (!availability.enabled) {
        // Fra paletten sto kommandonavnet allerede på raden; da holder begrunnelsen.
        current.ports.toast(from === 'palette' ? availability.reason : `${command.name}: ${availability.reason}`);
        return;
      }
      void command.run(current, args);
    },
    [registry],
  );

  // ---------------------------------------------------------------- tastaturmotoren
  const engineRef = useRef<KeyEngine | null>(null);
  useEffect(() => {
    const engine = createKeyEngine({
      keymap: registry.keymap(),
      timers: { setTimeout: (cb, ms) => window.setTimeout(cb, ms), clearTimeout: (h) => window.clearTimeout(h as number) },
      onCommand: (id) => execute(id as CommandId),
      onStateChange: (state) => setPending(state.pending),
      sequenceTimeoutMs: cssMs('--sequence-timeout', SEQUENCE_TIMEOUT_MS),
      whichKeyDelayMs: cssMs('--leader-delay', WHICH_KEY_DELAY_MS),
      initialMode: ctxRef.current.mode,
    });
    engineRef.current = engine;

    // AR-1.1-10: defaultPrevented → modal → tekstfelt → Space på aktiverbart element → motor.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (hasOpenModal(document)) {
        engine.cancel();
        return;
      }
      const candidates = chordCandidates(event);
      if (candidates.length === 0) return;
      // PO-81: tast rett etter at en dialog er lukket med Esc virker med en gang (fokus kan henge igjen i den).
      const target = effectiveKeyTarget(event.target);
      const typing = isTextEntryTarget(target);
      if (!typing && candidates[0] === LEADER_KEY && isSpaceActivationTarget(target)) {
        engine.cancel();
        return;
      }
      const result = engine.handle(candidates, { repeat: event.repeat, typing });
      if (result.kind !== 'unhandled') event.preventDefault();
    };
    const cancel = () => engine.cancel();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', cancel);
      engine.dispose();
      engineRef.current = null;
    };
  }, [registry, execute]);

  // P3 / ADR-010 §3: present-modus mens presentasjonen vises.
  // Layout-effekt: modusen byttes i samme commit som presentasjonen vises, før neste tast.
  useLayoutEffect(() => {
    engineRef.current?.setMode(mode);
  }, [mode]);

  // Navigasjon avbryter en påbegynt sekvens.
  useEffect(() => {
    engineRef.current?.cancel();
  }, [location.pathname]);

  // Klikk lukker which-key.
  const showHints = pending?.showHints ?? false;
  useEffect(() => {
    if (!showHints) return undefined;
    const onPointer = () => engineRef.current?.cancel();
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [showHints]);

  const whichKeyItems = useMemo<WhichKeyItem[]>(() => {
    if (!pending?.showHints) return [];
    return pending.continuations.map(({ chord, commandId }) => {
      const spec: CommandSpecBody = COMMAND_CATALOG[commandId as CommandId];
      const availability = registry.get(commandId as CommandId).isEnabled(ctx);
      return {
        chord: formatKeySequence([parseChord(chord)], platform),
        hint: spec.hint ?? spec.aliases[0] ?? spec.name,
        name: spec.name,
        state: registry.get(commandId as CommandId).state(ctx),
        enabled: availability.enabled,
        reason: availability.enabled ? null : availability.reason,
      };
    });
  }, [pending, registry, ctx, platform]);

  // ---------------------------------------------------------------- kommandomodus i paletten
  const source = useMemo<PaletteCommandSource>(
    () => ({
      count: registry.commands.filter((c) => c.inPalette !== false).length,
      options: (query) => {
        const grouped = query.trim() === '';
        const items = commandPaletteOptions(registry.commands, ctxRef.current, query, platform).map<PaletteCommandItem>((option) =>
          option.kind === 'command'
            ? {
                key: option.commandId,
                commandId: option.commandId,
                kind: 'command',
                label: option.name,
                highlights: option.highlights,
                ex: option.ex,
                exHighlights: option.exHighlights,
                argumentLabel: option.argumentLabel,
                state: option.state,
                detail: option.description,
                visual: null,
                shortcut: option.shortcut,
                enabled: option.enabled,
                reason: option.reason,
                current: false,
                group: grouped ? GROUP_LABELS[option.group] : null,
                completion: option.completion,
                fill: option.completion ?? option.ex,
                args: {},
              }
            : {
                key: `${option.commandId}:${option.value.value}`,
                commandId: option.commandId,
                kind: 'argument',
                label: option.value.label,
                highlights: option.highlights,
                ex: option.ex,
                exHighlights: [],
                argumentLabel: option.argumentLabel,
                state: null,
                detail: option.value.description ?? null,
                visual: option.value.visual ?? null,
                shortcut: null,
                enabled: option.enabled,
                reason: option.reason,
                current: option.current,
                group: option.commandName,
                completion: null,
                fill: `${option.ex} ${option.value.value}`,
                args: { [option.argument]: option.value.value },
              },
        );
        const error = items.length === 0 ? paletteArgumentError(registry.commands, ctxRef.current, query) : null;
        return { items, argument: paletteArgumentHeading(registry.commands, query), error };
      },
      run: (item) => execute(item.commandId as CommandId, item.args, 'palette'),
    }),
    [registry, platform, execute],
  );

  const { setCommandSource } = palette;
  useEffect(() => {
    setCommandSource(source);
    return () => setCommandSource(null);
  }, [setCommandSource, source]);

  const value = useMemo<CommandsContextValue>(
    () => ({
      openShortcuts: () => setHelpOpen(true),
      run: (id) => execute(id),
      availability: (id) => registry.get(id).isEnabled(ctx),
    }),
    [execute, registry, ctx],
  );

  return (
    <CommandsContext.Provider value={value}>
      {children}
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} platform={platform} mode={mode} />
      {pending ? (
        // showcmd (vim): påbegynt sekvens vises med en gang; kun visuelt.
        <div className="showcmd" aria-hidden="true">
          {pending.chords.map((chord) => (chord === LEADER_KEY ? '␣' : formatKeySequence([parseChord(chord)], platform))).join('')}
        </div>
      ) : null}
      {/* BUG-014: én felles varselsone nederst – toasts øverst, zen-hint, which-key alltid nederst. */}
      <div className="notice-zone">
        <div className="command-toast" role="status" aria-live="polite">
          {toast ? (
            <div className="toast" key={toast.id}>
              {toast.message}
              {toast.keys.length > 0 ? (
                <span className="keys-inline" aria-hidden="true">
                  {toast.keys.map((k, i) => (
                    <kbd key={i} className={k === 'Space' ? 'k lead' : 'k'}>
                      {k}
                    </kbd>
                  ))}
                </span>
              ) : null}
              <button type="button" className="icon-btn" aria-label="Lukk melding" onClick={() => setToast(null)}>
                ×
              </button>
            </div>
          ) : null}
        </div>
        <ZenHint />
        {showHints ? <WhichKey leader={formatKeySequence([parseChord(LEADER_KEY)], platform)} items={whichKeyItems} /> : null}
      </div>
    </CommandsContext.Provider>
  );
}
