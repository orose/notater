# Akseptanserapport v2 – presentasjonsmodus

Eier: QA. Dato: 2026-11-09. Grunnlag: `docs/produkt/v2-spesifikasjon.md` (AK-2-01 til -14), `docs/test/testplan-v2.md`,
ADR-010 og PO-84 til PO-105 i `docs/beslutninger.md`. Fasit: `docs/test/v2-fasit.json` og `test-vault/README-QA.md` §20.

**Konklusjon:** Alle 14 akseptansekriterier er **bestått** i de automatiske testene. Den avsluttende testen fant én ny
kosmetisk feil (BUG-015, lav) og bekreftet to punkter som allerede står i backloggen (PO-105). QA anbefaler at v2 går
til kundens test. Kundens egen sjekkliste står i §6.

## 1. Kjøringer

Kjørt på `E2E_PORT=4730` (perf: 4750) i containeren (Chromium, Linux), mot den ekte serveren og en temp-kopi av testvaultet.

| Kjøring | Resultat |
|---|---|
| Vitest (enhet og integrasjon) | **1020/1020** bestått |
| `npm run lint` og `npm run typecheck` | Grønne |
| Playwright, alle prosjekter (`desktop`, `mobil`, `mock-desktop`, `mock-mobil`; `perf` uten vault hoppes over) | **838 bestått, 0 produktfeil**, 339 hoppet over (prosjektspesifikke, f.eks. tastatur bare på desktop; perf uten `PERF_VAULT`). 8 tester i `ak01` og `ak02-03-19` feilet først med `ENOENT` i Playwrights artefaktmappe, fordi QA ved en feil startet en ekstra kjøring på samme port, som tømte mappa. De to filene ble kjørt på nytt alene: 61/61 bestått. |
| v2-filene, `desktop` + `mobil`, `--repeat-each=3` | **481 bestått, 2 ustabile**: TC-2-10-05 (tidsmåling i Node under full last) og TC-2-11-16 (klikk på lenke midt i inntoningen, 1 av 12). Begge er gjort robuste uten å svekke påstanden, se §1.2. Deretter 30/30 med `--repeat-each=15`. |
| Axe-matrisen i presentasjonsmodus (`v2-ak12-axe-matrise.spec.ts`) | **24/24** kombinasjoner, 0 brudd (×3 i repeat-kjøringen) |
| Ytelse (`--project=perf --workers=1`, 2000-vault `--seed 42`) | Alle krav holdt, se §3 |
| Ingen `test.fixme` igjen i `e2e/v2-*` | Bekreftet med `grep`. Én `test.fail` er åpen (BUG-015). |

### 1.1 Gjennomgang av frontendens endringer i QA-testene (PO-104)

| Test | Endring | QAs vurdering |
|---|---|---|
| TC-2-04-02 | `pre` i stedet for `pre, code` | Godtatt. Påstanden er skarpere (inline-koden `---` i avsnittet foran ga falsk treff). |
| TC-2-05-05 | Demping målt som annen farge, ikke lavere opasitet | Godtatt, fordi designsystemet demper med farge (WCAG). **Strammet inn av QA:** et tidligere punkt skal ha lavere kontrast mot bakgrunnen enn det gjeldende, og fortsatt ≥ 4,5 (AA). Den svakeste påstanden («bare en annen farge») kunne ellers vært oppfylt av en *sterkere* farge. |
| TC-2-07-05 | Tillater `status of 404` i konsollen | Godtatt. Det er samme unntak som `ak12-live-reload`: refetch etter sletting gir 404 med vilje. |
| TC-2-08-04 | Kode måles mot 24 lp, ikke 30 lp | Godtatt. `--slide-mono-min-lp = 24` er dokumentert i designsystemet §12.3 (gulv for mono, tabell, kanban og fotnoter). 30 lp (PO-86) gjelder brødtekst. |
| TC-2-09-01 | Regionen «Kanban: …» er selve `.kanban` | Godtatt. Påstanden er uendret («ingen horisontal intern rulling»), bare elementet er riktig. |
| TC-2-11-05 | Fullskjerm forlatt utenfra: presentasjonen fortsetter med toasten «Esc igjen avslutter» | Godtatt, følger PO-92. Påstanden er like sterk (toast, lysbilde 4 beholdt, og deretter avslutning). |
| TC-2-12-02 | Går ut av fullskjerm med `f` før vinduet endres | Godtatt. Vinduet kan ikke endre størrelse i fullskjerm (CDP). Resize mens man er i fullskjerm finnes ikke i praksis. |
| TC-2-12-14 | Venter på lysbilde 1 før `gg` | Godtatt (ventetid, ingen svekket påstand). |
| Perf (`målFraTast`) | Lytterne installeres og bekreftes før tastetrykket | Godtatt. Målepunktene er de samme (keydown, deretter DOM og to rammer). Det fjerner et kappløp i testen, ikke i produktet. |
| `v1.1-fasit.json` | Gruppen «Presentasjon» i `tastaturkart.grupper` | Godtatt (Q-16). |

