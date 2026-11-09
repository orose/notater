# Bugliste – QA (v1, slice 0–6)

Eier: QA. Funnet ved akseptansetester mot den **ekte** serveren (Playwright-prosjektene `desktop` 1440 px og
`mobil` 360 px, globalSetup med vault-kopi og fixture-mtimes, PO-17). Hver bug har en test som er merket
`test.fail(true, 'BUG-xxx …')`: suiten er grønn mens bugen finnes, og blir **rød** («expected to fail, but
passed») når bugen er rettet – da fjernes `test.fail`-linjen og bugen lukkes her.

Alvorlighet: **Høy** = bryter en Må-AK eller sikkerhet · **Middels** = AK delvis oppfylt / tydelig avvik fra fasit ·
**Lav** = kosmetisk, kanttilfelle eller sjelden race.

Reproduksjon generelt: `E2E_PORT=4418 npx playwright test` (porten kan velges fritt hvis flere kjører samtidig).

| ID | Alvorlighet | Tittel | AK / fasit | Sannsynlig eier | Status |
|----|-------------|--------|------------|-----------------|--------|
| BUG-008 | Middels | AK17: notatbytte p95 > 200 ms i 2000-vaultet | AK17, QA-KOD-12 | backend (dokument-API/rendering) + frontend | **Rettet** 2026-11-06 (BE26–BE31, PO-51): p95 141 ms uten prefetch, 107 ms med hover-prefetch |
| BUG-009 | Middels | AK17: indeksering av 2000 notater > 3 s når maskinen er belastet | AK17, PO-4 | backend | **Rettet** 2026-11-06 (BE26–BE28): median `indexMs` 2015 ms |
| BUG-001 | Middels | «Ikke skrevet ennå»-siden mangler «Lenket fra» | QA-URL-07, PO-28, AK10 | frontend | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-003 | Middels | Ugyldig frontmatter: advarselen vises ikke | QA-IDX-07, QA-FM-04, PO-27 | frontend | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-004 | Middels | For lav kontrast på tall i taggskyen (lyst tema) | AK19, AK8 | frontend (tokens/CSS) | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-005 | Middels | Avkrysningsbokser i oppgavelister mangler tilgjengelig navn | AK19, QA-MD-04 | frontend (evt. backend i HAST) | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-006 | Middels | Åpent notat som slettes/omdøpes blir stående utdatert | AK12, QA-IDX-13 | frontend | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-002 | Lav | Tilbakelenker fra properties merkes ikke «fra egenskap» | AK10, QA-LNK-04, PO-9 | frontend | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-007 | Lav | Endring mellom første lasting og SSE-tilkobling går tapt | AK12 | frontend | **Rettet** 2026-11-06 (verifisert i e2e) |
| BUG-010 | Lav | AK1-testen «to vaults» feilet med ERR_INCOMPLETE_CHUNKED_ENCODING | AK1 | **QA (testfeil)** | **Rettet** 2026-11-06 i testen |
| BUG-011 | Lav | README: e2e-kjøring når port 4318 er opptatt var ikke dokumentert; testhjelperen kunne i verste fall teste en annen server | AK18 | QA / README | **Rettet** 2026-11-06 |

**Status v1 (2026-11-06): ingen åpne bugs.** Ingen funn med alvorlighet **Høy** i noen runde. Sikkerhet (AK20) har vært grønn hele veien.

---

## BUG-008 – Notatbytte p95 over 200 ms i 2000-vaultet – RETTET

- **Status:** rettet 2026-11-06, verifisert i avsluttende akseptansetest (se `docs/test/akseptanserapport-v1.md`).

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

## BUG-009 – Indeksering > 3 s under belastning – RETTET

- **Status:** rettet 2026-11-06, verifisert i avsluttende akseptansetest (se `docs/test/akseptanserapport-v1.md`).

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

## BUG-006 – Åpent notat som slettes/omdøpes blir stående utdatert – RETTET

- **Status:** rettet 2026-11-06, verifisert i avsluttende akseptansetest (se `docs/test/akseptanserapport-v1.md`).

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

## BUG-007 – Endring mellom første lasting og SSE-tilkobling går tapt – RETTET

- **Status:** rettet 2026-11-06, verifisert i avsluttende akseptansetest (se `docs/test/akseptanserapport-v1.md`).

- **Alvorlighet:** Lav · **AK:** AK12 · **Eier:** frontend (`LiveReloadProvider`)
- **Steg:** last et notat; endre en fil før `EventSource` har koblet til (testen holder igjen `/api/events`).
- **Forventet:** første `ready`-hendelse har høyere `revision` enn dataene som vises → invalidering.
- **Faktisk:** første `ready` lagrer bare revisjonen (`revision === null`), så endringen vises aldri før neste endring.
  Observert som sporadisk feil i live reload-testene før testen ble gjort deterministisk.
- **Test:** `e2e/ak12-live-reload.spec.ts` › «endring mellom første lasting og SSE-tilkobling går ikke tapt».
- **Forslag:** sammenlign `ready.revision` med `revision` i dokument-/tre-dataene, eller invalider alltid ved første `ready`.

## BUG-010 – AK1-testen «to vaults» feilet med ERR_INCOMPLETE_CHUNKED_ENCODING – RETTET (testfeil)

- **Alvorlighet:** Lav · **AK:** AK1 · **Eier:** QA
- **Symptom:** `e2e/ak01-vault-indeks.spec.ts` › «to vaults i én konfig» feilet i vaktene med `Failed to load resource:
  net::ERR_INCOMPLETE_CHUNKED_ENCODING` (og ERR_CONTENT_LENGTH_MISMATCH / ERR_CONNECTION_REFUSED).
