// Ren TS-flate for kommandoregisteret: kan importeres i Node (README-generatoren, QAs registertest)
// uten React, DOM eller CSS. React-delen eksporteres fra `../index.ts`.
export { COMMAND_CATALOG, COMMAND_IDS, KEY_HINTS, type CommandId, type KeyHint } from './catalog';
export {
  COMMAND_GROUPS,
  ENABLED,
  GROUP_LABELS,
  NOT_WHILE_PRESENTING,
  ONLY_WHILE_PRESENTING,
  MODE_GROUP_ORDER,
  PALETTE_GROUP_ORDER,
  type ArgumentError,
  type ArgumentSpec,
  type ArgumentValue,
  type Availability,
  type BindingSpec,
  type CommandGroup,
  type CommandHandler,
  type CommandSpecBody,
} from './command-types';
export type { CommandContext, CommandPorts, CommandRoute, RouteKind, ViewSnapshot } from './command-context';
export { catalogBindings, createCommandRegistry, type Command, type CommandHandlers, type CommandRegistry } from './registry';
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
export { fuzzyMatch, normalizeForSearch, type FuzzyMatch } from './fuzzy';
export { commandPaletteOptions, paletteArgumentError, paletteArgumentHeading, shortcutChords } from './palette-options';
export {
  paletteModeOf,
  type Highlights,
  type PaletteArgumentOption,
  type PaletteCommandOption,
  type PaletteMode,
  type PaletteOption,
} from './palette-types';
