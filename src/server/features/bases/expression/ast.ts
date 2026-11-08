/** Uttrykks-AST for Bases (ADR-003). Ren data. */

export type BinaryOperator = '||' | '&&' | '==' | '!=' | '<' | '>' | '<=' | '>=' | '+' | '-' | '*' | '/' | '%';
export type UnaryOperator = '!' | '-';

export type Expr =
  | { readonly type: 'literal'; readonly value: string | number | boolean | null }
  | { readonly type: 'ident'; readonly name: string }
  | { readonly type: 'member'; readonly object: Expr; readonly property: string }
  | { readonly type: 'index'; readonly object: Expr; readonly index: Expr }
  | { readonly type: 'call'; readonly callee: Expr; readonly args: readonly Expr[] }
  | { readonly type: 'unary'; readonly operator: UnaryOperator; readonly operand: Expr }
  | { readonly type: 'binary'; readonly operator: BinaryOperator; readonly left: Expr; readonly right: Expr }
  | { readonly type: 'list'; readonly items: readonly Expr[] };

/** Besøker alle noder (pre-order). */
export function walkExpr(expr: Expr, visit: (node: Expr) => void): void {
  visit(expr);
  switch (expr.type) {
    case 'member':
      walkExpr(expr.object, visit);
      break;
    case 'index':
      walkExpr(expr.object, visit);
      walkExpr(expr.index, visit);
      break;
    case 'call':
      walkExpr(expr.callee, visit);
      for (const arg of expr.args) walkExpr(arg, visit);
      break;
    case 'unary':
      walkExpr(expr.operand, visit);
      break;
    case 'binary':
      walkExpr(expr.left, visit);
      walkExpr(expr.right, visit);
      break;
    case 'list':
      for (const item of expr.items) walkExpr(item, visit);
      break;
    default:
      break;
  }
}

/** Tekstform av et kall-mål, f.eks. `file.hasTag` eller `if` (til advarsler). */
export function calleeName(callee: Expr): string {
  if (callee.type === 'ident') return callee.name;
  if (callee.type === 'member') {
    const owner = callee.object.type === 'ident' || callee.object.type === 'member' ? calleeName(callee.object) : '…';
    return `${owner}.${callee.property}`;
  }
  return '…';
}
