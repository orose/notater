# Teststrategi – Vault-leser

Eier: QA. Gjelder v1 (slice 0–6 i `docs/produkt/brief.md`). Fasit: `test-vault/README-QA.md` (kanttilfeller, ID-er `QA-…`) og `docs/test/bases-fasit.md` / `bases-fasit.json`.

## 1. Prinsipper

1. **TDD (B5)**: testen skrives og feiler *før* implementasjonen. PR-er uten en test som feilet først avvises i review (vis det i commit-historikken eller PR-beskrivelsen).
2. **Fasiten er data, ikke kode**: tester leser `bases-fasit.json`, `fixture-mtimes.json` og ID-ene i `README-QA.md`. Endres testvaultet, endres fasiten i samme commit.
3. **Testvaultet er skrivebeskyttet**: tester som trenger mtimes, live reload eller endringer jobber på en **kopi** i en temp-mappe (`fs.cpSync(…, { recursive: true })`), aldri på `test-vault/` direkte (B1-ånd).
4. **Deterministisk**: `TZ=Europe/Oslo`, `LANG=nb_NO.UTF-8`, fast `Date` der det trengs, fixture-mtimes, seedet generator. Ingen nettverk (B10) – testene feiler hvis noe forsøker å gå ut.
5. **Konvensjoner som koden**: testfiler ligger ved featuren (`features/links/resolveLink.test.ts`), named exports, ingen `import * as` (B3/B4/B5). Testnavn på norsk, beskrivende: `it('løser alias med avvikende store/små bokstaver')`.
6. **Hver AK har minst én automatisert test**; noen har i tillegg en manuell sjekk (AK6 design, AK4 Mac).

## 2. Testpyramide

```
             ┌──────────────────────────┐
             │  E2E (Playwright)  ~40   │  AK-er sett fra brukeren, a11y, visuell, ytelse
           ┌─┴──────────────────────────┴─┐
           │ Integrasjon (Vitest)  ~60    │  HTTP-API mot ekte server + testvault-kopi
         ┌─┴──────────────────────────────┴─┐
         │ Enhet (Vitest)  300+             │  parser, lenker, tagger, bases, sanitering, stier
         └──────────────────────────────────┘
```

### 2.1 Enhetstester (Vitest, Node-miljø, < 5 s totalt)

