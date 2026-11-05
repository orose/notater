import { describe, expect, it } from 'vitest';
import { toPropertyEntries, toVaultValue } from './to-vault-value';

const resolve = (target: string) => (target === 'Finnes ikke' ? null : `dok/${target}`);

describe('toVaultValue', () => {
  it('primitiver', () => {
    expect(toVaultValue('x', 'Hei', resolve)).toEqual({ type: 'string', value: 'Hei' });
    expect(toVaultValue('x', 42, resolve)).toEqual({ type: 'number', value: 42 });
    expect(toVaultValue('x', true, resolve)).toEqual({ type: 'boolean', value: true });
    expect(toVaultValue('x', null, resolve)).toEqual({ type: 'null' });
    expect(toVaultValue('x', undefined, resolve)).toEqual({ type: 'null' });
  });

  it('datoer og datotid', () => {
    expect(toVaultValue('x', '2026-11-05', resolve)).toEqual({ type: 'date', value: '2026-11-05T00:00:00.000Z', hasTime: false });
    expect(toVaultValue('x', '2026-11-05T14:30:00', resolve)).toEqual({ type: 'date', value: '2026-11-05T14:30:00.000Z', hasTime: true });
    expect(toVaultValue('x', '2026-13-45', resolve)).toEqual({ type: 'string', value: '2026-13-45' });
  });

  it('lenker, også brutte', () => {
    expect(toVaultValue('x', '[[Kafka]]', resolve)).toEqual({ type: 'link', target: 'dok/Kafka', display: 'Kafka' });
    expect(toVaultValue('x', '[[Kafka#Topics|K]]', resolve)).toEqual({ type: 'link', target: 'dok/Kafka', display: 'K' });
    expect(toVaultValue('x', '[[Finnes ikke]]', resolve)).toEqual({ type: 'link', target: null, display: 'Finnes ikke' });
  });

  it('lister og tags', () => {
    expect(toVaultValue('liste', ['a', 1], resolve)).toEqual({
      type: 'list',
      value: [
        { type: 'string', value: 'a' },
        { type: 'number', value: 1 },
      ],
    });
    expect(toVaultValue('tags', ['qa', '#x/y'], resolve)).toEqual({
      type: 'list',
      value: [
        { type: 'tag', value: 'qa' },
        { type: 'tag', value: 'x/y' },
      ],
    });
    expect(toVaultValue('tags', 'task', resolve)).toEqual({ type: 'list', value: [{ type: 'tag', value: 'task' }] });
  });

  it('nestet objekt blir JSON-streng', () => {
    expect(toVaultValue('nestet', { a: { b: 'dypt' } }, resolve)).toEqual({ type: 'string', value: '{"a":{"b":"dypt"}}' });
  });

  it('farlig tekst forblir ren tekst', () => {
    expect(toVaultValue('lenke', "javascript:alert('x')", resolve)).toEqual({ type: 'string', value: "javascript:alert('x')" });
  });
});

describe('toPropertyEntries', () => {
  it('beholder fil-rekkefølge', () => {
    expect(toPropertyEntries({ b: 1, a: 'x' }, resolve).map((e) => e.key)).toEqual(['b', 'a']);
    expect(toPropertyEntries(null, resolve)).toEqual([]);
  });
});
