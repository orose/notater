/**
 * Evaluator for Bases-uttrykk (ADR-003): `(Expr, EvalContext) → Value`. Ren tre-vandrer, ingen
 * `eval`. Ukjente funksjoner/metoder gir `null` (statisk sjekk i `checkExpression` gir advarselen).
 */
import { calleeName, walkExpr } from './ast';
import type { Expr } from './ast';
import type { EvalContext } from './context';
import { GLOBAL_FUNCTIONS, KNOWN_FILE_FIELDS, KNOWN_METHOD_NAMES, findMethod, readField } from './functions';
import { addDuration, compareForOperator, dateValue, isDate, isList, isTruthy, list, toText, valuesEqual } from './values';
import type { ObjectValue, Value } from './values';

export function evaluate(expr: Expr, ctx: EvalContext): Value {
  switch (expr.type) {
    case 'literal':
      return expr.value;
    case 'ident':
      return identifier(expr.name, ctx);
    case 'list':
      return list(expr.items.map((item) => evaluate(item, ctx)));
    case 'member':
      return member(expr.object, expr.property, ctx);
    case 'index':
      return index(evaluate(expr.object, ctx), evaluate(expr.index, ctx));
    case 'call':
      return call(expr.callee, expr.args, ctx);
    case 'unary': {
      const operand = evaluate(expr.operand, ctx);
      if (expr.operator === '!') return !isTruthy(operand);
      return typeof operand === 'number' ? -operand : null;
    }
    case 'binary':
      return binary(expr, ctx);
  }
}

/** Navnerom `file`, `note`, `formula`, `this`; alle andre bare identifikatorer er `note.<navn>` (ADR-003). */
function identifier(name: string, ctx: EvalContext): Value {
  switch (name) {
    case 'file':
      return { kind: 'file', file: ctx.file };
    case 'note':
      return { kind: 'object', get: (key) => ctx.file.property(key), keys: () => ctx.file.propertyKeys() };
    case 'formula':
      return { kind: 'object', get: (key) => ctx.formula(key), keys: () => [] };
    case 'this': {
      const host = ctx.thisFile;
      if (!host) return null;
      return {
        kind: 'object',
        get: (key) => (key === 'file' ? { kind: 'file', file: host } : host.property(key)),
        keys: () => ['file', ...host.propertyKeys()],
      } satisfies ObjectValue;
    }
    default:
      return ctx.file.property(name);
  }
}

function member(objectExpr: Expr, property: string, ctx: EvalContext): Value {
  // Snarveier for de vanligste formene (ytelse): note.x, formula.x.
  if (objectExpr.type === 'ident' && objectExpr.name === 'note') return ctx.file.property(property);
  if (objectExpr.type === 'ident' && objectExpr.name === 'formula') return ctx.formula(property);
  return readField(evaluate(objectExpr, ctx), property, ctx) ?? null;
}

function index(object: Value, key: Value): Value {
  if (isList(object) && typeof key === 'number') {
    const i = key < 0 ? object.items.length + key : key;
    return object.items[i] ?? null;
  }
  if (typeof object === 'string' && typeof key === 'number') return [...object][key] ?? null;
  if (typeof object === 'object' && object !== null && object.kind === 'object') return object.get(toText(key));
  return null;
}

function call(callee: Expr, argExprs: readonly Expr[], ctx: EvalContext): Value {
  if (callee.type === 'ident') {
    if (callee.name === 'if') {
      // Lat: bare grenen som velges evalueres.
      const condition = argExprs[0] ? evaluate(argExprs[0], ctx) : null;
      const branch = isTruthy(condition) ? argExprs[1] : argExprs[2];
      return branch ? evaluate(branch, ctx) : null;
    }
    const fn = GLOBAL_FUNCTIONS.get(callee.name);
    return fn ? fn(argExprs.map((a) => evaluate(a, ctx)), ctx) : null;
  }
  if (callee.type === 'member') {
    const receiver = evaluate(callee.object, ctx);
    const method = findMethod(receiver, callee.property);
    return method ? method(receiver, argExprs.map((a) => evaluate(a, ctx)), ctx) : null;
  }
  return null;
}

