export { COMMAND_CATALOG, COMMAND_IDS, KEY_HINTS, type CommandId, type KeyHint } from './model/catalog';
export {
  COMMAND_GROUPS,
  ENABLED,
  GROUP_LABELS,
  type ArgumentSpec,
  type ArgumentValue,
  type Availability,
  type BindingSpec,
  type CommandGroup,
  type CommandHandler,
  type CommandSpecBody,
} from './model/command-types';
export type { CommandContext, CommandPorts, CommandRoute, RouteKind, ViewSnapshot } from './model/command-context';
export { catalogBindings, createCommandRegistry, type Command, type CommandHandlers, type CommandRegistry } from './model/registry';
export { README_MARKERS, renderShortcutsMarkdown, shortcutGroups, type ShortcutGroup, type ShortcutRow } from './model/shortcut-docs';
export {
  paletteModeOf,
  type PaletteArgumentOption,
  type PaletteCommandOption,
  type PaletteMode,
  type PaletteOption,
} from './model/palette-types';
