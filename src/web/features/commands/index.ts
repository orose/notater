// Offentlig flate for kommandoregisteret. Den rene modellen (uten React/CSS) ligger i `./model`.
export * from './model';
export { CommandProvider } from './CommandProvider';
export { useCommands } from './use-commands';
export { createCommandHandlers, PENDING_FEATURES, type PendingFeature } from './handlers';