QA er ikke uenig i noen av endringene.

### 1.2 Endringer QA har gjort i sluttesten

- **TC-2-01-02 «Plan Q1» var ustabil.** `settLeseposisjon` rullet før Mermaid var tegnet. Før tegningen er siden ~190 px
  høyere, og overskriften nådde leselinjen. Etter tegningen er siden rullet til bunnen med «Plan Q1» 337 px fra toppen
  (leselinjen ligger på 270 px). Hjelperen venter nå på stabil layout (`ventPåStabilLayout`: diagrammer tegnet, bilder
  lastet, høyden stabil) og *bekrefter* at overskriften står ved leselinjen. For en kort siste seksjon holder det at
  siden er rullet til bunnen og overskriften er den siste i øvre 75 % av vinduet. Det er samme regel som
  presentasjonen bruker nederst på siden. Ingen påstand er svekket: testen feiler nå hvis leseposisjonen ikke er
  oppnådd, mens den før kunne starte fra feil seksjon uten å merke det. 3 × 5 kjøringer er grønne.
- **Ny test TC-2-01-10:** rullet helt til bunnen starter `Space p` på siste seksjon (grønn).
- **TC-2-01-05** er uendret og strengt (`Esc` gir «Plan Q1» ved leselinjen), fordi lesevisningen får plass under siste
  seksjon (PO-87).
- **Ny test TC-2-05-10** (`test.fail`, BUG-015): egenskapene på tittellysbildet skal ikke krysse bunnlinjen.
- **TC-2-10-05:** «Space er neste uten leader-ventetid» måles nå i nettleseren (keydown → lysbilde 2 i DOM), ikke i
  Node. Grensen er fortsatt 350 ms. Med 4 workere og `--repeat-each=3` ga måling i Node 613 ms, som er Playwrights
  rundtur og ikke appens ventetid.
- **TC-2-11-16:** venter på at inntoningen av lysbildet er ferdig før lenken klikkes (`ventPåRoligLysbilde`). Ett av
  12 klikk rett etter lysbildebyttet ble ikke registrert. Det er neppe merkbart for en bruker (overgangen varer 150 ms),
  men det står under kjente begrensninger (§5).

## 2. Status per akseptansekriterium

| AK | Status | Bevis (testplanens TC-ID-er) |
|---|---|---|
| AK-2-01 Start/avslutt | **Bestått** | TC-2-01-01..10. `Space p` og `:presenter` fra topp, agendaoverskrift, lysbilde og bunn. `Esc` til seksjonen for gjeldende lysbilde (PO-87). Esc lukker dialog først. Ingen which-key. `.base` deaktivert. Ingen ny henting av dokumentet. |
| AK-2-02 Rekkefølge | **Bestått** | TC-2-02-00..05. Alle 8 fasitnotater og rapporten med embeds stemmer lysbilde for lysbilde (type, overskrift, agendapunkt og progresjon) med `v2-fasit.json`. Seksjonsembed avgrenset. Diskré alltid. Foldetilstand ignoreres. |
| AK-2-03 Lysbildenivå | **Bestått** | TC-2-03-01..08. h2, h3 og h4 stemmer med fasiten. Valget huskes per notat (også etter reload) og bare i `localStorage`. `:presenter auto` nullstiller. E475 for ugyldig argument og E486 for nivå som ikke finnes (PO-101). Ingenting skrives. |
| AK-2-04 `---` | **Bestått** | TC-2-04-01..04. `---` og `***` gir «(forts.)». `---` i kode deler ikke. Ingen tomme lysbilder. S7. |
| AK-2-05 Tittel/agenda/overgang | **Bestått** (BUG-015 åpen, kosmetisk) | TC-2-05-01..10. Ingress, properties og dato. Ingen tagger (PO-90). S6 på tittellysbildet eller som eget lysbilde. Agenda. Overganger med utheving og demping (kontrast < gjeldende, ≥ AA). `:agenda av` gjelder bare gjeldende presentasjon. |
| AK-2-06 Agendalinjen | **Bestått** | TC-2-06-01..05. På alle innholdslysbilder med utheving og progresjon, skjult ellers. Avkortet forrige · nåværende · neste ved 8 punkter og 1280×720. |
| AK-2-07 Live | **Bestått** | TC-2-07-01..05, med egen server per test. Omdøpt agendapunkt: posisjonen beholdes. Gjeldende lysbilde slettet: nærmeste nabo vises. Nytt lysbilde foran gjeldende. Endret innhold. Notatet slettet. |
| AK-2-08 For mye innhold | **Bestått** | TC-2-08-01..07. Krymping før splitting. «(forts.)». Alle 39 markører nøyaktig én gang og i rekkefølge. Listepunkter deles ikke. Kode og tabell ruller internt med fokuserbar flate. Diagram skaleres. Ingen avkutting i noe fasitnotat. |
| AK-2-09 Bases/Mermaid | **Bestått** | TC-2-09-01..05. Ekte `![[Oppgaver.base#Kanban]]` med 6 kolonner og 17 kort innenfor lerretet. Kanbanendring oppdateres live. Mermaid og tabeller tilpasset. Fotnoter nederst (A4). |
| AK-2-10 Taster | **Bestått** | TC-2-10-01..32. Alle neste- og forrige-taster, `gg`/`G`, klikker-taster, Space som «neste» (ikke leader), svart skjerm, oversikt, `:` (også norsk Shift+.), `?` med present-taster, fremdrift og touch. Registeret: present-modus dekker tabellen, P4 gjelder bare normal-modus (PO-84), P5 og Esc-regelen gjelder overalt. |
| AK-2-11 Fullskjerm/URL | **Bestått** (automatisk i Chromium) | TC-2-11-01..16. Fullskjerm av og på, `f` og `:fullskjerm`, avvist eller utilgjengelig fullskjerm uten feil, toast etter reload. `?lysbilde=<id>`, reload, dyplenker, Tilbake/Frem, ukjent id gir tittellysbildet (PO-91), lenke på lysbilde (PO-89). Safari og Firefox: manuelt (§6). |
| AK-2-12 Lerret/WCAG | **Bestått** | TC-2-12-01..20. 16:9 og letterbox uten sidescroll ved 1280×720, 1440×900, 1920×1080 og 390×844. Resize under presentasjon. Typografi i logiske px (40/30 lp). Kunngjøring, semantikk, fokus og redusert bevegelse. Axe 24/24. |
| AK-2-13 Ytelse | **Bestått** | TC-2-13-01..02, se §3. |
| AK-2-14 Regresjon | **Bestått** | Hele v1- og v1.1-suiten er grønn (§1). TC-2-14-01..03 og TC-2-P1-01..04: lesevisningen er urørt, frontmatter ignoreres, ingenting skrives (sjekksum og mtime, bare GET/HEAD). |

