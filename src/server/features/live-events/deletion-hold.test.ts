import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeletionHold } from './deletion-hold';
import type { BatchClassification, DeletionHold } from './deletion-hold';

// PO-78: en omdøping kan deles over to debounce-bunter (unlink i én, add i neste). Slettinger holdes
// tilbake i et kort vindu slik at de kan sendes sammen med en påfølgende ny fil og pares (PO-49).

/** Falsk «disk»: stier som finnes, og stier som er nye (ikke i snapshotet). */
function fakeDisk() {
  const missing = new Set<string>();
  const fresh = new Set<string>();
  const classify = async (paths: readonly string[]): Promise<BatchClassification> => ({
    deleted: paths.filter((p) => missing.has(p)),
    present: paths.filter((p) => !missing.has(p)),
    hasNew: paths.some((p) => fresh.has(p)),
  });
  return { missing, fresh, classify };
}

let hold: DeletionHold | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  hold?.close();
  hold = null;
  vi.useRealTimers();
});

describe('createDeletionHold', () => {
  it('omdøping delt over to bunter: slettingen sendes sammen med den nye fila', async () => {
    const disk = fakeDisk();
    const applied: string[][] = [];
    hold = createDeletionHold({ windowMs: 300, classify: disk.classify, apply: (p) => applied.push([...p]) });

    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(150); // neste debounce-bunt kommer 150 ms senere
    expect(applied).toEqual([]);

    disk.fresh.add('B2.md');
    hold.push(['B2.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['B.md', 'B2.md']]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(applied).toHaveLength(1); // slettingen sendes ikke en gang til
  });

  it('sletting uten ny fil kommer frem etter vinduet', async () => {
    const disk = fakeDisk();
    const applied: string[][] = [];
    hold = createDeletionHold({ windowMs: 300, classify: disk.classify, apply: (p) => applied.push([...p]) });

    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(299);
    expect(applied).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(applied).toEqual([['B.md']]);
  });

  it('vanlige endringer sendes straks; en endret fil slipper ikke slettingen løs', async () => {
    const disk = fakeDisk();
    const applied: string[][] = [];
    hold = createDeletionHold({ windowMs: 300, classify: disk.classify, apply: (p) => applied.push([...p]) });

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

  it('sletting og ny fil i samme bunt sendes straks og samlet', async () => {
    const disk = fakeDisk();
    const applied: string[][] = [];
    hold = createDeletionHold({ windowMs: 300, classify: disk.classify, apply: (p) => applied.push([...p]) });

    disk.missing.add('B.md');
    disk.fresh.add('B2.md');
    hold.push(['B.md', 'B2.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['B.md', 'B2.md']]);
  });

  it('en sti som dukker opp igjen fjernes fra de tilbakeholdte', async () => {
    const disk = fakeDisk();
    const applied: string[][] = [];
    hold = createDeletionHold({ windowMs: 300, classify: disk.classify, apply: (p) => applied.push([...p]) });

    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(100);
    disk.missing.delete('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(applied).toEqual([['B.md']]);
  });

  it('windowMs 0 slår av tilbakeholdingen', async () => {
    const disk = fakeDisk();
    const applied: string[][] = [];
    hold = createDeletionHold({ windowMs: 0, classify: disk.classify, apply: (p) => applied.push([...p]) });
    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([['B.md']]);
  });

  it('close() forkaster tilbakeholdte slettinger', async () => {
    const disk = fakeDisk();
    const applied: string[][] = [];
    hold = createDeletionHold({ windowMs: 300, classify: disk.classify, apply: (p) => applied.push([...p]) });
    disk.missing.add('B.md');
    hold.push(['B.md']);
    await vi.advanceTimersByTimeAsync(0);
    hold.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(applied).toEqual([]);
  });
});