- **Årsak:** testen stoppet hjelpeserveren med `server.stop()` mens siden fortsatt var åpen mot den. SSE-strømmen
  (`/api/events`) og prefetch/font-forespørsler ble brutt midt i overføringen, og Chromium logget det som konsollfeil.
  Alle meldingene kom etter `stop()`; ingen kom mens serveren kjørte.
- **Vurdering:** **testfeil, ikke produktfeil.** Når en server stoppes midt i en strøm, er det ventet at klienten ser
  avbrutte tilkoblinger. Live-indikatoren i appen går til «frakoblet», slik den skal.
- **Retting:** testen navigerer siden til `about:blank` før `server.stop()`. Kjørt 3 × 2 prosjekter uten feil.

## BUG-011 – e2e på opptatt port – RETTET

- **Alvorlighet:** Lav · **AK:** AK18 · **Eier:** QA (testhjelper) / README
- **Funn i README-gjennomgangen:** hvis 4318 var opptatt, feilet `npm run test:e2e` med serverens melding «velg en annen
  port: npm start -- --port 4400», som ikke gjelder e2e. Dessuten kunne testhjelperen i verste fall godta en *annen*
  server som allerede svarte på porten.
- **Retting:** `e2e/support/real-server.ts` sjekker at porten er ledig før start og ber om `E2E_PORT=<port>`.
  README (Utvikling) viser `E2E_PORT=4418 npm run test:e2e` og hvordan ytelsestesten kjøres.

## BUG-012 – endringer rett etter oppstart går tapt – RETTET

- **Alvorlighet:** Middels · **AK:** AK12 (live reload) · **Eier:** backend
- **Funn (PO-76):** `vault-runtime.ts` setter status `ready` og starter chokidar (`ignoreInitial: true`) uten å vente på
  `watcher.ready`. En fil som opprettes i vinduet mellom «ready» og chokidars første skanning, regnes som «initial»
  og blir **aldri** indeksert (verifisert: 404 også etter 10 s). Det samme gjelder endringer i det vinduet.
- **Forslag:** sett `ready` først etter `watcher.ready`, eller kjør en ny skanning/diff når overvåkeren er klar.
- **Retting (backend, 9302a58):** vaultet meldes klart først når overvåkeren er klar.
- **Test:** proben i `ak12-live-reload` er fjernet; ny test «fil skrevet rett etter «ready» blir indeksert (BUG-012)».

## BUG-013 – omdøping delt over to SSE-batcher (PO-78) – RETTET

- **Alvorlighet:** Middels · **AK:** AK12, PO-49 · **Eier:** backend
- **Funn (PO-76):** under parallell last kom en flytting som `removed` (revisjon n) og `added` (revisjon n+1) i to
  batcher i stedet for én `renamed`; klienten viste da ikke «Notatet er flyttet til …».
- **Retting (backend, 9302a58):** omdøping kobles også over batch-grensen.
- **Test:** `ak12-live-reload` › «omdøping/flytting sender renamed …» (uendret), grønn med `--repeat-each=3`.

## BUG-014 – varsler legger seg oppå hverandre (toast, zen-hint, which-key) – RETTET

- **Alvorlighet:** Lav (kosmetisk, ikke funksjonelt) · **AK:** AK-1.1-05/AK5 · **Eier:** frontend/UX
- **Funn (akseptansetest v1.1, manuell skjermbildegjennomgang):** når to varsler vises samtidig, f.eks.
  `Space z` (zen-hint nederst) rett etterfulgt av `Space w` (toast «Full bredde»), tegnes de på samme sted.
  På 360 px dekker toasten zen-hintet så teksten («Trykk × øverst til høyre for å gå tilbake») ikke kan leses;
  which-key-panelet blir også delvis dekket av en toast som fortsatt vises. Skjermbilder:
  `desktop-*-06-zen-full-bredde.png`, `desktop-*-09-which-key.png`, `mobil-*-06-zen-full-bredde.png`.
- **Forslag:** stable varslene (én kø eller vertikal stabel), eller la en ny toast erstatte zen-hintet.


## BUG-015 – egenskapene på tittellysbildet flyter ned i bunnlinjen (Tidsskrift) – ÅPEN

- **Alvorlighet:** Lav (kosmetisk, men synlig for publikum) · **AK:** AK-2-05 (L1), AK-2-08 («ingen innhold kuttes») · **Eier:** frontend/UX
- **Funn (avsluttende akseptansetest v2, skjermbilder):** `Statusmøte uke 45` har 6 egenskaper. I Tidsskrift ved
  1920×1080 slutter egenskapskolonnen (`.t-props`) på y = 960, mens bunnlinjen med «Endret …» (`.t-foot`, 2 px kant)
  starter på y = 917. Linjen krysser den siste egenskapen («presenter»). Det samme skjer ved 1280×720. Terminal har
  egenskapene i en boks og er ikke rammet. Skjermbilder: `statusmote-tidsskrift-1920-01.png`,
  `statusmote-tidsskrift-1280-01.png` og miniatyren i `statusmote-tidsskrift-1920-oversikt.png`.
- **Test:** TC-2-05-10 (`test.fail`) i `e2e/v2-ak05-07-agenda.spec.ts`.
- **Forslag:** tittellysbildet måles som andre lysbilder (krymp egenskapslisten, eller begrens den til N rader med
  «+ k til»), eller egenskapskolonnen avsluttes over bunnlinjen.