## 3. Ytelse

`PERF_VAULT=<2000-vault> E2E_PORT=4750 npx playwright test --project=perf --workers=1`.

| Måling | Resultat | Krav |
|---|---|---|
| **Start av presentasjon**, rapport med 20 embeds, 1920×1080, fra `Enter` i paletten (n=5) | median **254 ms**, maks 377 ms | < 500 ms (median, PO-102) |
| **Lysbildebytte** `j`/`k`/`gg`/`G` (n=61) | median **24 ms**, **p95 33 ms** | p95 < 100 ms |
| AK17 indeksering, serverens `indexMs` (5 kalde starter) | median 2292 ms | < 3 s |
| AK17 notatbytte uten prefetch (n=20) | p95 153 ms | < 200 ms |
| Folding (v1.1), enkeltfold p95 | 59 ms | < 200 ms |

## 4. Manuell gjennomgang (skjermbilder)

96 skjermbilder dekker hele `Statusmøte uke 45` (10 lysbilder) og `Månedsrapport oktober` (12 lysbilder), samt
oversikten. De er tatt i Tidsskrift × Papir × lys og Terminal × Fosfor × mørk, ved 1920×1080 og 1280×720.
Skjermbildene ligger utenfor repoet (QA-scratchpad, `v2-aksept/`). Vurdert mot `docs/design/prototype-v2.html`:

- **Stemmer med prototypen:**
  - Tittellysbilde: kicker, stor tittel, ingress i kursiv, egenskapskolonne og «Endret»-linje. Ingen folio og ingen
    fremdriftslinje (PO-95).
  - Agenda og overgang: §-nummer, prikkelinje til lysbildenummer, underpunkter under gjeldende punkt, gjeldende punkt
    i aksentfarge med strek.
  - Agendalinjen øverst med kapitéler og progresjon «2/2».
  - Bunnlinjen med notattittel, «7 / 10» og segmentert fremdrift per agendapunkt.
  - Kode med «Fig. 1»-hode, Mermaid med «Fig.»-tekst, tabeller med regler, fotnote nederst med strek.
  - Terminal: `~/presentasjon`, blokkmarkør, nummerert agenda («1 Siden sist |»), «02 /»-kicker.
  - Lik oppdeling ved 1920 og 1280 (logisk lerret).
