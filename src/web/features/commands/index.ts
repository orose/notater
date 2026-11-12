// Offentlig flate for kommandoregisteret. Den rene modellen (uten React/CSS) ligger i `src/core/commands`.
export { COMMAND_CATALOG, COMMAND_IDS, KEY_HINTS, type CommandId, type KeyHint } from '../../../core/commands';
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
} from '../../../core/commands';
export type { CommandContext, CommandPorts, CommandRoute, PresentationLevelInfo, PresentationPort, RouteKind, ViewSnapshot } from '../../../core/commands';
export {
  catalogBindings,
  createCommandRegistry,
  surfaceCommandIds,
  type Command,
  type CommandHandlers,
  type CommandRegistry,
  type SurfaceCommandId,
} from '../../../core/commands';
export {
  README_MARKERS,
  README_PRESENT_MARKERS,
  renderShortcutsMarkdown,
  shortcutGroups,
  type ShortcutBinding,
  type ShortcutCommand,
  type ShortcutGroup,
  type ShortcutRow,
} from '../../../core/commands';
export { fuzzyMatch, normalizeForSearch, type FuzzyMatch } from '../../../core/commands';
export { commandPaletteOptions, paletteArgumentError, paletteArgumentHeading, shortcutChords } from '../../../core/commands';
export {
  paletteModeOf,
  type Highlights,
  type PaletteArgumentOption,
  type PaletteCommandOption,
  type PaletteMode,
  type PaletteOption,
} from '../../../core/commands';
export { CommandProvider } from './CommandProvider';
export { useCommands } from './use-commands';
export { createCommandHandlers, PENDING_FEATURES, type PendingFeature } from './handlers';
