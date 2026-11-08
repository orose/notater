/**
 * Pratt-parser for Bases-uttrykk (ADR-003): tokens → `Expr`. Kaster aldri ut av modulen:
 * `parseExpression` returnerer `{ ok: false, error }` ved syntaksfeil.
 */
import type { BinaryOperator, Expr } from './ast';
import { ExpressionSyntaxError, tokenize } from './lexer';
import type { Token } from './lexer';

export type ParseResult = { readonly ok: true; readonly expr: Expr } | { readonly ok: false; readonly error: string };

/** Bindingsstyrke for binære operatorer (høyere binder sterkere). */
const BINARY_PRECEDENCE: Readonly<Record<string, number>> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};
/** Vern mot stack overflow ved patologisk nøsting. */
const MAX_DEPTH = 200;
const KEYWORDS: Readonly<Record<string, boolean | null>> = { true: true, false: false, null: null };

export function parseExpression(source: string): ParseResult {
  try {
    const parser = new Parser(tokenize(source));
    const expr = parser.parseExpr(0);
    parser.expectEnd();
    return { ok: true, expr };
  } catch (error) {
    if (error instanceof ExpressionSyntaxError) return { ok: false, error: error.message };
    throw error;
  }
}

class Parser {
  private pos = 0;
  private depth = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parseExpr(minPrecedence: number): Expr {
    this.enter();
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      const precedence = token.kind === 'op' ? BINARY_PRECEDENCE[token.text] : undefined;
      if (precedence === undefined || precedence <= minPrecedence) break;
      this.pos++;
      const right = this.parseExpr(precedence);
      left = { type: 'binary', operator: token.text as BinaryOperator, left, right };
    }
    this.depth--;
    return left;
  }

  expectEnd(): void {
    const token = this.peek();
    if (token.kind !== 'eof') throw this.error(`Uventet «${token.text}»`, token);
  }

  private parseUnary(): Expr {
    const token = this.peek();
    if (token.kind === 'op' && (token.text === '!' || token.text === '-')) {
      this.pos++;
      this.enter();
      // Operanden til unær operator binder sterkere enn alle binære operatorer.
      const operand = this.parseUnary();
      this.depth--;
      return { type: 'unary', operator: token.text, operand };
    }
    return this.parsePostfix(this.parsePrimary());
  }

  private parsePostfix(base: Expr): Expr {
    let expr = base;
    for (;;) {
      const token = this.peek();
      if (token.kind !== 'punct') return expr;
      if (token.text === '.') {
        this.pos++;
        const name = this.next();
        if (name.kind !== 'ident') throw this.error('Forventet et navn etter «.»', name);
        expr = { type: 'member', object: expr, property: name.text };
      } else if (token.text === '(') {
        this.pos++;
        expr = { type: 'call', callee: expr, args: this.parseList(')') };
      } else if (token.text === '[') {
        this.pos++;
        const index = this.parseExpr(0);
        this.expectPunct(']');
        expr = { type: 'index', object: expr, index };
      } else {
        return expr;
      }
    }
  }

  private parsePrimary(): Expr {
    const token = this.next();
    switch (token.kind) {
      case 'number':
      case 'string':
        return { type: 'literal', value: token.value! };
      case 'ident':
        return token.text in KEYWORDS ? { type: 'literal', value: KEYWORDS[token.text]! } : { type: 'ident', name: token.text };
      case 'punct':
        if (token.text === '(') {
          const inner = this.parseExpr(0);
          this.expectPunct(')');
          return inner;
        }
        if (token.text === '[') return { type: 'list', items: this.parseList(']') };
        break;
      default:
        break;
    }
    throw this.error(token.kind === 'eof' ? 'Uttrykket slutter for tidlig' : `Uventet «${token.text}»`, token);
  }

  private parseList(close: ')' | ']'): Expr[] {
    const items: Expr[] = [];
    if (this.peekPunct(close)) {
      this.pos++;
      return items;
    }
    for (;;) {
      items.push(this.parseExpr(0));
      const token = this.next();
      if (token.kind === 'punct' && token.text === close) return items;
      if (!(token.kind === 'punct' && token.text === ',')) throw this.error(`Forventet «,» eller «${close}»`, token);
    }
  }

  private enter(): void {
    if (++this.depth > MAX_DEPTH) throw new ExpressionSyntaxError('Uttrykket er for dypt nøstet.', this.peek().start);
  }

  private expectPunct(text: string): void {
    const token = this.next();
    if (!(token.kind === 'punct' && token.text === text)) throw this.error(`Forventet «${text}»`, token);
  }

  private peekPunct(text: string): boolean {
    const token = this.peek();
    return token.kind === 'punct' && token.text === text;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private next(): Token {
    const token = this.tokens[this.pos]!;
    if (token.kind !== 'eof') this.pos++;
    return token;
  }

  private error(message: string, token: Token): ExpressionSyntaxError {
    const where = token.kind === 'eof' ? 'på slutten' : `ved posisjon ${token.start + 1}`;
    return new ExpressionSyntaxError(`${message} ${where}.`, token.start);
  }
}
