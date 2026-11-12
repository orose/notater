import { describe, expect, it } from 'vitest';
import { createFitCache } from './fit-cache';
import { baseIdsIn, cyrb53 } from './fingerprint';

const fit = { scale: 1, breaks: [], scrollUnits: [] };
const key = (content: string, typeset = 'tidsskrift') => ({ content, typeset, layoutVersion: 1 });

describe('tilpasningscache (AR-2-12)', () => {
  it('nøkkel = innhold + typesett + layoutversjon; LRU over grensen', () => {
    const cache = createFitCache(2);
    cache.set(key('a'), fit);
    expect(cache.get(key('a'))).toBe(fit);
    expect(cache.get(key('a', 'terminal'))).toBeUndefined();
    cache.set(key('b'), fit);
    cache.get(key('a'));
    cache.set(key('c'), fit);
    expect(cache.get(key('b'))).toBeUndefined();
    expect(cache.get(key('a'))).toBe(fit);
    cache.clear();
    expect(cache.get(key('a'))).toBeUndefined();
  });

  it('fingeravtrykk er stabilt og skiller innhold; base-id-er samles', () => {
    expect(cyrb53('abc')).toBe(cyrb53('abc'));
    expect(cyrb53('abc')).not.toBe(cyrb53('abd'));
    const tree = { type: 'element', tagName: 'div', children: [{ type: 'element', tagName: 'vr-base', properties: { dataBaseId: 'base-1' }, children: [] }] };
    expect(baseIdsIn(tree)).toEqual(['base-1']);
  });
});
