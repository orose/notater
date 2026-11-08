/** vault-index: skanning, metadata per notat og uforanderlige snapshots med inkrementell oppdatering. */
export { extractNoteMeta } from './extract-note-meta';
export type { NoteMeta, OutgoingLink, OutgoingLinkKind } from './note-meta';
export { createInlineMetaExtractor, createWorkerMetaExtractor, defaultPoolSize } from './meta-extractor';
export type { MetaExtractor } from './meta-extractor';
export { readVaultBytes, readVaultText, resolveInsideVault, scanVault, statVaultFile } from './scan-vault';
export { buildSnapshot, detectRenames, findByDocPath, hashText, toVaultFile, updateSnapshot } from './vault-snapshot';
export type { BuildSnapshotOptions, IndexedNote, SnapshotUpdate, VaultFile, VaultSnapshot } from './vault-snapshot';
export { describeVaultPath, isIgnoredPath, normalizeVaultPath } from './vault-paths';
export type { FileKind, UnsupportedFileKind } from './vault-paths';
