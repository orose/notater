import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeletionHold } from './deletion-hold';
import type { BatchClassification, DeletionHold } from './deletion-hold';

// PO-78: en omdøping kan deles over to debounce-bunter (unlink i én, add i neste). Slettinger holdes
// tilbake i et kort vindu slik at de kan sendes sammen med den nye fila de pares med (PO-49).

/** Falsk «disk»: stier som mangler, og hvilken slettet sti en ny fil er samme fil som (inode/hash). */
function fakeDisk() {
  const missing = new Set<string>();
  const sameFileAs = new Map<string, string>();
  const classify = async (paths: readonly string[], held: readonly string[]): Promise<BatchClassification> => {
    const deleted = paths.filter((p) => missing.has(p));
    const present = paths.filter((p) => !missing.has(p));
    const candidates = new Set([...held, ...deleted]);
    const release = present.map((p) => sameFileAs.get(p)).filter((p): p is string => p !== undefined && candidates.has(p));
    return { deleted, present, release };
  };
  return { missing, sameFileAs, classify };
}

let hold: DeletionHold | null = null;
let applied: string[][] = [];

const start = (windowMs = 300, disk = fakeDisk()) => {
  hold = createDeletionHold({ windowMs, classify: disk.classify, apply: (p) => applied.push([...p]) });
  return { disk, hold };
};

beforeEach(() => {
  vi.useFakeTimers();
  applied = [];
});

afterEach(() => {
  hold?.close();
  hold = null;
  vi.useRealTimers();
});

describe('createDeletionHold', () => {
  it('omdøping delt over to bunter: slettingen sendes sammen med den nye fila', async () => {
    const { disk, hold } = start();
    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(150); // neste debounce-bunt kommer 150 ms senere
    expect(applied).toEqual([]);

    disk.sameFileAs.set('B2.md', 'B.md');
    hold.push(['B2.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['B.md', 'B2.md']]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(applied).toHaveLength(1); // slettingen sendes ikke en gang til
  });

  it('en annen ny fil i samme bunt som slettingen slipper den ikke løs (e2e-scenariet i ak12)', async () => {
    const { disk, hold } = start();
    disk.missing.add('B.md');
    hold.push(['B.md', 'Støy.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['Støy.md']]);

    disk.sameFileAs.set('arkiv/B2.md', 'B.md');
    await vi.advanceTimersByTimeAsync(150);
    hold.push(['arkiv/B2.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['Støy.md'], ['B.md', 'arkiv/B2.md']]);
  });

  it('sletting uten ny fil kommer frem etter vinduet', async () => {
    const { disk, hold } = start();
    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(299);
    expect(applied).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(applied).toEqual([['B.md']]);
  });

  it('vanlige endringer sendes straks; en endret fil slipper ikke slettingen løs', async () => {
    const { disk, hold } = start();
    hold.push(['A.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['A.md']]);

    disk.missing.add('B.md');
    hold.push(['B.md', 'C.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['A.md'], ['C.md']]);

    await vi.advanceTimersByTimeAsync(300);
    expect(applied).toEqual([['A.md'], ['C.md'], ['B.md']]);
  });

  it('sletting og matchende ny fil i samme bunt sendes straks og samlet', async () => {
    const { disk, hold } = start();
    disk.missing.add('B.md');
    disk.sameFileAs.set('B2.md', 'B.md');
    hold.push(['B.md', 'B2.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['B.md', 'B2.md']]);
  });

  it('bare de matchede slettingene slippes; resten venter til vinduet går ut', async () => {
    const { disk, hold } = start();
    disk.missing.add('B.md');
    disk.missing.add('C.md');
    hold.push(['B.md', 'C.md']);
    await vi.advanceTimersByTimeAsync(100);
    disk.sameFileAs.set('B2.md', 'B.md');
    hold.push(['B2.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['B.md', 'B2.md']]);
    await vi.advanceTimersByTimeAsync(200);
    expect(applied).toEqual([['B.md', 'B2.md'], ['C.md']]);
  });

  it('en sti som dukker opp igjen fjernes fra de tilbakeholdte', async () => {
    const { disk, hold } = start();
    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(100);
    disk.missing.delete('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(applied).toEqual([['B.md']]);
  });

  it('windowMs 0 slår av tilbakeholdingen', async () => {
    const { disk, hold } = start(0);
    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['B.md']]);
  });

  it('close() forkaster tilbakeholdte slettinger', async () => {
    const { disk, hold } = start();
    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(0);
    hold.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(applied).toEqual([]);
  });
});
