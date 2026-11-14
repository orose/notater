/** command-line: `:`-linjen med fullføring og vim-feilkoder (ADR-011 §6, designsystem-terminal §5.3). */
export { EMPTY_LINE, commandLineKey, insertText, lineOptions, resolveLine, type CommandLineState, type LineKeyOutcome, type LineResolution } from './command-line';
export { paintCommandError, paintCommandLine, paintNotice } from './command-line-view';
