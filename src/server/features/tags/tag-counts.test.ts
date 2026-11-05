import { describe, expect, it } from 'vitest';
import { describeVaultPath, extractNoteMeta } from '../vault-index';
import type { IndexedNote } from '../vault-index';
import { buildTagCounts } from './tag-counts';

const note = (path: string, source: string): IndexedNote => ({
  file: { ...describeVaultPath(path), diskPath: path, size: 0, mtimeMs: 0, ctimeMs: 0 },
  meta: extractNoteMeta(source),
  body: source,
});

describe('buildTagCounts', () => {
  it('teller notater per tagg case-insensitivt (PO-10), sortert på antall og navn', () => {
    const counts = buildTagCounts([
      note('a.md', '---\ntags: [task]\n---\n#kafka'),
      note('b.md', '#Task #task/backend'),
      note('c.md', '#kafka'),
      note('d.excalidraw.md', '#kafka'),
    ]);
    expect(counts).toEqual([
      { tag: 'kafka', count: 2 },
      { tag: 'task', count: 2 },
      { tag: 'task/backend', count: 1 },
    ]);
  });
});
