import './commands.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { VaultId } from '../../../shared/api-types';
import { isImagePath } from '../../shared/api';
import { isApple } from '../../shared/ui/shortcuts';
import {
  LEADER_KEY,
  chordCandidates,
  createKeyEngine,
  formatKeySequence,
  hasOpenModal,
  isSpaceActivationTarget,
  isTextEntryTarget,
  parseChord,
  type KeyEngine,
  type PendingSequence,
} from '../keyboard';
import { usePalette, type PaletteCommandItem, type PaletteCommandSource } from '../search';
import { PALETTES, PALETTE_INFO, TYPES, TYPE_INFO, useTheme } from '../theme';
import { CommandsContext, type CommandsContextValue } from './commands-context';
import { createCommandHandlers } from './handlers';
import { COMMAND_CATALOG, type CommandId } from './model/catalog';
import type { CommandContext, CommandPorts, CommandRoute, ViewSnapshot } from './model/command-context';
import { GROUP_LABELS, type CommandSpecBody } from './model/command-types';
import { commandPaletteOptions } from './model/palette-options';
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

/** Visningstilstand (ADR-008) kobles på i 1.1-b–d; til da er dette standardverdiene. */
const DEFAULT_VIEW: ViewSnapshot = { width: 'readable', discreet: false, zen: false, noteEmbeds: 0, foldableHeadings: 0 };

const TOAST_MS = 4000;

function routeOf(vaultId: VaultId, docPath: string): CommandRoute {
  const kind = docPath === '' ? 'home' : docPath.toLowerCase().endsWith('.base') ? 'base' : isImagePath(docPath) || /\.pdf$/i.test(docPath) ? 'asset' : 'note';
  return { kind, vaultId, docPath: docPath === '' ? null : docPath };
}

function noop(): void {}

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
  const [toast, setToast] = useState<{ readonly message: string; readonly id: number } | null>(null);

  const registry = useMemo(() => createCommandRegistry(createCommandHandlers()), []);
  const scroll = useMemo(() => createScrollPort(), []);

  const showToast = useCallback((message: string) => setToast((t) => ({ message, id: (t?.id ?? 0) + 1 })), []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const { setPreferences, toggleMode, preferences } = theme;
  const ports = useMemo<CommandPorts>(
    () => ({
      scroll,
      history: { back: () => void navigate(-1), forward: () => void navigate(1) },
      palette: { openSearch: palette.openSearch, openCommands: palette.openCommands },
      help: { openShortcuts: () => setHelpOpen(true) },
      appearance: { open: onOpenAppearance },
      theme: {
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
        types: TYPES.map((t) => ({ value: t, label: TYPE_INFO[t].name, description: TYPE_INFO[t].description, current: preferences.type === t })),
        palettes: PALETTES.map((p) => ({
          value: p,
          label: PALETTE_INFO[p].name,
          description: PALETTE_INFO[p].description,
          current: preferences.palette === p,
        })),
      },
      view: { toggleWidth: noop, toggleDiscreet: noop, toggleZen: noop, exitZen: () => false },
      outline: { toggleAtReadingPosition: noop, foldAll: noop, unfoldAll: noop },
      toast: showToast,
    }),
    [scroll, navigate, palette.openSearch, palette.openCommands, onOpenAppearance, toggleMode, setPreferences, preferences.type, preferences.palette, showToast],
  );

  const ctx = useMemo<CommandContext>(() => ({ mode: 'normal', route: routeOf(vaultId, docPath), view: DEFAULT_VIEW, ports }), [vaultId, docPath, ports]);
  const ctxRef = useRef(ctx);
  useLayoutEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  /** Kjører en kommando; deaktivert ⇒ begrunnelsen som toast (AR-1.1-02). */
  const execute = useCallback(
    (id: CommandId, args: Readonly<Record<string, string>> = {}) => {
      const current = ctxRef.current;
      const command = registry.get(id);
      const availability = command.isEnabled(current);
      if (!availability.enabled) {
        current.ports.toast(`${command.name}: ${availability.reason}`);
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
      const typing = isTextEntryTarget(event.target);
      if (!typing && candidates[0] === LEADER_KEY && isSpaceActivationTarget(event.target)) {
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
        enabled: availability.enabled,
        reason: availability.enabled ? null : availability.reason,
      };
    });
  }, [pending, registry, ctx, platform]);

  // ---------------------------------------------------------------- kommandomodus i paletten
  const source = useMemo<PaletteCommandSource>(
    () => ({
      options: (query) => {
        const grouped = query.trim() === '';
        return commandPaletteOptions(registry.commands, ctxRef.current, query, platform).map<PaletteCommandItem>((option) =>
          option.kind === 'command'
            ? {
                key: option.commandId,
                commandId: option.commandId,
                kind: 'command',
                label: option.name,
                highlights: option.highlights,
                detail: option.description,
                shortcut: option.shortcut,
                enabled: option.enabled,
                reason: option.reason,
                current: false,
                group: grouped ? GROUP_LABELS[option.group] : null,
                completion: option.completion,
                args: {},
              }
            : {
                key: `${option.commandId}:${option.value.value}`,
                commandId: option.commandId,
                kind: 'argument',
                label: option.value.label,
                highlights: option.highlights,
                detail: option.value.description ?? null,
                shortcut: null,
                enabled: option.enabled,
                reason: option.reason,
                current: option.current,
                group: option.commandName,
                completion: null,
                args: { [option.argument]: option.value.value },
              },
        );
      },
      run: (item) => execute(item.commandId as CommandId, item.args),
    }),
    [registry, platform, execute],
  );

  const { setCommandSource } = palette;
  useEffect(() => {
    setCommandSource(source);
    return () => setCommandSource(null);
  }, [setCommandSource, source]);

  const value = useMemo<CommandsContextValue>(() => ({ openShortcuts: () => setHelpOpen(true) }), []);

  return (
    <CommandsContext.Provider value={value}>
      {children}
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} platform={platform} />
      {showHints ? <WhichKey leader={formatKeySequence([parseChord(LEADER_KEY)], platform)} items={whichKeyItems} /> : null}
      <div className="command-toast" role="status" aria-live="polite">
        {toast ? (
          <div className="toast" key={toast.id}>
            {toast.message}
            <button type="button" className="icon-btn" aria-label="Lukk melding" onClick={() => setToast(null)}>
              ×
            </button>
          </div>
        ) : null}
      </div>
    </CommandsContext.Provider>
  );
}
