import { describe, expect, it } from 'vitest';
import { extractNoteMeta } from './extract-note-meta';
import { bundledWorkerSource, createWorkerMetaExtractor } from './meta-extractor';

describe('createWorkerMetaExtractor', () => {
  it('gir samme resultat som inline-uttrekk, i riktig rekkefølge', async () => {
    const sources = Array.from({ length: 120 }, (_, i) => `---\ntags: [t${i}]\n---\n# Notat ${i}\nSe [[Mål ${i}]] #inline${i}`);
    const extractor = createWorkerMetaExtractor(2);
    try {
      const metas = await extractor.extractMany(sources);
      expect(metas).toHaveLength(120);
      expect(metas[0]).toEqual(extractNoteMeta(sources[0]!));
      expect(metas[119]).toEqual(extractNoteMeta(sources[119]!));
    } finally {
      await extractor.close();
    }
  }, 20_000);

  it('workerne kjører en ferdig bunt (rask oppstart, ikke tsx per modul)', async () => {
    const bundle = await bundledWorkerSource();
    expect(bundle?.includes('parentPort')).toBe(true);
    expect(bundle?.includes('micromark')).toBe(true);
  }, 20_000);
});
