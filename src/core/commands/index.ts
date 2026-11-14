// Ren TS-flate for kommandoregisteret (ADR-007, ADR-011 §1): katalog, register, fuzzy, palettvalg og `?`-grupper.
// Importeres av web (`src/web/features/commands`), terminalen, README-generatoren og QAs registertest.
export { COMMAND_CATALOG, COMMAND_IDS, KEY_HINTS, type CommandId, type KeyHint } from './catalog';
export {
  COMMAND_GROUPS,
  ENABLED,
  GROUP_LABELS,
  NOT_WHILE_PRESENTING,
  ONLY_WHILE_PRESENTING,
  MODE_GROUP_ORDER,
  PALETTE_GROUP_ORDER,
  SURFACES,
  type ArgumentError,
  type ArgumentSpec,
  type ArgumentValue,
  type Availability,
  type BindingSpec,
  type CommandGroup,
  type CommandHandler,
  type CommandSpecBody,
  type Surface,
} from './command-types';
export type { CommandContext, CommandPorts, CommandRoute, PresentationLevelInfo, PresentationPort, RouteKind, ViewSnapshot } from './command-context';
export {
  catalogBindings,
  createCommandRegistry,
  surfaceCommandIds,
  type Command,
  type CommandHandlers,
  type CommandRegistry,
  type SurfaceCommandId,
} from './registry';
export {
  README_MARKERS,
  README_PRESENT_MARKERS,
  renderShortcutsMarkdown,
  shortcutGroups,
  type ShortcutBinding,
  type ShortcutCommand,
  type ShortcutGroup,
  type ShortcutRow,
} from './shortcut-docs';
export { invalidArgumentError, levelsSentence, presentLevelError, unknownCommandError } from './command-errors';
export { fuzzyMatch, normalizeForSearch, prepareSearchTarget, type FuzzyMatch, type SearchTarget } from './fuzzy';
export { commandPaletteOptions, paletteArgumentError, paletteArgumentHeading, shortcutChords } from './palette-options';
export {
  paletteModeOf,
  type Highlights,
  type PaletteArgumentOption,
  type PaletteCommandOption,
  type PaletteMode,
  type PaletteOption,
} from './palette-types';