| Område (feature) | Hva testes | Fasit/kilde |
|------------------|-----------|-------------|
| `frontmatter` | Gyldig/ugyldig/uavsluttet YAML, typer (tall, dato, boolsk, liste, nestet, null), `tags` som liste og skalar, `aliases` | QA-IDX-06..08, QA-FM-01 |
| `tags` | Frontmatter + inline; ikke i kode/inline-kode/kommentar/URL; `#2026` ikke tagg; nestet; case-insensitiv match; rekkefølge | QA-TAG-01..13 |
| `markdown` (parser/renderer) | Callouts (alle typer, alias, fold `+`/`-`, nesting, kode inni), highlight, kommentarer, fotnoter, oppgavelister (disabled), blokk-ID-er skjules, overskrift-slugs unike, kodeblokk-metadata (språk, `title`), LaTeX/dataview → «ikke støttet»-noder | QA-CAL-*, QA-MD-*, QA-KOD-*, QA-NS-*, QA-TOC-03/04 |
| `links` (oppløsning) | Alle 53 punkter i `lenker/Lenketest.md` som tabelltest (`it.each`), alias, case, sti-suffiks, NFC/NFD, tvetydighet, `.base`/`.canvas`/bilder, traversal → brutt | README-QA §4 |
| `links` (graf) | Tilbakelenker per mål (antall + kilder), property-lenker, embeds teller, kode teller ikke | README-QA «Tilbakelenker» |
| `embeds` | Hele notat, seksjon (til neste overskrift på samme/høyere nivå), blokk, listeblokk, syklus A↔B, selv-embed, kjede, maks dybde, brutt | QA-EMB-* |
| `bases/parse` | YAML → AST for filtre (`and`/`or`/`not`, nestet, strenguttrykk med `!`), formler, views; ukjente nøkler → advarsel; ugyldig YAML → feilobjekt | bases-fasit §3.3–3.4 |
| `bases/expr` | Tokenizer/parser for uttrykk: `file.inFolder()`, `file.hasTag()`, `file.ext/name/folder/mtime/tags`, `==` `!=` `<` `>` `<=` `>=`, `!`, strenglitteraler (enkle/doble), `if(c,a,b)`, navnerom `note.`/`formula.`/`file.`; ukjent funksjon → advarsel | brief «Bases» |
| `bases/evaluate` | Evaluering mot en *in-memory* indeks bygget fra `test-vault/` → sammenlign med `bases-fasit.json` (rader, grupper, rekkefølge, kolonner) | `bases-fasit.json` |
| `bases/sort` | Tall vs tekst (`10` > `2`), datoer, nb-kollasjon (Æ<Ø<Å, case-ufølsom), manglende sist i begge retninger, flere nøkler, stabil sortering | B2, B3 |
| `sanitize` | Hver payload i `edge/Sikkerhet – ondsinnet HTML.md` → forventet trygg HTML (snapshot), inkl. `javascript:` med entiteter/blandet case, `data:`, `style`, `<base>`, `<meta>` | QA-SEC-02..04 |
| `vault/paths` | Normalisering og avvisning: `..`, `%2e%2e`, `..%2f`, absolutt, `\`, NUL, symlink ut av vaultet; ignorering av `.obsidian`, `.trash`, alle dot-mapper | QA-URL-08, QA-IDX-03/04 |
| `config` | Konfigfil + env + CLI-flagg, prioritet, flere vaults, ugyldig sti → tydelig feilmelding | AK1, B6 |
| `search` | Rangering tittel > alias > innhold, diakritika, kommentarer ikke indeksert | QA-SOK-* |

Krav: dekningsgrad ≥ 90 % linjer for `links`, `bases`, `sanitize`, `vault/paths`; ≥ 80 % totalt. Dekning er et *signal*, ikke målet.

### 2.2 Integrasjonstester (Vitest, ekte server)

Oppsett per testfil: kopier `test-vault/` til temp → `sett-fixture-mtimes.mjs` → start server på tilfeldig port (`127.0.0.1:0`) med konfig som peker på kopien → `fetch` mot API-et → stopp og slett.

| Område | Eksempler |
|--------|-----------|
| Indeks | `GET` fil-tre: 80 notater, ingen dot-mapper; 9 ikke-md-filer tilgjengelige |
| Notat | `GET` notat (HTML/AST + frontmatter + TOC + utgående lenker + tilbakelenker) for et utvalg notater, inkl. NFD, `&`, parenteser, punktum |
| Baser | `GET` evaluert base for `Domene.base`, `Oppgaver.base` (hvert view), og inline-blokker i `Sprintoversikt.md` == `bases-fasit.json` |
| Filer | Bilder med riktig `Content-Type`; SVG med CSP + `nosniff`; 404 for manglende; traversal-forsøk (rå og URL-kodet, dobbelkodet) → 400/404 |
| Sikkerhet | Server lytter kun på `127.0.0.1` (forsøk på ikke-loopback-adresse feiler); ingen CORS for fremmede origins; CSP-header på HTML |
| Live reload | Endre/opprett/slett/omdøp fil i kopien → hendelse på SSE/WebSocket innen 1 s, oppdatert indeks, tilbakelenker og baser; mange raske endringer debounces |
| Konfig | Bytte vault via config (AK1), feil sti → tydelig feil og exit-kode ≠ 0 |
| Skrivebeskyttelse (B1) | Ingen endepunkt aksepterer `PUT`/`POST`/`PATCH`/`DELETE` mot vault; sjekksum av hele kopien før/etter testkjøringen er uendret |

### 2.3 E2E (Playwright, Chromium + WebKit)

WebKit er med fordi målplattformen er macOS/Safari-lignende (B7, AK4). Prosjekter: `desktop` (1440×900) og `mobil` (360×780, `isMobile`, touch). Temaer kjøres via `colorScheme: 'light' | 'dark'` og eksplisitt temavalg.

Globale fixtures i alle e2e-tester:
- `page.on('dialog')` → test feiler (fanger XSS, QA-SEC-01).
- `page.on('request')` → feiler hvis vert ≠ `127.0.0.1` (B10, QA-SEC-05).
- `page.on('console')` og `pageerror` → feiler på uventede feil.

### 2.4 Tilgjengelighet (AK19)

- `@axe-core/playwright` på et fast sett sider × temaer: `Velkommen`, `Kafka-grunnleggende`, `Callouts`, `Kodeblokker – alle språk`, `Mermaid-galleri`, `Oppgaver.base` (alle tre faner), søkedialogen åpen, 404-side. Regler: `wcag2a`, `wcag2aa`, `wcag21aa`. **0 brudd** er krav (ingen «kjente unntak» uten PO-godkjenning).
- Kontrast i **alle** kombinasjoner av typografisk sett × palett × lys/mørk (AK8): axe `color-contrast` på `Callouts` og `Kodeblokker` (syntaksfarger!) i hver kombinasjon.
- Tastatur: Playwright-test som kun bruker `Tab`/`Shift+Tab`/`Enter`/`Space`/`Esc`/piltaster for å: åpne søk (`Meta+K` / `Control+K`), navigere til et notat, følge en lenke, åpne en foldet callout, kopiere kode, bytte base-fane, forstørre/lukke mermaid. Synlig fokus verifiseres med skjermbilde av fokusert element.
- `prefers-reduced-motion: reduce` (`page.emulateMedia({ reducedMotion: 'reduce' })`): ingen CSS-animasjoner/transitions > 0 ms på callout-fold, sideoverganger, scroll (sjekk `getComputedStyle`).
- Manuell stikkprøve med VoiceOver (macOS) per slice 6: landemerker, overskriftshierarki, lenketekster, brutte lenker annonseres som brutte.

### 2.5 Visuell sjekk

- Playwright `toHaveScreenshot` på faste sider (`Velkommen`, `Callouts`, `Kodeblokker – alle språk`, `Mermaid-galleri`, `Oppgaver.base` Huskeliste + Kanban, `Lenketest`) i matrisen **lys/mørk × desktop/mobil × typografisk sett (Tidsskrift, Terminal-editorial)** = 8 varianter per side. Palettene testes med én side (`Callouts`) per palett for å holde antallet nede.
- Fonter er bundlet lokalt (B10) → stabile skjermbilder; `animations: 'disabled'`; mermaid ventes ferdig (`data-rendered`-attributt eller tilsvarende krok fra utviklerne).
- Baselines genereres på macOS (målplattform) og sjekkes inn; terskel `maxDiffPixelRatio: 0.01`.
- Automatisk layoutsjekk på mobil for **alle** notater i testvaultet: `document.scrollingElement.scrollWidth <= window.innerWidth` (AK5). Billig og fanger lange linjer, brede tabeller/bilder, dype stier.
- AK6 («distinkt, motiverende») kan ikke automatiseres: PO/kunde-gjennomgang av skjermbildematrisen per slice.

### 2.6 Ytelse (AK17)

| Måling | Metode | Krav |
|--------|--------|------|
| Indeksering | `node test-vault-tools/generate-large-vault.mjs --count 2000 --seed 42` → start server mot vaultet → mål tid fra start til «indeks klar» (logglinje eller `GET /api/health` med `indexedAt`/`indexMs`). Median av 5 kalde kjøringer. | < 3 s på referanse-Mac (Apple Silicon), < 4,5 s i CI-container |
| Notatbytte | Playwright: klikk lenke → `performance.mark` fra klikk til innhold synlig (utviklerne eksponerer `performance.measure('notatbytte')` eller vi måler med `waitForSelector`). 20 bytter blant tilfeldige notater + `Stor kodeblokk` + `Stort mermaid-diagram`. p95. | p95 < 200 ms (mermaid-tegning kan fullføres etter, men tekst/kode må være synlig) |
| Base | Åpne `Oppgaver.base` i 2000-vaultet (~300 oppgaver), bytt fane. | < 200 ms per fanebytte |
| Søk | `⌘K` + skriv 5 tegn i 2000-vaultet, tid til treffliste. | < 100 ms per tastetrykk |
| Live reload | Endre én fil i 2000-vaultet → synlig i nettleser. | < 1 s |
| Minne | RSS etter indeksering av 2000-vaultet. | Rapporteres (ingen hard grense i v1) |

Ytelsestestene kjøres som eget Playwright-prosjekt (`perf`), ikke på hver lagring, men alltid før slice 6 er ferdig og ved endringer i indeks/parser.

## 3. Sporbarhetsmatrise AK → test

| AK | Beskrivelse (kort) | Enhet | Integrasjon | E2E / annet | QA-ID-er |
|----|--------------------|-------|-------------|-------------|----------|
| AK1 | Ulike vaults via konfigfil | `config` | Start mot to ulike vault-kopier, bytt via config | Velg vault (hvis UI) | – |
| AK2 | Tema følger OS | – | – | `colorScheme: dark/light` → riktige tokens, mermaid/kode følger | QA-MER-02, QA-KOD-01 |
| AK3 | Manuell overstyring huskes | `theme`-store | – | Velg mørk med OS=lys → reload → fortsatt mørk; «system» gjenoppretter | – |
| AK4 | Kjører lokalt på Mac | – | – | Manuell: `npm start` på ren Mac (Node 22) per slice; WebKit-prosjekt i Playwright | – |
| AK5 | Mobilvennlig, ingen sidescroll | – | – | `mobil`-prosjekt: scrollWidth-sjekk på alle notater; kode/tabell/mermaid scroller internt | QA-KOD-07, QA-IMG-06, QA-MD-03/08, QA-IDX-10 |
| AK6 | Distinkt design | – | – | Skjermbildematrise + PO-gjennomgang | – |
| AK7 | Navigasjon via lenker | `links` | Notat-API gir oppløste lenker | Klikk gjennom Lenketest-punktene | README-QA §4 |
| AK8 | Temasystem 2 akser, AA | tokens-test (alle kombinasjoner definert) | – | axe-kontrast per kombinasjon; skjermbilder | QA-CAL-01 |
| AK9 | Ødelagte lenker tydelige, ikke stygge | `links` | – | Stil + tooltip + ikke-navigerende; visuell | Lenketest 29–35, 48; QA-EMB-08, QA-IMG-10 |
| AK10 | Tilbakelenker | `links` (graf) | Antall/kilder for 8 mål | Panel viser riktige, klikkbare | README-QA «Tilbakelenker» |
| AK11 | Stabile URL-er, frem/tilbake | `routing` (slug/encode) | Notat via URL for spesielle filnavn | Bokmerk/reload, `goBack`/`goForward` | QA-URL-01..07 |
| AK12 | Live reload | `watcher` (debounce) | Fil-hendelser → event | Endre fil i kopi → oppdatert uten refresh, scroll bevart | QA-IDX-13 |
| AK13 | ⌘K-søk, tastatur | `search` | Søke-API | Tastaturflyt | QA-SOK-* |
| AK14 | Kode: highlight, merke, kopier, tittel | `markdown` (meta) | – | Kopier → clipboard-innhold; tema-bytte | QA-KOD-* |
| AK15 | Mermaid følger tema, forstørr | – | – | Alle typer rendres, ugyldig gir feilkort, zoom-modal | QA-MER-* |
| AK16 | TOC, scroll-spy | `markdown` (overskrifter/slugs) | TOC i notat-API | Klikk/scroll i langt notat | QA-TOC-* |
| AK17 | 2000 notater < 3 s, bytte < 200 ms | – | Indekstid mot generert vault | `perf`-prosjekt | §2.6 |
| AK18 | Én kommando + README | – | – | CI-jobb: ren klon → `npm ci && npm start` → health OK innen 10 s; README-steg følges manuelt av QA | – |
| AK19 | WCAG AA, fokus, reduced motion | – | – | axe, tastatur, reduced-motion | §2.4, QA-CAL-05 |
| AK20 | Traversal, sanitering, 127.0.0.1 | `vault/paths`, `sanitize` | Traversal-API, bind-adresse, headers | Dialog-/request-vakter | QA-SEC-*, QA-URL-08, QA-IMG-12 |
| Bases | Begge kundebaser identisk med Obsidian | `bases/*` mot `bases-fasit.json` | Base-API == fasit | Tabell/kanban/faner rendres som fasit, mobil-scroll | `bases-fasit.md` |
| B1 | Skriver aldri til vault | – | Sjekksum før/etter, ingen skrivende endepunkt | Avkrysningsbokser/kanban ikke interaktive | QA-MD-04 |
| B10 | Ingen nettverk ut | – | – | Request-vakt; bundle-sjekk for eksterne URL-er (`grep` i `dist/`) | QA-SEC-05, QA-IMG-13 |

## 4. Definition of Done per slice

Felles for alle slices (fra brief): tester grønne · QA har verifisert mot AK · README oppdatert · kunden kan teste med én kommando. I tillegg:

**Felles QA-krav**
- [ ] Nye tester skrevet før implementasjon (B5), navngitt på norsk, ved featuren.
- [ ] `npm test` (enhet + integrasjon) grønn lokalt og i CI; ingen `.only`/`.skip` uten lenket sak.
- [ ] Relevante e2e-tester grønne i Chromium **og** WebKit, desktop **og** mobil.
- [ ] axe: 0 brudd på sidene sliceen berører.
- [ ] Ingen konsollfeil, ingen eksterne forespørsler, ingen dialoger i e2e.
- [ ] Endringer i testvault/fasit gjort i samme commit som testene.
- [ ] Antakelser dokumentert i `docs/beslutninger.md`; åpne **(PO?)**-punkter som berører sliceen er avklart.

| Slice | Spesifikk DoD (QA) |
|-------|--------------------|
| 0 Grunnmur | AK1, AK2, AK3, AK18, AK20 (sti/bind/sanitering) grønne. QA-IDX-01..08, QA-IDX-12. Grunnleggende markdown (QA-MD-01/02/05/08). `.obsidian`/`.trash` ignoreres. Skrivebeskyttelse (B1) verifisert med sjekksum. Server binder til `127.0.0.1`. |
| 1 Navigasjon | Alle 53 Lenketest-punkter, tilbakelenkefasit, QA-EMB-* (inkl. syklus), QA-IMG-*, QA-URL-*, AK7, AK9, AK10, AK11. NFD-notatet fungerer. Traversal i lenker/bilder. |
| 2 Teknisk innhold | QA-KOD-*, QA-MER-*, QA-CAL-*, QA-FM-*, QA-TOC-*, AK14, AK15, AK16. `Stor kodeblokk` < 200 ms. Ugyldig mermaid bryter ikke siden. Skjermbilder lys/mørk. |
| 3 Bases – tabell | `Domene.base`, Huskeliste og Arkiv == `bases-fasit.json` (enhet **og** integrasjon **og** e2e). Inline-blokk 1, 3, 4 i `Sprintoversikt.md`. `columnSize` på desktop, intern scroll på mobil. Advarsel ved ukjent funksjon/nøkkel uten krasj. Alle feilsøkingsnøkkel-symptomer i bases-fasit §5 er dekket av en test. |
| 4 Bases – kanban | Kanban-view og inline-blokk 2 == fasit, inkl. «(ingen)», ikke-oppførte verdier og kortfelter. Skrivebeskyttet (ingen drag). Mobil: kolonner scroller horisontalt internt eller stables (avklares med design). Faner tastaturnavigerbare (`role="tablist"`). |
| 5 Flyt | AK12 (live reload i kopi, inkl. omdøp/slett), AK13 (søk + full tastaturflyt), QA-SOK-*. Ingen minnelekkasje ved 50 påfølgende reloads (heap stabil ± 10 %). |
| 6 Polering | AK5, AK6 (PO-godkjent skjermbildematrise), AK8 (alle kombinasjoner AA), AK17 (perf-prosjektet grønt mot 2000-vault), AK19 (axe + tastatur + reduced motion + VoiceOver-stikkprøve). Full regresjon av alle QA-ID-er. |

## 5. Testdata

| Kilde | Bruk |
|-------|------|
| `test-vault/` | Håndskrevet fasit-vault (80 notater). Kopieres til temp før bruk. |
| `docs/test/fixture-mtimes.json` + `test-vault-tools/sett-fixture-mtimes.mjs` | Deterministiske mtimes på kopien (Arkiv-viewet). |
| `docs/test/bases-fasit.json` | Forventet resultat for alle baser/views. |
| `test-vault-tools/generate-large-vault.mjs` | 2000-notaters ytelsesvault, deterministisk via `--seed`. Skriver aldri inn i repoet (med mindre `--allow-in-repo`). |

Forslag til hjelpefunksjon i testkoden (arkitekten plasserer den): `lagVaultKopi({ mtimes: true }) → { sti, rydd() }`.

**Avvik fra arkitekturen som må løses:** `playwright.config.ts` (jf. `docs/arkitektur/struktur.md`) starter serveren direkte mot `./test-vault`. Da er Arkiv-viewet ikke deterministisk (mtime fra git-checkout), og live reload-tester ville skrevet i repoet. Forslag: Playwright `globalSetup` lager en kopi med fixture-mtimes og starter serveren med `--vault <kopi>`.

## 6. Plattformrisikoer å teste eksplisitt

| Risiko | Test |
|--------|------|
| macOS-filsystemet er case-**in**sensitivt; CI (Linux) er case-sensitivt | Lenkeoppløsning må være case-insensitiv i koden, ikke via filsystemet. Enhetstester kjører mot in-memory indeks. |
| macOS lagrer ofte filnavn i NFD | `edge/Årsrapport (NFD).md`; normaliser til NFC i indeksen, men bruk original sti mot disk. |
| `fs.watch` oppfører seg ulikt på macOS (FSEvents) og Linux (inotify); Obsidian skriver via temp-fil + rename | Live reload-test med atomisk skriving (skriv `.tmp` → `rename`) og med mange raske endringer. |
| Git bevarer ikke mtime | Fixture-mtimes. |
| Tidssone | `TZ=Europe/Oslo` i alle testkommandoer; datoer i YAML (`2026-11-08`) må ikke bli forskjøvet en dag ved UTC-parsing. |
