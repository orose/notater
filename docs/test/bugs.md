# Bugliste – QA (slice 0–4)

Eier: QA. Funnet ved akseptansetester mot den **ekte** serveren (Playwright-prosjektene `desktop` 1440 px og
`mobil` 360 px, globalSetup med vault-kopi og fixture-mtimes, PO-17). Hver bug har en test som er merket
`test.fail(true, 'BUG-xxx …')`: suiten er grønn mens bugen finnes, og blir **rød** («expected to fail, but
passed») når bugen er rettet – da fjernes `test.fail`-linjen og bugen lukkes her.

Alvorlighet: **Høy** = bryter en Må-AK eller sikkerhet · **Middels** = AK delvis oppfylt / tydelig avvik fra fasit ·
**Lav** = kosmetisk, kanttilfelle eller sjelden race.

Reproduksjon generelt: `E2E_PORT=4418 npx playwright test` (porten kan velges fritt hvis flere kjører samtidig).

| ID | Alvorlighet | Tittel | AK / fasit | Sannsynlig eier | Status |
|----|-------------|--------|------------|-----------------|--------|
| BUG-008 | Middels | AK17: notatbytte p95 > 200 ms i 2000-vaultet | AK17, QA-KOD-12 | backend (dokument-API/rendering) + frontend | Åpen |
| BUG-009 | Middels | AK17: indeksering av 2000 notater > 3 s når maskinen er belastet | AK17, PO-4 | backend | Åpen (måleusikkerhet) |
| BUG-001 | Middels | «Ikke skrevet ennå»-siden mangler «Lenket fra» | QA-URL-07, PO-28, AK10 | frontend | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-003 | Middels | Ugyldig frontmatter: advarselen vises ikke | QA-IDX-07, QA-FM-04, PO-27 | frontend | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-004 | Middels | For lav kontrast på tall i taggskyen (lyst tema) | AK19, AK8 | frontend (tokens/CSS) | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-005 | Middels | Avkrysningsbokser i oppgavelister mangler tilgjengelig navn | AK19, QA-MD-04 | frontend (evt. backend i HAST) | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-006 | Middels | Åpent notat som slettes/omdøpes blir stående utdatert | AK12, QA-IDX-13 | frontend | Åpen |
| BUG-002 | Lav | Tilbakelenker fra properties merkes ikke «fra egenskap» | AK10, QA-LNK-04, PO-9 | frontend | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-007 | Lav | Endring mellom første lasting og SSE-tilkobling går tapt | AK12 | frontend | Åpen |

Ingen funn med alvorlighet **Høy**. Sikkerhet (AK20) er grønn: ingen traversal, ingen XSS, riktige headere.

---

## BUG-008 – Notatbytte p95 over 200 ms i 2000-vaultet

- **Alvorlighet:** Middels · **AK:** AK17 («notatbytte < 200 ms») · **Eier:** backend (først), frontend
- **Steg:** `node test-vault-tools/generate-large-vault.mjs --out <sti> --count 2000 --seed 42` →
  `PERF_VAULT=<sti> npx playwright test --project=perf`. Testen klikker 20 interne lenker og måler i nettleseren fra
  `click` til ny `h1` + `article` er i DOM og malt.
- **Forventet:** p95 < 200 ms.
- **Faktisk (2026-11-06, 4 kjerner, loadavg ≈ 17 pga. parallelle agenter):** n=20, median 207 ms, **p95 344 ms**, maks 348 ms.
  Kald `GET /document` alene (30 notater, curl-lignende fetch): median 189 ms, p95 541 ms – altså ligger mesteparten av tiden
  på serveren (rendering uten cache for notater som ikke er åpnet før) og resten i React-rendering.
- **Test:** `e2e/perf.spec.ts` › «AK17: notatbytte < 200 ms» (kjøres bare med `PERF_VAULT`; ikke `test.fail`,
  fordi målingen er miljøavhengig).
- **Forslag:** forhåndsrender/cache naboene til åpent notat, eller prefetch av `document` ved hover/fokus på lenker.

## BUG-009 – Indeksering > 3 s under belastning

- **Alvorlighet:** Middels · **AK:** AK17, PO-4 · **Eier:** backend
- **Steg:** som BUG-008, testen «AK17: indeksering av 2000 notater» (5 kalde starter, median av `indexMs`).
- **Forventet:** < 3 s (referanse-Mac), < 4,5 s i CI-container (teststrategi §2.6).
- **Faktisk:** varierer sterkt med last på maskinen (4 kjerner, delt med andre agenters dev-servere/tester).
  Måling 1 (lav last, 2026-11-05): bestått (< 3 s). Måling 2 (loadavg ≈ 5): `indexMs` 4831/5868/4527/3878/7182, median 4831 ms.
  Måling 3 (loadavg ≈ 17): `indexMs` 7279/3210/3093/4252/5650, median 4252 ms; fra prosess-start til klar median 4913 ms.
  Beste kalde start: 3093 ms – altså rett over kravet selv i beste fall på denne maskinen.
- **Merk:** må måles på referanse-Mac før slice 6 avsluttes. Ikke en sikker bug ennå.

## BUG-001 – «Ikke skrevet ennå»-siden mangler «Lenket fra» (PO-28) – RETTET

- **Status:** rettet av frontend 2026-11-06; testen gikk «expected to fail, but passed», `test.fail` er fjernet og testen står som regresjonstest.

- **Alvorlighet:** Middels · **AK:** AK10/QA-URL-07 · **Eier:** frontend
- **Steg:** åpne `/v/test/Finnes ikke`.
- **Forventet:** siden «Dette notatet er ikke skrevet ennå» viser «Lenket fra» med `Embed-test`,
  `Frontmatter-typer` (fra egenskap) og `Lenketest`. Backend leverer dette (`GET /api/vaults/test/backlinks?path=Finnes%20ikke`).
