import { describe, expect, it } from 'vitest';
import type { NoteDocument } from '../../../shared/api-types';
import statusmote from '../../../core/presentation/model/fixtures/Statusmøte uke 45.json';
import { frameToLines } from '../cells';
import { buildDeck } from '../session';
import { plainSlideView, wrapWords } from './plain-view';

const doc = { ...(statusmote as object), kind: 'note', properties: [], aliases: [], bases: {} } as unknown as NoteDocument;

describe('enkel lysbildetegning (3-a)', () => {
  it('statuslinjen slutter med n/N; tittel, agenda og innhold er lesbare', () => {
    const deck = buildDeck(doc, { level: null, transitions: true });
    const title = frameToLines(plainSlideView(deck, 0, 80, 24));
    expect(title.at(-1)).toMatch(new RegExp(`1/${deck.slides.length}$`));
    expect(title.join('\n')).toContain('Statusmøte uke 45');
    const content = deck.slides.findIndex((s) => s.kind === 'content' && s.agendaIndex !== null);
    const lines = frameToLines(plainSlideView(deck, content, 120, 36));
    expect(lines[0]).toContain(deck.agenda[0]!.text);
    expect(lines.at(-1)).toMatch(new RegExp(`${content + 1}/${deck.slides.length}$`));
    expect(frameToLines(plainSlideView(deck, content, 80, 24, { blackout: true })).join('')).toBe('');
  });

  it('ordbryting deler lange ord uten å miste tegn', () => {
    expect(wrapWords('a bb ccc', 4)).toEqual(['a bb', 'ccc']);
    expect(wrapWords('abcdefghij', 4).join('')).toBe('abcdefghij');
  });
});
