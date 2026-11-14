// Tastaturmotoren (ADR-007): notasjon, akkorder, policy og motor. Ren TS, delt av web og terminal (ADR-011 §1).
export { DEFAULT_MODE, KEY_MODES, type KeyMode } from './modes';
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
} from './key-notation';
export { chordCandidates, type KeyInput } from './key-input';
export {
  ESCAPE_COMMAND_ID,
  P5_SAFE_CHARACTERS,
  RESERVED_NORMAL_KEYS,
  validateBindings,
  type BindingToCheck,
  type PolicyViolation,
} from './key-policy';
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
} from './key-engine';
