// Typer for scripts/present.mjs (ren JS), slik at testen kan typesjekkes.
export const PRESENT_INPUTS: readonly string[];
export const OUT_DIR: string;
export const BUNDLE: string;
export const WORKER: string;
export function sourceStamp(root: string): string;
export function needsBuild(root: string, stamp: string): boolean;
export function buildPresent(root: string): Promise<void>;
export function ensureBuilt(root: string, force?: boolean): Promise<boolean>;
