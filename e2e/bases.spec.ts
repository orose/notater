// Bases (slice 3–4) – e2e kommer når backend/frontend leverer Bases. Fasit: docs/test/bases-fasit.md / .json.
// Markert som skip med referanse, slik at sporbarhetsmatrisen viser hullet.
import { test } from './support/guards';

const SLICE = 'Bases: slice 3 (tabell) / slice 4 (kanban) – se docs/test/bases-fasit.md og teststrategi §4';

test.describe('Bases (venter på slice 3–4)', () => {
  test.skip(true, SLICE);
  test('Domene.base == bases-fasit §1 (12 rader)', () => undefined);
  test('Oppgaver.base Huskeliste/Kanban/Arkiv == fasit (13 / 17 / 4)', () => undefined);
  test('Sprintoversikt inline-blokker 1–4 (Kritisk 4, Team 5 kort, Med feil 18 + advarsel, ugyldig YAML-kort)', () => undefined);
  test('![[Oppgaver.base#Kanban]] viser bare Kanban (QA-EMB-10, PO-12)', () => undefined);
  test('![[X.base#Ukjent]] → advarselskort med liste over views (PO-34)', () => undefined);
  test('Faner tastaturnavigerbare (role=tablist), kanban skrivebeskyttet (B1)', () => undefined);
  test('AK19 axe på Oppgaver.base (alle tre faner), lys/mørk', () => undefined);
});
