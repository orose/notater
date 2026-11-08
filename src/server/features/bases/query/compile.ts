/**
 * Kompilerer tekst fra base-definisjonen til evaluerbare funksjoner, med statiske advarsler
 * (ADR-003): parse-feil og ukjente funksjoner i filtre → leddet ignoreres (B8, O8).
 */
import type { Expr } from '../expression/ast';
import type { EvalContext } from '../expression/context';
import { checkExpression, evaluate } from '../expression/evaluate';
import { parseExpression } from '../expression/parser';
import { isTruthy } from '../expression/values';
import type { Value } from '../expression/values';
import type { FilterNode } from '../definition/base-definition';
import type { WarningSink } from './warnings';

export type Predicate = (ctx: EvalContext) => boolean;

const ALWAYS: Predicate = () => true;

export interface ExpressionCompiler {
  /**
   * `null` ved parse-feil (advarsel er gitt). `isFilter`: ukjente funksjoner gjør at leddet ignoreres (B8),
   * og advarselen sier det.
   */
  compile(source: string, where: string, sink: WarningSink, isFilter?: boolean): { readonly expr: Expr | null; readonly hasUnknownFunction: boolean };
  /** Sann hvis et kompilert uttrykk bruker `now()`/`today()`. */
  readonly usesClock: boolean;
}

export function createExpressionCompiler(formulaNames: ReadonlySet<string>): ExpressionCompiler {
  let usesClock = false;
  return {
    get usesClock() {
      return usesClock;
    },
    compile(source, where, sink, isFilter = false) {
      const parsed = parseExpression(source);
      if (!parsed.ok) {
        sink.add({ code: 'parse-error', message: `Uttrykket i ${where} kunne ikke leses og ignoreres: ${parsed.error}`, source });
        return { expr: null, hasUnknownFunction: false };
      }
      const issues = checkExpression(parsed.expr);
      usesClock ||= issues.usesClock;
      for (const name of issues.unknownFunctions) {
        const consequence = isFilter ? ' – filterleddet ignoreres' : ' (gir tom verdi)';
        sink.add({ code: 'unknown-function', message: `Ukjent funksjon «${name}» i ${where}${consequence}.`, source: name });
      }
      for (const name of issues.unknownFields) {
        sink.add({ code: 'unknown-property', message: `Ukjent felt «${name}» i ${where} (gir tom verdi).`, source: name });
      }
      for (const name of issues.formulaRefs) {
        if (!formulaNames.has(name)) {
          sink.add({ code: 'unknown-formula', message: `Formelen «${name}» finnes ikke (brukt i ${where}).`, source: `formula.${name}` });
        }
      }
      return { expr: parsed.expr, hasUnknownFunction: issues.unknownFunctions.length > 0 };
    },
  };
}

/**
 * Filtertre → predikat. `and` = alle, `or` = minst én, `not: [a, b]` = ingen av (ADR-003).
 * Ledd med parse-feil eller ukjent funksjon ignoreres (behandles som sanne) + advarsel (B8).
 */
export function compileFilter(node: FilterNode | null, where: string, compiler: ExpressionCompiler, sink: WarningSink): Predicate {
  if (!node) return ALWAYS;
  if (node.kind === 'expr') {
    const { expr, hasUnknownFunction } = compiler.compile(node.source, where, sink, true);
    if (!expr || hasUnknownFunction) return ALWAYS;
    return (ctx) => isTruthy(evaluate(expr, ctx));
  }
  const children = node.children.map((child) => compileFilter(child, where, compiler, sink));
  if (children.length === 0) return ALWAYS;
  if (node.kind === 'and') return (ctx) => children.every((p) => p(ctx));
  if (node.kind === 'or') return (ctx) => children.some((p) => p(ctx));
  return (ctx) => !children.some((p) => p(ctx));
}

export type FormulaFn = (ctx: EvalContext) => Value;

/**
 * Formler (kan bruke andre formler). Sykluser oppdages statisk (advarsel) og stoppes ved kjøring
 * av radkonteksten (verdien blir tom).
 */
export function compileFormulas(
  formulas: ReadonlyMap<string, string>,
  compiler: ExpressionCompiler,
  sink: WarningSink,
): ReadonlyMap<string, FormulaFn> {
  const compiled = new Map<string, FormulaFn>();
  const deps = new Map<string, readonly string[]>();
  for (const [name, source] of formulas) {
    const { expr } = compiler.compile(source, `formelen «${name}»`, sink);
    if (!expr) {
      compiled.set(name, () => null);
      continue;
    }
    deps.set(name, checkExpression(expr).formulaRefs);
    compiled.set(name, (ctx) => evaluate(expr, ctx));
  }
  for (const cycle of findCycles(deps)) {
    sink.add({
      code: 'formula-cycle',
      message: `Formlene refererer til hverandre i en sirkel (${cycle.join(' → ')}); verdien blir tom.`,
      source: cycle.map((n) => `formula.${n}`).join(' → '),
    });
  }
  return compiled;
}

function findCycles(deps: ReadonlyMap<string, readonly string[]>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (name: string): void => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'visiting') {
      cycles.push([...stack.slice(stack.indexOf(name)), name]);
      return;
    }
    state.set(name, 'visiting');
    stack.push(name);
    for (const dep of deps.get(name) ?? []) if (deps.has(dep)) visit(dep);
    stack.pop();
    state.set(name, 'done');
  };
  for (const name of deps.keys()) visit(name);
  return cycles;
}
