import { describe, expect, it } from 'vitest';
import { tokenize } from './lexer';

const kinds = (src: string) => tokenize(src).map((t) => `${t.kind}:${t.text}`);

describe('tokenize', () => {
  it('identifikatorer, medlem og kall', () => {
    expect(kinds('file.inFolder("domene")')).toEqual([
      'ident:file',
      'punct:.',
      'ident:inFolder',
      'punct:(',
      'string:"domene"',
      'punct:)',
      'eof:',
    ]);
  });

  it('operatorer med to tegn før ett', () => {
    expect(kinds('a<=b>=c==d!=e&&f||!g<h>i').filter((k) => k.startsWith('op'))).toEqual([
      'op:<=',
      'op:>=',
      'op:==',
      'op:!=',
      'op:&&',
      'op:||',
      'op:!',
      'op:<',
      'op:>',
    ]);
  });

  it('tall: heltall, desimal og eksponent', () => {
    expect(tokenize('1 2.5 .5 1e3').filter((t) => t.kind === 'number').map((t) => t.value)).toEqual([1, 2.5, 0.5, 1000]);
  });

  it('strenger med begge anførselstegn og escapes', () => {
    const values = tokenize(`"a\\"b" 'c\\'d' "\\n\\t\\\\" "\\u00e6"`)
      .filter((t) => t.kind === 'string')
      .map((t) => t.value);
    expect(values).toEqual(['a"b', "c'd", '\n\t\\', 'æ']);
  });

  it('unicode-identifikatorer (norske property-navn)', () => {
    expect(kinds('prioritet_ø + Ærend')).toEqual(['ident:prioritet_ø', 'op:+', 'ident:Ærend', 'eof:']);
  });

  it('posisjoner', () => {
    expect(tokenize('a == 1').map((t) => t.start)).toEqual([0, 2, 5, 6]);
  });

  it('uavsluttet streng og ukjent tegn gir syntaksfeil med posisjon', () => {
    expect(() => tokenize('"abc')).toThrow(/Uavsluttet streng/);
    expect(() => tokenize('a # b')).toThrow(/Uventet tegn «#» ved posisjon 3/);
    expect(() => tokenize('a = b')).toThrow(/«=»/);
    expect(() => tokenize('a & b')).toThrow(/«&»/);
  });
});