- **Faktisk:** ingen «Lenket fra»-seksjon; `MissingNotePage` kaller ikke backlinks-endepunktet.
- **Test:** `e2e/ak07-11-navigasjon.spec.ts` › ««ikke skrevet ennå» viser «Lenket fra» (QA-URL-07, PO-28)».

## BUG-003 – Ugyldig frontmatter: advarselen vises ikke (PO-27) – RETTET

- **Status:** rettet av frontend 2026-11-06; testen gikk «expected to fail, but passed», `test.fail` er fjernet og testen står som regresjonstest.

- **Alvorlighet:** Middels · **AK:** QA-IDX-07, QA-FM-04 · **Eier:** frontend
- **Steg:** åpne `edge/Ugyldig frontmatter`.
- **Forventet:** diskret advarsel «Egenskapene kunne ikke leses …». API-et sender `frontmatterError` og
  `warnings[{ code: 'invalid-frontmatter' }]`.
- **Faktisk:** brødteksten vises (riktig), men ingen advarsel; `warnings`/`frontmatterError` brukes ikke i `src/web`.
- **Test:** `e2e/ak14-16-innhold.spec.ts` › «ugyldig frontmatter: advarselen vises i UI».

## BUG-004 – For lav kontrast på tall i taggskyen (lyst tema) – RETTET

- **Status:** rettet av frontend 2026-11-06; testen gikk «expected to fail, but passed», `test.fail` er fjernet og testen står som regresjonstest.

- **Alvorlighet:** Middels · **AK:** AK19 (WCAG AA), AK8 · **Eier:** frontend (design-tokens)
- **Steg:** desktop, lyst tema (Tidsskrift/papir), åpne et notat; axe `color-contrast`.
- **Forventet:** ≥ 4,5:1.
- **Faktisk:** `<b>16</b>` i tagg-knappene (`#qa 16`, `#task 16`): 4,08:1 (`#7c7264` på `#f4eee2`, 11,2 px).
- **Test:** `e2e/ak02-03-19-tema-a11y.spec.ts` › «BUG-004 …». Kjente brudd filtreres i de øvrige axe-testene slik at
  nye brudd fortsatt feiler.

## BUG-005 – Avkrysningsbokser i oppgavelister mangler tilgjengelig navn – RETTET

- **Status:** rettet av frontend 2026-11-06; testen gikk «expected to fail, but passed», `test.fail` er fjernet og testen står som regresjonstest.

- **Alvorlighet:** Middels · **AK:** AK19 · **Eier:** frontend (evt. backend: `aria-label`/`aria-labelledby` i HAST)
- **Steg:** åpne `teknisk/Callouts` (oppgaveliste i callout), kjør axe.
- **Forventet:** 0 brudd (axe `label`, «critical»). Skjermleser skal lese oppgaveteksten for boksen.
- **Faktisk:** `li.task-list-item > input[type=checkbox][disabled]` uten label.
- **Test:** `e2e/ak02-03-19-tema-a11y.spec.ts` › «BUG-005 …».

## BUG-006 – Åpent notat som slettes/omdøpes blir stående utdatert

- **Alvorlighet:** Middels · **AK:** AK12, QA-IDX-13 · **Eier:** frontend
- **Steg:** åpne et notat, slett fila i vaultet (eller gi den nytt navn).
- **Forventet:** siden går over til «Dette notatet er ikke skrevet ennå» uten refresh.
- **Faktisk:** gammelt innhold blir stående. Serveren sender riktig SSE (`changed` med `type: 'removed'`) og
  `GET /document` gir 404; klienten beholder forrige data når refetch feiler med 404.
- **Test:** `e2e/ak12-live-reload.spec.ts` › «slettet notat som er åpent …».

## BUG-002 – Property-tilbakelenker merkes ikke «fra egenskap» (PO-9) – RETTET

- **Status:** rettet av frontend 2026-11-06; testen gikk «expected to fail, but passed», `test.fail` er fjernet.

- **Alvorlighet:** Lav · **AK:** AK10, QA-LNK-04 · **Eier:** frontend
- **Steg:** åpne `domene/Ordre`, se Tilbakelenker → `Frontmatter-typer`.
- **Forventet:** merket «fra egenskap» (`fromProperty: true` i API-et).
- **Faktisk:** vises som vanlig tilbakelenke med utdraget `lenkeliste: [[Ordre]]`.
- **Test:** `e2e/ak07-11-navigasjon.spec.ts` › «property-lenke merkes «fra egenskap» (PO-9)».

## BUG-007 – Endring mellom første lasting og SSE-tilkobling går tapt

- **Alvorlighet:** Lav · **AK:** AK12 · **Eier:** frontend (`LiveReloadProvider`)
- **Steg:** last et notat; endre en fil før `EventSource` har koblet til (testen holder igjen `/api/events`).
- **Forventet:** første `ready`-hendelse har høyere `revision` enn dataene som vises → invalidering.
- **Faktisk:** første `ready` lagrer bare revisjonen (`revision === null`), så endringen vises aldri før neste endring.
  Observert som sporadisk feil i live reload-testene før testen ble gjort deterministisk.
- **Test:** `e2e/ak12-live-reload.spec.ts` › «endring mellom første lasting og SSE-tilkobling går ikke tapt».
- **Forslag:** sammenlign `ready.revision` med `revision` i dokument-/tre-dataene, eller invalider alltid ved første `ready`.
