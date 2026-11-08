import { describe, expect, it } from 'vitest';
import { ESCAPE_SENTINEL, preprocessObsidian, stripSentinels } from './preprocess';

describe('preprocessObsidian – %%kommentarer%%', () => {
  it('fjerner inline-kommentar', () => {
    expect(preprocessObsidian('Synlig %%skjult%% tekst')).toBe('Synlig  tekst');
  });

  it('fjerner kommentarblokk over flere linjer', () => {
    const out = preprocessObsidian('Før\n\n%%\nHEMMELIG\n%%\n\nEtter');
    expect(out).not.toContain('HEMMELIG');
    expect(out).toContain('Før');
    expect(out).toContain('Etter');
  });

  it('uavsluttet kommentar skjuler resten av dokumentet (som Obsidian)', () => {
    expect(preprocessObsidian('a %% b\nc')).toBe('a ');
  });

  it('rører ikke %% i inline-kode', () => {
    expect(preprocessObsidian('Se `%%ikke kommentar%%` her')).toBe('Se `%%ikke kommentar%%` her');
  });

  it('rører ikke %% i inline-kode med doble backticks', () => {
    expect(preprocessObsidian('x ``a ` %%b%%`` y')).toBe('x ``a ` %%b%%`` y');
  });

  it('rører ikke %% i inngjerdet kodeblokk (``` og ~~~)', () => {
    const src = '```\n%%behold%%\n```\n\n~~~\n%%behold%%\n~~~';
    expect(preprocessObsidian(src)).toBe(src);
  });

  it('respekterer lengre gjerde med kortere gjerde inni', () => {
    const src = '````md\n```\n%%behold%%\n```\n````\n%%fjern%%';
    expect(preprocessObsidian(src)).toBe('````md\n```\n%%behold%%\n```\n````\n');
  });

  it('gjenkjenner kodeblokk inne i blokksitat/callout', () => {
    const src = '> ```\n> %%behold%%\n> ```';
    expect(preprocessObsidian(src)).toBe(src);
  });
});

describe('preprocessObsidian – escapes', () => {
  it('setter vaktpost etter escapet [ = # ! slik at Obsidian-syntaks ikke trigges', () => {
    expect(preprocessObsidian('\\[[x]]')).toBe(`\\[${ESCAPE_SENTINEL}[x]]`);
    expect(preprocessObsidian('\\==x\\==')).toBe(`\\=${ESCAPE_SENTINEL}=x\\=${ESCAPE_SENTINEL}=`);
    expect(preprocessObsidian('\\#tag')).toBe(`\\#${ESCAPE_SENTINEL}tag`);
  });

  it('lar dobbel backslash være', () => {
    expect(preprocessObsidian('\\\\[[x]]')).toBe('\\\\[[x]]');
  });

  it('stripSentinels fjerner vaktposter', () => {
    expect(stripSentinels(`a${ESCAPE_SENTINEL}b`)).toBe('ab');
  });
});
