import { describe, expect, it } from 'vitest';
import { parseFrontmatter, splitFrontmatter } from './frontmatter';

describe('splitFrontmatter', () => {
  it('skiller ut YAML og brødtekst', () => {
    expect(splitFrontmatter('---\na: 1\n---\n# Tittel\n')).toEqual({ yaml: 'a: 1', body: '# Tittel\n' });
  });

  it('CRLF og tom frontmatter', () => {
    expect(splitFrontmatter('---\r\n---\r\nx')).toEqual({ yaml: '', body: 'x' });
  });

  it('kun frontmatter uten avsluttende linjeskift', () => {
    expect(splitFrontmatter('---\ntags: [qa]\n---')).toEqual({ yaml: 'tags: [qa]', body: '' });
  });

  it('uavsluttet frontmatter = ingen frontmatter (QA-IDX-08)', () => {
    const src = '---\ntags: [qa]\nstatus: todo\n\n# Uavsluttet';
    expect(splitFrontmatter(src)).toEqual({ yaml: null, body: src });
  });

  it('--- som ikke står først er ikke frontmatter', () => {
    expect(splitFrontmatter('\n---\na: 1\n---\n').yaml).toBeNull();
  });
});

describe('parseFrontmatter', () => {
  it('parser YAML 1.2 core – datoer forblir strenger', () => {
    expect(parseFrontmatter('dato: 2026-11-05\ntall: 42\nliste: [a, b]')).toEqual({
      data: { dato: '2026-11-05', tall: 42, liste: ['a', 'b'] },
      error: null,
    });
  });

  it('ugyldig YAML gir feil, ingen data (QA-IDX-07)', () => {
    const result = parseFrontmatter('tittel: "uavsluttet streng\ntags: [qa, ugyldig\nstatus: todo\n  feil: innrykk: her');
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/kunne ikke leses/);
  });

  it('YAML som ikke er et objekt regnes som ugyldig', () => {
    expect(parseFrontmatter('- a\n- b').data).toBeNull();
    expect(parseFrontmatter('').data).toEqual({});
  });
});
