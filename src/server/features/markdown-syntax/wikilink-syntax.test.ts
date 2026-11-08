import { describe, expect, it } from 'vitest';
import { lastAnchorSegment, parseImageAlias, parseWikiLinkInner } from './wikilink-syntax';

describe('parseWikiLinkInner', () => {
  it('enkelt mål', () => {
    expect(parseWikiLinkInner('Ordre')).toEqual({ target: 'Ordre', anchor: null, alias: null });
  });

  it('alias, overskrift og blokk', () => {
    expect(parseWikiLinkInner('Ordre|ordrene våre')).toEqual({ target: 'Ordre', anchor: null, alias: 'ordrene våre' });
    expect(parseWikiLinkInner('Kafka#Leveransegarantier|garantiene')).toEqual({
      target: 'Kafka',
      anchor: 'Leveransegarantier',
      alias: 'garantiene',
    });
    expect(parseWikiLinkInner('Kafka#^offset-def')).toEqual({ target: 'Kafka', anchor: '^offset-def', alias: null });
  });

  it('lokal overskrift gir tomt mål', () => {
    expect(parseWikiLinkInner('#Brutte lenker')).toEqual({ target: '', anchor: 'Brutte lenker', alias: null });
  });

  it('trimmer mellomrom', () => {
    expect(parseWikiLinkInner(' Ordre | x ')).toEqual({ target: 'Ordre', anchor: null, alias: 'x' });
  });
});

describe('lastAnchorSegment', () => {
  it('bruker siste ledd av #A#B', () => {
    expect(lastAnchorSegment('A#B')).toBe('B');
    expect(lastAnchorSegment('^id')).toBe('^id');
  });
});

describe('parseImageAlias', () => {
  it('bredde, bredde×høyde og alt-tekst', () => {
    expect(parseImageAlias(null)).toEqual({ alt: null, width: null, height: null });
    expect(parseImageAlias('160')).toEqual({ alt: null, width: 160, height: null });
    expect(parseImageAlias('300x200')).toEqual({ alt: null, width: 300, height: 200 });
    expect(parseImageAlias('Arkitekturskisse|200')).toEqual({ alt: 'Arkitekturskisse', width: 200, height: null });
    expect(parseImageAlias('Bare alt')).toEqual({ alt: 'Bare alt', width: null, height: null });
  });
});