- **Avvik og funn:**
  1. **BUG-015 (lav):** I Tidsskrift krysser bunnlinjen den siste egenskapen («presenter») på tittellysbildet når
     notatet har 6 egenskaper. Det gjelder både 1920 og 1280 og ses også i miniatyren i oversikten. Terminal er ikke
     rammet.
  2. **Kanban i statusmøtet ruller internt** («↓ 3 linjer til» ved 1920, «↓ 7 linjer til» ved 1280). Kolonnen «todo»
     har 7 kort. Det er kjent (PO-105) og skal forelegges kunden. Alle 6 kolonner er synlige, slik A3 krever («om
     mulig»).
  3. **Terminal 1280, kanban:** smale kolonner deler lange ord uten bindestrek («BetalingServiceT|est»). Kosmetisk, ikke
     registrert som feil. Forslag: `hyphens: auto` med `lang="nb"` i kortene.
  4. **Egenskaper med objekt-verdi** (`presenter: {niva: 2, …}`) vises som rå JSON (`{"niva":2,…}`). Det er samme
     visning som i notat-headeren, så det er konsistent. Det er P1-fella i testvaultet, ikke et realistisk tilfelle.
  5. **Hjelpetoasten** «Presentasjon: Esc avslutter · o oversikt · ? taster» ligger midt i bunnlinjen de første
     sekundene og dekker delvis bunnlinjen i Tidsskrift. Det er akseptabelt fordi den forsvinner, men kunden bør se det.
  6. «● live»-merke og kanban-glød fra prototypen er ikke laget (PO-105, backlog).

## 5. Kjente begrensninger

- **Testplattform:** e2e kjører i Chromium på Linux. Safari og Firefox er ikke automatisert. Keyboard Lock (Esc i
  fullskjerm) finnes bare i Chromium. I Safari og Firefox går første Esc ut av fullskjerm, og presentasjonen fortsetter
  med toasten «Esc igjen avslutter» (PO-92).
- **Fullskjerm i e2e:** headless Chromium godtar `requestFullscreen`, men nettleserens egen Esc-håndtering kan ikke
  testes. TC-2-11-05 simulerer den med `document.exitFullscreen()`.
- **Touch:** sveip og trykk er testet med emulert touch (Pixel 7). Ekte iPad og iPhone er ikke testet.
- **Mobil (390×844):** 16:9 i stående format gir et lerret som er ~219 px høyt. Det oppfyller spesifikasjonen, men er
  ikke ment for visning på telefon.
- **Mermaid-miniatyrer** i oversikten er en plassholder til diagrammet er tegnet (ADR-010).
- **BUG-015** er åpen (§4).
- **Klikk midt i inntoningen** (de første ~150 ms etter et lysbildebytte) på en lenke i lysbildet ble ignorert i 1 av
  12 forsøk i e2e. Frontend bør se på det (lav prioritet), f.eks. ved at `pointer-events` ikke slås av under
  overgangen.

## 6. Manuell sjekkliste for kunden

Bruk `Statusmøte uke 45` i testvaultet, eller et eget statusnotat.

**Teams/Zoom (deling av vindu, ikke skjerm)**
- [ ] Start med `Space p` i et vindu som deles. Fullskjerm skal ikke være nødvendig, og lerretet skal ha letterbox uten
      å bli kuttet.
- [ ] Les agendalinjen og en kodeblokk fra mottakersiden. Er teksten lesbar etter komprimering?
- [ ] Endre en oppgave i Obsidian under presentasjonen, og se at kanbankortet flytter seg uten at lysbildet byttes.

**Projektor eller ekstern skjerm (1920×1080)**
- [ ] `Space p` går i fullskjerm. `f` slår fullskjerm av og på uten å avslutte.
- [ ] Les fra bakerste rad: brødtekst, agendalinje, fotnoter og kanban.
- [ ] `b` eller `.` gir svart skjerm, og `j` gir bildet tilbake uten å bla.

**Presentasjonsklikker**
- [ ] Neste/forrige (`PageDown`/`PageUp`) blar.
- [ ] «Svart skjerm»-knappen (`.` eller `b`) virker.
- [ ] Klikkerens «start»-knapp (ofte `F5`) laster siden på nytt og fortsetter på samme lysbilde. En toast foreslår
      `f` for fullskjerm.

**Safari på Mac (norsk tastatur)**
- [ ] `:` (Shift+.) og `?` (Shift++) virker i presentasjonen.
- [ ] Første Esc i fullskjerm går ut av fullskjerm og viser «Esc igjen avslutter». Neste Esc avslutter og går til
      seksjonen for gjeldende lysbilde.
- [ ] `o` (oversikt) og piltaster virker. VoiceOver leser «Lysbilde n av N: ‹overskrift›» ved bytte.

**Fullskjerm generelt**
- [ ] Reload (⌘R) under presentasjon: samme lysbilde, uten fullskjerm, og toasten viser hint om `f`.
- [ ] Tilbake i nettleseren avslutter presentasjonen, og Frem går inn igjen på samme lysbilde.