function binary(expr: Extract<Expr, { type: 'binary' }>, ctx: EvalContext): Value {
  const left = evaluate(expr.left, ctx);
  // Kortslutning med JS-semantikk: `status || "ingen"` gir en verdi, filtre bruker sannhetsverdien.
  if (expr.operator === '&&') return isTruthy(left) ? evaluate(expr.right, ctx) : left;
  if (expr.operator === '||') return isTruthy(left) ? left : evaluate(expr.right, ctx);
  const right = evaluate(expr.right, ctx);
  switch (expr.operator) {
    case '==':
      return valuesEqual(left, right);
    case '!=':
      return !valuesEqual(left, right);
    case '<':
    case '>':
    case '<=':
    case '>=': {
      const c = compareForOperator(left, right);
      if (c === null) return false;
      return expr.operator === '<' ? c < 0 : expr.operator === '>' ? c > 0 : expr.operator === '<=' ? c <= 0 : c >= 0;
    }
    case '+':
      return add(left, right);
    case '-':
      return subtract(left, right);
    default:
      return numeric(expr.operator, left, right);
  }
}

const finite = (n: number): number | null => (Number.isFinite(n) ? n : null);

function add(left: Value, right: Value): Value {
  if (typeof left === 'number' && typeof right === 'number') return finite(left + right);
  if (isDate(left) && typeof right === 'string') return addDuration(left, right, 1) ?? toText(left) + right;
  if (isDate(left) && typeof right === 'number') return dateValue(left.ms + right, true);
  if (isList(left) && isList(right)) return list([...left.items, ...right.items]);
  if (typeof left === 'string' || typeof right === 'string') return toText(left) + toText(right);
  return null;
}

function subtract(left: Value, right: Value): Value {
  if (typeof left === 'number' && typeof right === 'number') return finite(left - right);
  if (isDate(left) && isDate(right)) return left.ms - right.ms;
  if (isDate(left) && typeof right === 'string') return addDuration(left, right, -1);
  if (isDate(left) && typeof right === 'number') return dateValue(left.ms - right, true);
  return null;
}

function numeric(operator: '*' | '/' | '%' | string, left: Value, right: Value): Value {
  if (typeof left !== 'number' || typeof right !== 'number') return null;
  if (operator === '*') return finite(left * right);
  if (operator === '/') return finite(left / right);
  return finite(left % right);
}

export interface ExpressionIssues {
  /** Kall til funksjoner/metoder som ikke finnes i registeret, f.eks. `file.finnesIkke`. */
  readonly unknownFunctions: readonly string[];
  /** Ukjente `file.*`-felter, f.eks. `file.navn`. */
  readonly unknownFields: readonly string[];
  /** `formula.<navn>`-referanser (for avhengighetsgraf og syklusvern). */
  readonly formulaRefs: readonly string[];
  /** Bruker `now()`/`today()` (resultatet kan ikke caches på tvers av tid). */
  readonly usesClock: boolean;
}

/** Statisk sjekk: én advarsel per uttrykk i stedet for per rad (ADR-003). */
export function checkExpression(expr: Expr): ExpressionIssues {
  const unknownFunctions = new Set<string>();
  const unknownFields = new Set<string>();
  const formulaRefs = new Set<string>();
  const callees = new Set<Expr>();
  let usesClock = false;
  walkExpr(expr, (node) => {
    if (node.type === 'call') {
      callees.add(node.callee);
      if (node.callee.type === 'ident') {
        if (node.callee.name === 'now' || node.callee.name === 'today') usesClock = true;
        if (!GLOBAL_FUNCTIONS.has(node.callee.name)) unknownFunctions.add(node.callee.name);
      } else if (node.callee.type === 'member' && !KNOWN_METHOD_NAMES.has(node.callee.property)) {
        unknownFunctions.add(calleeName(node.callee));
      }
    }
    if (node.type === 'member' && node.object.type === 'ident') {
      if (node.object.name === 'formula') formulaRefs.add(node.property);
      if (node.object.name === 'file' && !callees.has(node) && !KNOWN_FILE_FIELDS.has(node.property)) {
        unknownFields.add(`file.${node.property}`);
      }
    }
    if (node.type === 'index' && node.object.type === 'ident' && node.object.name === 'formula' && node.index.type === 'literal') {
      formulaRefs.add(String(node.index.value));
    }
  });
  return { unknownFunctions: [...unknownFunctions], unknownFields: [...unknownFields], formulaRefs: [...formulaRefs], usesClock };
}
