// Enkel fuzzy-matching for kommandopaletten (ADR-007 §4, AR-1.1-12). Ingen avhengighet (ADR-006).
// Rangering: eksakt > prefiks > ordstart > delstreng > delsekvens (med bonus for ordstart og
// sammenhengende tegn). Ren TS.

export interface FuzzyMatch {
  /** Høyere er bedre. 0 for tom spørring. */
  readonly score: number;
  /** Treffområder `[start, slutt)` i originalteksten (til utheving). */
  readonly ranges: ReadonlyArray<readonly [number, number]>;
}

/**
 * Små bokstaver og uten kombinerende aksenter (`é` → `e`), slik at `diskret` treffer `diskré`.
 * `ø`, `æ` og `å` er egne bokstaver og beholdes. Lengden bevares tegn for tegn (til treffområdene).
 */
export function normalizeForSearch(text: string): string {
  return [...text].map((ch) => ch.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').slice(0, 1) || ch.toLowerCase()).join('');
}

const WORD_BREAK = /[\s\-/–(),.:]/;

function merge(indices: readonly number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const i of indices) {
    const last = out[out.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else out.push([i, i + 1]);
  }
  return out;
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const q = [...normalizeForSearch(query.trim())];
  if (q.length === 0) return { score: 0, ranges: [] };
  const t = [...normalizeForSearch(target)];
  const text = t.join('');
  // Indeksene i `t` er tegn (kodepunkter); regn om til UTF-16-posisjoner i originalen for utheving.
  const offsets: number[] = [0];
  for (const ch of target) offsets.push((offsets[offsets.length - 1] as number) + ch.length);
  const toRanges = (ranges: ReadonlyArray<readonly [number, number]>) =>
    ranges.map(([s, e]) => [offsets[s] as number, offsets[e] as number] as const);
  const lengthPenalty = Math.min(100, t.length - q.length);
  const wordStart = (i: number) => i === 0 || WORD_BREAK.test(t[i - 1] as string);

  const qText = q.join('');
  if (text === qText) return { score: 1000, ranges: toRanges([[0, t.length]]) };
  if (text.startsWith(qText)) return { score: 800 - lengthPenalty, ranges: toRanges([[0, q.length]]) };

  // Delstreng: foretrekk et treff som starter et ord.
  let best: number | null = null;
  for (let i = 0; i + q.length <= t.length; i++) {
    if (!q.every((ch, k) => t[i + k] === ch)) continue;
    if (wordStart(i)) {
      best = i;
      break;
    }
    best ??= i;
  }
  if (best !== null) {
    return { score: (wordStart(best) ? 600 : 400) - lengthPenalty, ranges: toRanges([[best, best + q.length]]) };
  }

  // Delsekvens (mellomrom i spørringen hoppes over). Grådig, men foretrekker sammenhengende tegn og ordstart.
  const chars = q.filter((ch) => !/\s/.test(ch));
  const hits: number[] = [];
  let score = 100;
  let from = 0;
  for (const ch of chars) {
    const prev = hits[hits.length - 1];
    let found = -1;
    for (let j = from; j < t.length; j++) {
      if (t[j] !== ch) continue;
      if (found === -1) found = j;
      if ((prev !== undefined && j === prev + 1) || wordStart(j)) {
        found = j;
        break;
      }
    }
    if (found === -1) return null;
    if (prev !== undefined && found === prev + 1) score += 15;
    if (wordStart(found)) score += 20;
    score -= Math.min(10, found - from);
    hits.push(found);
    from = found + 1;
  }
  return { score: Math.max(1, Math.min(399, score)), ranges: toRanges(merge(hits)) };
}
