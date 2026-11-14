// Tastaturet i web: kjernens motor (src/core/keyboard) og DOM-vaktene.
export { DEFAULT_MODE, KEY_MODES, type KeyMode } from '../../../core/keyboard';
export {
  LEADER_KEY,
  NAMED_KEYS,
  KeyNotationError,
  chordId,
  formatKeySequence,
  isNamedKey,
  parseChord,
  parseKeySequence,
  sequenceId,
  type KeyChord,
  type KeySequence,
  type LabelPlatform,
  type Modifier,
  type NamedKey,
} from '../../../core/keyboard';
export { chordCandidates, type KeyInput } from '../../../core/keyboard';
export {
  ESCAPE_COMMAND_ID,
  P5_SAFE_CHARACTERS,
  RESERVED_NORMAL_KEYS,
  validateBindings,
  type BindingToCheck,
  type PolicyViolation,
} from '../../../core/keyboard';
export {
  createKeyEngine,
  SEQUENCE_TIMEOUT_MS,
  WHICH_KEY_DELAY_MS,
  type EngineBinding,
  type EngineKeymap,
  type EngineTimers,
  type KeyEngine,
  type KeyEngineOptions,
  type KeyEngineState,
  type KeyResult,
  type PendingSequence,
} from '../../../core/keyboard';
export { effectiveKeyTarget, hasOpenModal, isSpaceActivationTarget, isTextEntryTarget } from './dom-guard';
