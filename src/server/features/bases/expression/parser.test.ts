import { describe, expect, it } from 'vitest';
import type { Expr } from './ast';
import { parseExpression } from './parser';

/** Kompakt S-uttrykk for lesbare forventninger. */
function show(expr: Expr): string {
  switch (expr.type) {
    case 'literal':
      return JSON.stringify(expr.value);
    case 'ident':
      return expr.name;
    case 'member':
      return `${show(expr.object)}.${expr.property}`;
    case 'index':
      return `${show(expr.object)}[${show(expr.index)}]`;
    case 'call':
      return `${show(expr.callee)}(${expr.args.map(show).join(', ')})`;
    case 'unary':
      return `(${expr.operator}${show(expr.operand)})`;
    case 'binary':
      return `(${show(expr.left)} ${expr.operator} ${show(expr.right)})`;
    case 'list':
      return `[${expr.items.map(show).join(', ')}]`;
  }
}

const parse = (src: string): string => {
  const result = parseExpression(src);
  if (!result.ok) throw new Error(result.error);
  return show(result.expr);
};

describe('parseExpression', () => {
  it('kundens uttrykk', () => {
    expect(parse('file.inFolder("domene")')).toBe('file.inFolder("domene")');
    expect(parse('file.ext == "md"')).toBe('(file.ext == "md")');
    expect(parse('!file.hasTag("kafka-topic")')).toBe('(!file.hasTag("kafka-topic"))');
    expect(parse('if(file.hasTag("team"), "Testgjengen", "Mine oppgaver")')).toBe(
      'if(file.hasTag("team"), "Testgjengen", "Mine oppgaver")',
    );
    expect(parse('status != "done"')).toBe('(status != "done")');
  });

  it('presedens: || < && < likhet < sammenligning < + < * < unær', () => {
    expect(parse('a || b && c')).toBe('(a || (b && c))');
    expect(parse('a == b && c != d')).toBe('((a == b) && (c != d))');
    expect(parse('a < b == c >= d')).toBe('((a < b) == (c >= d))');
    expect(parse('a + b * c - d % e')).toBe('((a + (b * c)) - (d % e))');
    expect(parse('-a * !b')).toBe('((-a) * (!b))');
    expect(parse('!a.b(c)[0].d')).toBe('(!a.b(c)[0].d)');
  });

  it('venstreassosiativ', () => {
    expect(parse('a - b - c')).toBe('((a - b) - c)');
    expect(parse('a / b / c')).toBe('((a / b) / c)');
  });

  it('parenteser, lister, literaler og indeks', () => {
    expect(parse('(a || b) && c')).toBe('((a || b) && c)');
    expect(parse('[1, "x", true, false, null]')).toBe('[1, "x", true, false, null]');
    expect(parse('[]')).toBe('[]');
    expect(parse('note["mitt felt"]')).toBe('note["mitt felt"]');
    expect(parse('f()')).toBe('f()');
  });

  it('nøkkelord kan brukes som medlemsnavn', () => {
    expect(parse('note.true')).toBe('note.true');
  });

  it('syntaksfeil gir ok=false med norsk melding, aldri unntak', () => {
    for (const bad of ['', 'a ==', 'f(a,', '(a', 'a b', 'a.', '[1, 2', 'file.hasTag("task"', ')', 'a = b']) {
      const result = parseExpression(bad);
      expect(result.ok, bad).toBe(false);
      if (!result.ok) expect(result.error, bad).toMatch(/\S/);
    }
  });

  it('svært dyp nøsting gir feil, ikke stack overflow', () => {
    const deep = `${'('.repeat(5000)}a${')'.repeat(5000)}`;
    const result = parseExpression(deep);
    expect(result.ok).toBe(false);
    expect(parseExpression(`${'!'.repeat(5000)}a`).ok).toBe(false);
  });
});
