// Typer for scripts/check-dependency-age.mjs (ren JS uten avhengigheter), slik at testen kan typesjekkes.
export interface LockedPackage {
  name: string;
  version: string;
}
export interface AgedPackage extends LockedPackage {
  published: string;
  ageDays: number;
}
export interface AgeResult {
  tooYoung: AgedPackage[];
  missing: LockedPackage[];
  youngest: AgedPackage | undefined;
  oldest: AgedPackage | undefined;
  checked: number;
}
export const DEFAULT_DAYS: number;
export function collectPackages(lock: unknown): LockedPackage[];
export function evaluateAges(
  packages: LockedPackage[],
  times: Map<string, Record<string, string>>,
  options?: { now?: Date; days?: number },
): AgeResult;
export function parseArgs(argv: string[]): { days: number; lock: string; registry: string | undefined };
export function packumentUrl(registry: string, name: string): string;
