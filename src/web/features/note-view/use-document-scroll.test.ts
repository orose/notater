import { describe, expect, it } from 'vitest';
import { onlyOverlayChanged } from './use-document-scroll';

const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

describe('useDocumentScroll: overlegg-parametre (ADR-010 §8, AR-2-21)', () => {
  it('bare `lysbilde` endret ⇒ ingen rulling', () => {
    expect(onlyOverlayChanged(at('/v/t/A'), at('/v/t/A', '?lysbilde='))).toBe(true);
    expect(onlyOverlayChanged(at('/v/t/A', '?lysbilde=tittel'), at('/v/t/A', '?lysbilde=plan-q1'))).toBe(true);
    expect(onlyOverlayChanged(at('/v/t/A', '?type=terminal&lysbilde=x'), at('/v/t/A', '?type=terminal'))).toBe(true);
  });
  it('annen sti, hash eller øvrig query ⇒ vanlig rulling', () => {
    expect(onlyOverlayChanged(at('/v/t/A'), at('/v/t/B'))).toBe(false);
    expect(onlyOverlayChanged(at('/v/t/A'), at('/v/t/A', '', '#x'))).toBe(false);
    expect(onlyOverlayChanged(at('/v/t/A', '?a=1'), at('/v/t/A', '?a=2&lysbilde='))).toBe(false);
  });
});
