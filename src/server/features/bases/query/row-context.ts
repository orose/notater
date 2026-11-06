import type { EvalContext } from '../expression/context';
import type { FileSubject, LinkValue, Value } from '../expression/values';
import type { FormulaFn } from './compile';
import type { BaseRecord } from './record-source';

export interface RowEnvironment {
  readonly formulas: ReadonlyMap<string, FormulaFn>;
  readonly thisFile: FileSubject | null;
  readonly nowMs: number;
  resolveLink(text: string, from: FileSubject): LinkValue;
}

/**
 * Evalueringskontekst for én rad. Formelverdier caches per rad (deles av alle views i basen);
 * en formel som allerede evalueres (syklus) gir `null`.
 */
export class RowContext implements EvalContext {
  private readonly formulaCache = new Map<string, Value>();
  private readonly evaluating = new Set<string>();

  constructor(
    readonly file: BaseRecord,
    private readonly env: RowEnvironment,
  ) {}

  get thisFile(): FileSubject | null {
    return this.env.thisFile;
  }

  formula(name: string): Value {
    const cached = this.formulaCache.get(name);
    if (cached !== undefined) return cached;
    const fn = this.env.formulas.get(name);
    if (!fn || this.evaluating.has(name)) return null;
    this.evaluating.add(name);
    try {
      const value = fn(this);
      this.formulaCache.set(name, value);
      return value;
    } finally {
      this.evaluating.delete(name);
    }
  }

  resolveLink(text: string, from: FileSubject): LinkValue {
    return this.env.resolveLink(text, from);
  }

  nowMs(): number {
    return this.env.nowMs;
  }
}
