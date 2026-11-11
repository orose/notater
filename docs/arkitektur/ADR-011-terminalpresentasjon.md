# ADR-011: Presentasjon i terminalen – delt kjerne, frittstående prosess, egen cellerenderer

- Status: Vedtatt (arkitekt), 2026-11-11. Gjelder v3 (`docs/produkt/v3-spesifikasjon.md`, T1–T7, AK-3-01–13).
  Spesifikasjonen er bindende: **Mermaid og kanban tegnes ikke**, de vises som plassholdere (T3).
- Bygger på ADR-002 (HAST fra serveren), ADR-004 (indeks og live), ADR-005 (konfig), ADR-006 (avhengigheter),
  ADR-007 (register og tastaturmotor), ADR-009 (disposisjon) og ADR-010 (lysbildemodell og A2).
- Skjelett: `src/terminal/` (CLI-argumenter, terminalhygiene, tastedekoder, cellemodell med diff – kompilerer, har
  tester) og `npm run present` med en plassholderskjerm.
- Beslutningene er logget som AR-3-01 … AR-3-30 i `docs/beslutninger.md`.

## Kontekst

v3 skal vise **de samme lysbildene** som v2, i Ghostty, uten at web-serveren kjører (T7), og uten å duplisere logikk.
Det meste finnes allerede – men på feil sted for en Node-prosess:

| Behov | Finnes i dag | Problem for terminalen |
|---|---|---|
| Indeks, lenker, rendering til HAST, embeds, Bases | `src/server/features/*` (`VaultRuntime`, `getDocument`, `createBaseEvaluator`) | Ingen – rene funksjoner bak smale porter; HTTP er bare ett lag over (`create-app.ts`). |
| Live endringer | `watchVault` (chokidar) + `VaultRuntime.subscribe` | Ingen. |
| Tittel, sidenoter, disposisjon (S1) | `web/features/note-view/{leading-title,prepare-content}.ts`, `web/features/outline/build-outline.ts` | Ren TS, men under `src/web`. |
| Lysbildemodell (S1–S8, A2, id-er, posisjon) | `web/features/presentation/model/*` | Ren TS, men under `src/web`. |
| A2-algoritmen | `web/features/presentation/fit/fit-algorithm.ts` | **Ren funksjon over `Geometry`** – kan mates med rader i stedet for piksler. |
| Kommandokatalog, motor, fuzzy, `?`-grupper | `web/features/commands/model/*`, `web/features/keyboard/*` (unntatt `dom-guard.ts`) | Ren TS, men under `src/web`. |
| Farger | `docs/design/terminal/farger.json` (UX, generert fra `tokens.css`: roller, kode-tokens, kulører, ANSI-16-kart) | – |

### Målt oppstart i dag (4 kjerner, Node 22, varm disk, 2000-notatsvault fra `generate-large-vault.mjs`)

Skript i arkitektens kladd som gjør det CLI-en skal gjøre: importer server-features via `tsx`, `createVaultRuntime`,
`ready()`, `renderReady()`, `getDocument`, disposisjon, `buildSlideDrafts`, `finalizeDeck`.

| Steg | Tid |
|---|---|
| Node + tsx til første linje | 0,08–0,20 s |
| Import av server- og modellkode via tsx | 0,35–0,40 s (esbuild-bunt: ~0,01 s import, ~0,1 s lasting av pakker) |
| Indeksering (worker-pool, 2001 notater) | 2,31–2,36 s |
| Shiki etter indeksen, alle 41 språk | 0,42–0,44 s (med 3 språk: 0,07 s) |
| `getDocument` + disposisjon + kortstokk | 0,02 s |
| **Sum fra prosessstart** | **3,2–3,3 s** (+ ~0,2 s for `npm run`) |

Uten tiltak brytes AK-3-12 (< 3 s). Tiltakene står i §2.

## Beslutning 1: Delt kjerne i `src/core/` – flyttes, ikke dupliseres

### Hvorfor `src/core` og ikke `src/shared`

`src/shared` er etter struktur.md regel 5 **kun API-typer**. Det vi flytter er domenelogikk som verken kjenner DOM,
Node eller React. Ny regel: **`src/core` = ren TS uten plattform.** Den kan importere `src/shared/api-types`, `hast`-typer
og rene pakker (`github-slugger`), aldri `react`, `node:*`, `src/web`, `src/server` eller `src/terminal`.

Renheten håndheves maskinelt, ikke bare med ESLint:

- `src/core` legges i **både** `tsconfig.web.json` (DOM, ingen Node-typer) og `tsconfig.server.json` (Node, ingen DOM).
  Bruk av `document` feiler i server-prosjektet; bruk av `process`/`Buffer` feiler i web-prosjektet.
- ESLint-blokk for `src/core/**`: `no-restricted-imports` (`react`, `react-dom`, `node:*`, `**/web/**`, `**/server/**`,
  `**/terminal/**`) og ingen `globals` (verken browser eller node), så `no-undef` tar resten.
- Vitest: `src/core/**/*.test.ts` kjøres i `server`-prosjektet (node-miljø). En kjernetest som trenger jsdom, hører ikke
  hjemme i kjernen.

Avhengighetsretning: `web → core`, `terminal → core + server/features`, `core → shared`. Serveren importerer ikke core
(trenger det ikke).

### Hva som flyttes (eksakt)

| Fra (`src/web/features/…`) | Til (`src/core/…`) | Merknad |
|---|---|---|
| `note-view/leading-title.ts` (+ test) | `hast/leading-title.ts` | `splitLeadingTitle` |
| `note-view/prepare-content.ts` (+ test) | `hast/prepare-content.ts` | `prepareContent` (sidenoter, oppgaver) |
| tre identiske `inlineText` (leading-title, prepare-content, build-outline) | `hast/inline-text.ts` | Én implementasjon. Eneste logikkendring i flyttingen – rene kopier, verifisert identiske. |
| `outline/build-outline.ts` (+ 2 tester) | `outline/build-outline.ts` | `buildOutline`, `hiddenBlocks`, typer. React-delene (`FoldingProvider`, `use-outline` …) blir i web. |
| `presentation/model/*` (alle filer, `fixtures/`, tester) | `presentation/model/*` | Uendret innhold. |
| `presentation/fit/{fit-algorithm,fit-types,fingerprint,fit-cache}.ts` (+ tester) | `presentation/fit/*` | `CANVAS` blir igjen i web (`fit/canvas.ts`) – det er lerretets mål, ikke algoritme. `layout-version.ts`, `MeasureCanvas.tsx` blir i web. |
| `prepare()` og `levels()`-beregningen i `presentation/PresentationProvider.tsx` | `presentation/prepare-source.ts`: `prepareSlideSource(doc)`, `presentationLevelInfo(source)` | **Viktigst for «én lysbildemodell»:** veien `NoteDocument → splitLeadingTitle → prepareContent → buildOutline(discreet=true) → fromOutline` finnes ett sted. Web og terminal kaller samme funksjon. |
| innholdsdelen av `draftKey()` i `PresentationProvider.tsx` | `presentation/fit/fingerprint.ts`: `draftContentKey(draft, deck, subtitles, doc)` | Web legger til `LAYOUT_VERSION\|typeset`, terminalen `cols×rows\|tetthet`. |
| `properties/ingress.ts`, `properties/format.ts` (+ test), `formatBaseDate` fra `bases/BaseCell.tsx` | `format/{ingress,format,base-date}.ts` | Tittellysbildet og Bases-tabellen i terminalen trenger samme tekst. |
| `keyboard/{modes,key-notation,key-input,key-policy,key-engine}.ts` (+ tester) | `keyboard/*` | `dom-guard.ts` (+ test) blir i web. |
| `commands/model/*` (+ tester) | `commands/*` | Leses også av `scripts/docs-shortcuts.ts`. |

Web-featurenes `index.ts` re-eksporterer fra kjernen (navngitt, ingen `export *`), så **web-komponentene og deres
importer endres ikke** utover featurenes egne interne filer. Re-eksport er ikke duplisering: det finnes én implementasjon.

### Rekkefølge (slice 3-a, første PR, før terminalkode som bruker kjernen)

Hvert trinn er én commit med `git mv` + endrede importstier, **ingen logikkendring** (unntatt `inlineText`-sammenslåingen
i K2), og grønt på `npm test`, `npm run lint`, `npm run typecheck`, `npm run docs:shortcuts` (sync-testen) og
`npm run build` før neste trinn. Antall Vitest-tester er det samme før og etter (i dag 1042) – QA kan kontrollere det.

| Trinn | Innhold |
|---|---|
| K1 | `src/core/` med tsconfig- (web + server, tooling får `src/core/commands` og `src/core/keyboard` i stedet for web-stiene), Vitest- og ESLint-oppsett. |
| K2 | `core/hast` (+ felles `inlineText`), `note-view/index.ts` re-eksporterer. |
| K3 | `core/outline`, `outline/index.ts` re-eksporterer. |
| K4 | `core/presentation` (modell, fit uten `CANVAS`, `prepare-source.ts`, `draftContentKey`) og `core/format`. `PresentationProvider` kaller `prepareSlideSource`/`presentationLevelInfo`. `scripts/presentation-fixtures.ts` får ny `OUT`. |
| K5 | `core/keyboard` og `core/commands`. `scripts/docs-shortcuts.ts` (+ test) og `tsconfig.tooling.json` peker på kjernen. QA oppdaterer `REGISTER_FIL` i `e2e/support/keymap-rules.ts` i samme PR. |
| K6 | Katalogutvidelsen for terminalen (§6: `surfaces`, `surfaceBindings`, nye kommandoer) – egen commit, så flyttediffen er ren. |

Risiko: flyttingen berører mange importer mens UX og QA jobber parallelt. Den tas derfor **først** i 3-a, som én kort
PR, og ingen andre endringer i de flyttede filene slippes inn i mellomtiden.

## Beslutning 2: Frittstående CLI-prosess som bruker server-featurene direkte (T7)

### Komposisjonsrot

`src/terminal/app/` er en tredje komposisjonsrot ved siden av `src/server/main.ts` og `app/create-app.ts`. Den bruker
featurenes offentlige `index.ts` og **ingen HTTP**:

```
parsePresentArgs(argv) ─ resolveConfig(delte flagg)              (ADR-005, uendret presedens)
      │
createVaultRuntime(vault, deps)        ← ett vault, ikke registeret
  deps.createInitialExtractor = createWorkerMetaExtractor()      (samme worker-pool)
  deps.incrementalExtractor   = createInlineMetaExtractor()
  deps.watch                  = watchVault                        (chokidar i prosessen, ADR-004)
  deps.highlighter            = terminalens Shiki (startet ved t0, få språk, se M1)
  deps.background             = false                             (ingen søkeindeks/forhåndsrendering, SV1)
      │ ready() → renderReady()
getDocument(state, docPath, createBaseEvaluator(), { hiddenProperties })   → NoteDocument (som API-et, uten JSON)
      │
prepareSlideSource(doc) → buildSlideDrafts → terminalgeometri → fitDraft → finalizeDeck     (core, §1/§4)
      │
runtime.subscribe(ChangedEvent) → samme vei på nytt → resolveSlide                        (§7)
```

`getDocument` returnerer nøyaktig strukturen API-et serialiserer (sanert HAST med embeds, `toc`, `properties` med
skjulte filtrert, `bases` evaluert, bildedimensjoner). Terminalen behandler den som uforanderlig, slik web gjør med
query-cachen.

### Serverendringer (små, bakoverkompatible, backend eier dem)

| # | Endring | Hvorfor |
|---|---|---|
| SV1 | `VaultRuntimeDeps.background?: boolean` (standard `true`). `false` = ingen søkeindeks og ingen forhåndsrendering. | Terminalen viser ett notat; bakgrunnsarbeid stjeler CPU fra start og bytte. |
| SV2 | `createCodeHighlighter({ preload?: readonly string[] })` + `CodeHighlighter.ensureLanguages(langs): Promise<void>`. Ukjent/ikke lastet språk i `highlight()` gir ren tekst som i dag. | 41 grammatikker koster ~0,44 s; notatet trenger typisk 1–4. |
| SV3 | Valgfri `onProgress(done, total)` i `buildSnapshot`/`VaultRuntimeDeps`. | Fremdrift på oppstartsskjermen (M3). |

### Oppstartstid (AK-3-12) – tiltak

| # | Tiltak | Effekt (målt/anslått) | Status |
|---|---|---|---|
| M1 | Shiki-kjernen (WASM) startes ved t0, parallelt med workerne; grammatikker lastes for språkene i notatet og embed-målene (fra `NoteMeta`, dybde ≤ 4) med `ensureLanguages` før rendering, og på nytt ved live endring. | −0,35 til −0,40 s | Vedtatt (SV2) |
| M2 | `npm run present` = `node scripts/present.mjs`: ren JS som sjekker Node (som `check-node.js`), bygger `dist/terminal/present.mjs` med esbuild **bare hvis kilden er endret** (samme mønster som `build-if-changed.ts`), og importerer bunten. Ingen tsx i kjøringen; fontfilene kopieres ved siden av bunten. | −0,2 til −0,3 s | Vedtatt for 3-a. Skjelettet bruker tsx til tiltaket er målt. |
| M3 | Alternativ buffer og en oppstartsskjerm («Indekserer … 1 240 / 2 000») innen ~100 ms. | Opplevd ventetid; ikke målt tid | Vedtatt |
| M4 | To-fase-start: vis notatet når fillisten og notatets egne embeds er lest, evaluer Bases når full metadata er klar (live-veien tar oppdateringen). | Anslått −1 s | **Reserve.** Krever endring i `vault-runtime` og ny ADR-runde. Brukes bare hvis M1–M3 ikke holder. |

Anslag etter M1–M3 i måleoppsettet: 0,1 + 0,2 + 2,35 + 0,05 + 0,05 ≈ **2,75 s** (+ `npm` ~0,2 s). Det er innenfor, men
med liten margin; indekseringen er 85 % av tiden og skalerer med kjerner (kundens Mac har flere enn CI). Måling: QA tar
tiden fra prosessen startes til tittellysbildets tekst står i skjermbufferen (pty-harnessen, §8), median av 5 (som
PO-102). **Lysbildebytte < 50 ms** er ukritisk (§3: ferdig utlagte rammer, diff-skriving, ~1–5 ms).

## Beslutning 3: Egen, tynn cellerenderer på rå ANSI – ikke Ink

| Kriterium | Ink (React for terminal) | Egen renderer (valgt) |
|---|---|---|
| Tilpasning (A2) | Flexbox (Yoga) gir høyder først etter render; `fitDraft` måtte fått målinger via `measureElement` – et målepass som i web. | Oppsettet er en ren funksjon `(enheter, bredde) → linjer`; høyden er `lines.length`. `fitDraft` får `Geometry` direkte, uten render. |
| Kontroll over oppsettet | Tekstbryting via Inks egen wrapping; tabeller, kodegutter, figlet og rammetegn må bygges som strenger likevel. | Full kontroll: grafembredde, harde rammer, celle-for-celle-farge, OSC 8 per celle. |
| Ytelse (bytte < 50 ms) | Re-render av komponenttre + utdata skrevet om linjevis. Godt nok, men ikke styrbart. | Rammer forhåndsberegnes; bytte = diff av to cellerammer og én `write` (~1–5 ms ved 200×50). |
| Testbarhet | `ink-testing-library` gir siste ramme som streng (med eller uten ANSI). | Rammen *er* data (`Frame`): snapshot av tekst og målrettede stilsjekker uten ANSI-parsing; diffen testes separat. |
| ADR-006 | Ink 6 + ~20 transitive pakker (bl.a. `yoga-layout` med WASM, `react-reconciler`, `ws`, `es-toolkit`) – alle må være ≥ 21 dager, flere er store; mer i kundens Nexus. | Ingen nye runtime-pakker i skjelettet. Senere: `get-east-asian-width` (allerede i lockfila, flyttes fra transitiv dev til `dependencies`). |
| Teamet kan React | Ja – største fordel. | Mønsteret er kjent: ren `view(state) → ramme`, tilstand i en reduser, som en React-komponent uten hooks. |
| Alternativ buffer, raw mode, kitty-tastatur | Delvis (raw mode via `useInput`; alternativ buffer og CSI u må likevel håndteres selv). | Eksplisitt i `screen/` (skjelettet). |

**Valg:** egen renderer. Avgjørende er A2: med Ink måtte vi gjenoppfunnet målelerretet fra web i terminalen; med en ren
linjemodell er tilpasningen eksakt, deterministisk og testbar uten terminal. Avhengighetspolicyen trekker samme vei.

### Arkitekturen i renderen

```
stdin ─ decoder (keys/) ─ KeyInput ─ chordCandidates/createKeyEngine (core) ─ kommando ─ reduser (session/)
                                                                                       │ ny tilstand
                          view(tilstand, størrelse) → Frame (slides/, overlays/, memo per lysbilde) ┘
                                                     │
                          renderFrame(forrige, ny, { fargedybde, lenker }) → ANSI ─ stdout (én write per bytte)
```

- **Cellemodell** (`cells/`, skjelett): `Frame = cols × rows` celler `{ ch: grafem, width: 0|1|2, style }`. Stil er
  fg/bg (`default` | `rgb` | `ansi`), fet, dempet, kursiv, understreket, invers, `link`. Strenger med innbakte
  escape-sekvenser finnes ikke i modellen.
- **Diff** (`frame-diff.ts`, skjelett): første ramme og ny størrelse tegnes helt; ellers bare endrede celleløp med én
  markørflytting hvert. Skjermen tømmes aldri mellom lysbilder (ingen blink).
- **Forhåndsberegning:** etter hvert bytte legges gjeldende ± 1 lysbilde ut i ledig tid (`setImmediate`); et bytte er
  da bare diff + skriving.
- **Tegning koalesceres**: flere tilstandsendringer i samme tikk gir én ramme.

### Terminalhygiene (AK-3-11) – `screen/` (skjelett, testet)

- **Inn** (bindende rekkefølge): raw mode → alternativ buffer (`CSI ?1049h`) → skjul markør (`?25l`) → autowrap av
  (`?7l`, så siste kolonne kan skrives uten rulling) → bracketed paste (`?2004h`) → kitty-tastatur (`CSI >1u`) hvis
  terminalen svarer på spørringen (§6). **Ut** i omvendt rekkefølge, pluss `CSI 0m`.
- Gjenopprettingen skrives **synkront** (`fs.writeSync(1)`), så den kommer ut også fra `uncaughtException`,
  `unhandledRejection` og `process.on('exit')`, der asynkrone skriv går tapt. `close()` er idempotent.
- **Ctrl c**: raw mode slår av `ISIG`, så Ctrl c kommer som tasten `0x03` (eller `CSI 99;5u`) og er en vanlig binding
  (avslutt). SIGINT/SIGTERM/SIGHUP utenfra (f.eks. `kill`, lukket vindu) gjenoppretter og gir exit 130/143/129. Ukjent
  feil: gjenopprett, *deretter* stakk til stderr (synlig i hovedbufferen), exit 1. stdin `end` og EPIPE avslutter.
- **Ctrl z** (suspend) støttes ikke i v3: byten er ubundet. (Ville krevd gjenoppretting før SIGTSTP og ny inngang ved
  SIGCONT – lite, men utenfor spesifikasjonen.)
- Ikke-TTY (rør, CI) gir en norsk melding og exit 1. Det finnes ingen testmodus som omgår det (e2e kjører i en ekte pty, §8).
- **Resize**: `stdout` `'resize'` (SIGWINCH) koalesceres per tikk; ny størrelse ⇒ ny tilpasning og full omtegning.
  Under 80×24: én tydelig melding i stedet for lysbildet (skjelettet har den).

### Terminalens evner (`capabilities/`, 3-a)

| Evne | Avgjøres av (første treff vinner) |
|---|---|
| Fargedybde | `--farger terminal` ⇒ 16 farger · `NO_COLOR` ⇒ ingen (fet/understrek/invers) · `COLORTERM=truecolor\|24bit`, `TERM=xterm-ghostty\|xterm-kitty`, `TERM_PROGRAM=ghostty\|iTerm.app\|WezTerm` ⇒ truecolor · `TERM` med `256color` ⇒ 256 (nærmeste farge, `rgbTo256`) · ellers 16 |
| OSC 8-lenker | Samme kjente terminaler + `VTE_VERSION ≥ 5000`, `WT_SESSION`; ellers av (lenketeksten vises uten mål) |
| Kitty-tastatur | Svar på `CSI ?u` før DA1-svaret (`CSI c`), tidsavbrudd 150 ms |
| Lys/mørk («system») | OSC 11-svar (bakgrunnens luminans), samme tidsavbrudd; ellers mørk |

Svarene leses av tastedekoderen som `reply`-hendelser (skjelettet), aldri som taster.

## Beslutning 4: Fra HAST til celler

### Trinn

```
Slide (core: enheter, overskrift, fotnoter, scrollUnits)
  │ toBlocks(units, { doc, theme })                       draw/blocks.ts   – HAST → terminalblokker (ren)
  ▼
TBlock = paragraph | heading | list | quote | callout | code | table | base | embed | placeholder | rule | error
  │ layoutBlock(block, width, theme) → Line[]              draw/layout-*.ts – reflow og rammer (ren, målbar)
  ▼
Line = Run[] (tekst + CellStyle), bredde ≤ width per konstruksjon
  │ paint(lines, frame, rect, scrollOffset)                 slides/paint.ts
  ▼
Frame
```

Alt før `paint` er rene funksjoner av `(enhet, bredde, tema)`, memoisert per enhet. Ukjente elementer tegnes som
barnas tekst (aldri krasj); ukjente `vr-*` som plassholder med elementnavnet i dempet tekst.

### Inline og tekst-reflow

- Bredde måles per **grafemklynge** (`Intl.Segmenter`): emoji med emojipresentasjon, VS16, ZWJ-sekvenser og flagg = 2;
  East Asian Wide/Fullwidth = 2; kombinerende tegn = 0; **Ambiguous (rammetegn, blokktegn) = 1**, som i vestlige
  terminaler og Ghostty (`cells/cell-width.ts`, testet med æøå, `A+U+0308`, 👩‍💻, 🇳🇴, 漢字, 한국어, ⚠/⚠️).
  Tabellen for Wide erstattes av `get-east-asian-width` i 3-b.
- Grådig linjebryting på bruddmuligheter: mellomrom, etter bindestrek/tankestrek og mellom brede (CJK) grafemer.
  NBSP (U+00A0) bryter ikke. Et ord lengre enn linjen deles mellom grafemer. Ingen orddeling.
- Stiler: `strong` fet · `em` kursiv · `code` `kode_bg` · `mark` `treff_bg` · `del` gjennomstreking (SGR 9, legges til i
  `CellStyle`) · intern lenke `lenke` · brutt lenke `lenke_brutt` + dempet · tagg `aksent2` med `#` · fotnotereferanse
  som hevet siffer (`¹²³`, bredde 1) · `br` = linjeskift. Fargerollene er UX' (`farger.json`), ikke arkitektens.
- **OSC 8** bare for eksterne lenker (`http`, `https`, `mailto`) og bare når terminalen støtter det. Interne lenker får
  lenkefarge uten mål (se spørsmål til PO).

### Blokker

| Blokk | Tegning |
|---|---|
| Avsnitt, overskrift i innhold | Reflow; overskrifter fet i `aksent`, nivå relativt til lysbildet som i web. |
| Lister | Hengende innrykk etter markøren; `ol` beholder `start` (A2-deler); oppgaver `☐`/`☒` (bredde 1). |
| Sitat | `│ ` i `strek` foran hver linje, innholdet reflowes innenfor. |
| Callout | Avrundet ramme `╭─ ikon Tittel ─╮ … ╰─╯` i typens kulør (UX' kart); ikon fra en hviteliste av tegn med bredde 1 (testes); innholdet reflowes innenfor rammen. Foldet callout tegnes som i web-lysbildet. |
| Kode (T4) | Fra serverens Shiki-HAST: `span[style="color: var(--shiki-token-X)"]` → `kode.X` i paletten (truecolor) eller ANSI-16-kartet i `farger.json`; `font-style: italic` → kursiv. **Ingen ny highlighting i terminalen**: samme tokenisering som web. Hode med språk/tittel som i web. Linjer reflowes ikke: myk bryting ved bredden med `↪` i dempet gutter, tab = 4 mellomrom, bakgrunn `kode_bg` over hele blokkbredden. |
| Tabell | Rammetegn `┌─┬─┐ │ ├─┼─┤ └─┴─┘`, overskriftsrad fet, justering fra `align`. Kolonnebredder: naturlig bredde → fordel overskudd/underskudd proporsjonalt ned til minimum (lengste ord, maks 12, min 6) og bryt celletekst. Får minimumsbreddene ikke plass: **kortvisning** (hver rad som en blokk med `Kolonne: verdi`). Horisontal overflyt er aldri grunn til å dele lysbildet. |
| Bases-tabell | `vr-base[data-base-id]` → `doc.bases[id]` (allerede evaluert). Første view som i web (`active = 0`), en fanelinje med alle views og det første uthevet. Tabell-view med samme tabellrenderer, verdier formatert med `core/format` (datoer `dd.MM.yyyy`, `✓`/`–`, tagger, lister); grupper som mellomoverskrifter; advarsler dempet under. |
| Plassholdere (T3) | `vr-mermaid` → «Mermaid-diagram – vises i web-leseren»; kanban-view → «Kanban: ‹view› – vises i web-leseren»; `img`/bilde-embed → `[bilde: navn]` (alt-tekst eller filnavn); `vr-unsupported` → samme tekst som web. Stiplet ramme i `dekor`, 1–3 rader. Aldri feil, aldri tom plass. |
| Embed (ikke-diskré) | Venstrestrek `▏` i `dekor` og kildelinje dempet; feilkort (`missing`/`cycle`/`depth-limit`) som én linje i `feil`. |
| Fotnoter (A4) | `Slide.footnotes` nederst i innholdsflaten over statuslinjen, etter en kort strek: `¹ tekst`, reflowet. |

### Lysbildet

| Sone | Innhold |
|---|---|
| Agendalinje (T6, rad 1) | Bare på innholdslysbilder: punktene, gjeldende uthevet, `index/count` innen punktet. Får den ikke plass: forrige · **nåværende** · neste med «…» (`DeckFit.compactAgendaLine`, beregnet én gang per kortstokk og bredde). |
| Overskrift | Nummerert (`02 /`) som i web, fet `aksent`; «(forts.)» fra modellen. |
| Innhold | Blokkene over, med én tom rad mellom blokker (tetthet, se under). |
| Statuslinje (siste rad) | Notattittel · diskré tastehint · `7/10`, bakgrunn `linje_bg`. |
| Tittel/agenda/overgang | Figlet-hode (§5); agenda med prikkede ledere og «du er her»; tittellysbildet med ingress, egenskaper og endringsdato (`core/format`). |

### Tilpasningen (A2) i rader og kolonner – samme algoritme som web

Terminalen leverer `Geometry` til **samme** `fitDraft`/`packUnits` (core) som web; bare målingen er annerledes:

```ts
measure(scale) = {
  available: rader − agendalinje − overskrift − statuslinje − fotnoter(utkastet),
  units: kumulative [top, bottom) = layoutBlock(enhet, innholdsbredde).length + mellomrom(scale),
  fits: sum ≤ available,
}
```

- **Skalatrinnene er tetthet**, ikke skrift: `TERMINAL_FIT_STEPS = [1, 0.5]`, der `1` = én tom rad mellom blokker og
  `0.5` = tett (ingen tomme rader mellom listepunkter og avsnitt). Terminalen har ingen skriftstørrelse; tettheten gir
  samme «krymp før du deler»-semantikk. UX kan sette trinnene til `[1]` (bare deling).
- `overflow` fra modellen gjelder uendret: `scroll` (kode, tabell, base, callout, sitat) får intern rulling når de alene
  er for store; `scale` (bilde, Mermaid) blir plassholdere med fast høyde og er aldri for store; PO-93/`ORPHAN_ROOM` gjelder.
- **Kontrollpass** som i ADR-010 trinn 5: etter pakkingen legges hver del ut med sine egne fotnoter og «(forts.)»; flyter
  en del likevel over, flyttes siste enhet videre. Høyst ett pass, deretter intern rulling – ingenting kuttes usynlig.
- Intern rulling: ruteområdet viser et vindu av blokkens linjer; `↑`/`↓` (`present.scrollUp/Down`) flytter; hint
  «↓ 38 linjer til» dempet (PO-97). Rulleposisjonen holdes per lysbilde-id i økten.
- **Cache:** `draftContentKey` (core) + `cols×rows` + `TERMINAL_LAYOUT_VERSION`. Endret størrelse ⇒ alle nøkler bommer ⇒
  hele kortstokken legges ut på nytt synkront (rene funksjoner; anslått < 30 ms for 20 utkast) før neste ramme.
  Palett og fargemodus endrer ikke oppsettet (AR-2-13 gjelder også her) og er ikke i nøkkelen.

## Beslutning 5: Figlet-hode – egen font, FIGlet-format, fast fallback-kjede

- **Egne fonter** laget av UX i standard FIGlet-format (`.flf`): `vr-blokk` (4 rader, halvblokker `█▀▄▌▐`, gir 8
  «piksler» i høyden) og `vr-smal` (3 rader). Lisens: prosjektets egen – ingen tredjepartsfont, ingen kreditering, ingen
  usikre opphav (populære fonter som «ANSI Shadow» har uklar lisens). Standardfontene fra FIGlet-distribusjonen (BSD)
  mangler æøå uansett.
- **Glyfsett:** A–Z, ÆØÅ, 0–9, mellomrom og `. , : ; ! ? - – / & ( ) ' " # % +`. Fontene er versaler; små bokstaver
  vises som store. Andre bokstaver: NFD uten aksent (`é → E`, `ü → U`). Mangler fortsatt et tegn (emoji, CJK): hele
  hodet faller tilbake til fet tekst – aldri blandet.
- **Lesing:** egen liten `.flf`-leser (~80 linjer: header, hardblank, endemerker, kodemerkede tegn for æøå), bare
  «full width»-oppsett (fontene tegnes med innebygd luft; ingen smushing). Ingen `figlet`-pakke.
- **Bundlet, uten nettverk:** `src/terminal/features/figlet/fonts/*.flf`, lest med `readFileSync(new URL(…, import.meta.url))`;
  `scripts/present.mjs` (M2) kopierer dem ved siden av bunten.
- **Farger:** tegn i `█▀▄▌▐` får `hode`, skyggetegn (`░▒▓` og rammetegn) får `hode_skygge` – UX velger glyfene.
- **Fallback-kjede** (AK-3-03), avgjort av bredde `cols − 2·marg` og høyde ≤ ⅓ av radene:
  1. `vr-blokk` på én linje → 2. `vr-blokk` ordbrutt over ≤ 2 linjer (≤ 3 på tittellysbildet når rader ≥ 36) →
  3. `vr-smal` ≤ 2 linjer → 4. fet tekst i `aksent` med strek under, reflowet. Kjeden er en ren funksjon og testes ved
  80×24, 120×36 og 200×50 med titlene i `test-vault/presentasjon/`.
- Ikke på innholdslysbilder (T5).

## Beslutning 6: Tastatur – samme katalog og motor, dekoder for stdin, `:`-linje i bunnen

### Fra bytes til kommando

1. `keys/decode-keys.ts` (skjelett, testet) gjør stdin om til `KeyInput`-formen fra ADR-007 §3: UTF-8-tegn (terminalen
   har allerede brukt tastaturoppsettet, så `:`, `?` og `ø` på norsk Mac kommer som tegn), C0-kontroll (Enter, Tab,
   Backspace, Ctrl+bokstav), CSI/SS3 med modifikatorparameter, **CSI u** (kitty-protokollen, flagg 1, som Ghostty
   støtter: Esc og Ctrl-taster blir entydige), `ESC x` = Alt, bracketed paste og terminalsvar.
2. Uten CSI u er en ensom ESC tvetydig: den tolkes som Escape etter **30 ms** (som vims `ttimeoutlen`). Med CSI u er
   Esc entydig og venter ikke.
3. `chordCandidates` → `createKeyEngine` (core, uendret) med modus `present` og terminalens tastaturkart. Shift er brukt
   opp i tegnet (`G`, `?`), Alt-tegn treffer aldri (P5) – som i web.
4. Gjentakelse: eldre terminaler sier ikke fra om holdt tast; alle trykk er nye trykk. Kommandoene tåler det (`G` er
   idempotent).
5. Mens et overlegg er åpent (`:`-linjen, oversikten, hjelpen, notatlisten) er motoren inaktiv (P7); overlegget eier
   tastene sine, som dialogene i web.

### Katalogen (K6)

- `CommandSpecBody.surfaces?: readonly ('web' | 'terminal')[]` (standard: begge) og
  `surfaceBindings?: { terminal?: Partial<Record<KeyMode, readonly BindingSpec[]>> }` (ekstra taster for én flate).
- `createCommandRegistry(surface, handlers)`: handlertypen krever bare kommandoene flaten har (typesjekket som i dag);
  `keymap()`, `shortcutGroups(platform, mode, surface = 'web')` og policytesten kjøres **per flate og modus**. README og
  `?` i web er uendret.
- Terminalens present-taster er v2-bindingene (`j → n Space PageDown`, `k ← p PageUp`, `gg`, `G`, `o`, `b .`, `↑ ↓`,
  `:`, `?`, `Esc`) pluss `surfaceBindings.terminal.present` på `present.stop`: **`q` og `Ctrl+c`**. Ctrl c bindes bare
  i terminalen (i web er det kopier).
- Nye kommandoer: `terminal.colors` (`:farger terminal|palett`, kun terminal). `present.stop` får aliaset `q` (`:q`).
- Bare web (`surfaces: ['web']`): `present.start`, `present.fullscreen`, `theme.setType`, `appearance.open`. Terminalen
  har `theme.setPalette` (`:palett`), `theme.light`/`dark`/`toggleMode` (bytter vår palett mellom lys og mørk).
- `system.escape` i terminalen: lukk overlegg → slå av svart skjerm → avslutt (samme semantikk som web, PO-103).

### `:`-kommandolinjen (`command-line/`, 3-c)

Vim-lik linje i nederste rad (erstatter statuslinjen mens den er åpen), med kandidatliste over (maks 8 rader). Innholdet
kommer fra **samme** `commandPaletteOptions`, `paletteArgumentError` og fuzzy som web-paletten, filtrert på flaten:
`:presenter ` viser gyldige nivåer med «agenda h2 · 9 lysbilder»; Tab/`↑↓` velger, Enter kjører, Esc lukker,
Backspace på tom linje lukker, `Ctrl u`/`Ctrl w` sletter linje/ord, `←→ Home End` flytter, lim inn virker. Feil vises i
`feil`-farge på linjen til neste tast, med samme tekster og koder som web: **E475** ugyldig argument, **E486** nivå som
ikke finnes i notatet (PO-101), **E492** ukjent kommando (teksten flyttes fra `CommandPalette.tsx` til `core/commands`).

## Beslutning 7: Oppstart, notatvalg, live og CLI

### CLI (`cli-args/`, skjelett, testet)

`npm run present -- ["<notat>"] [--vault <sti>] [--config <fil>] [--vault-id <id>] [--niva h<n>|auto] [--palett <navn>]
[--farger terminal|palett] [--uten-agenda] [-h|--hjelp]`.

- De tre delte flaggene sendes uendret til `resolveConfig` (ADR-005: CLI > env > fil). `--port`/`--lan` avvises.
- Posisjonsargumentene settes sammen med mellomrom (`npm run present -- Statusmøte uke 45` virker).
- `--niva h9` gir `E475` som `:presenter`. `--palett` valideres mot `farger.json`; standard palett og modus
  (`fosfor`, `system`) står der (`standard`). Ingen terminalvalg i konfigfila i v3.
- Ingen valg huskes i v3 (verken palett eller lysbildenivå) – terminalen skriver ingenting noe sted (se spørsmål).

### Notatvalg

`<notat>` løses i rekkefølge, case-insensitivt og NFC-normalisert:
1. eksakt `DocPath`/`FilePath` (med og uten `.md`); 2. eksakt tittel eller alias; 3. Obsidian-oppløsning av navnet
(`state.links.resolve`, korteste unike sti, ADR-004); 4. fuzzy (`fuzzyMatch` fra core) over tittel, aliaser og sti:
klart beste treff (minst 1,5 × poengsummen til nummer to) åpnes direkte, ellers åpnes notatlisten med søket utfylt.

**Notatlisten** (uten argument, eller tvetydig): fullskjerm, søkefelt øverst, nyeste først når søket er tomt, fuzzy-
rangering med uthevede treff når man skriver (2000 notater < 10 ms per tast), `↑↓`/`Ctrl n`/`Ctrl p`, Enter
presenterer, Esc/Ctrl c avslutter. Bare notater (ikke `.base`/vedlegg).

### Live (AK-3-10)

`watchVault` kjører i prosessen; `VaultRuntime` samler bunter, holder slettinger (PO-78) og sender `ChangedEvent` som i
serveren. Ved hver hendelse: omdøpt notat ⇒ følg ny sti; slettet ⇒ melding «Notatet finnes ikke lenger» (q avslutter,
kommer det tilbake, vises det igjen); ellers `getDocument` på nytt (render-cachen er tømt per revisjon, A20) →
`ensureLanguages` → kjernen → tilpasning (cachetreff for uendrede utkast) → `finalizeDeck` → `resolveSlide(ny, id,
forrige)` (AR-2-15) → diff-tegning. Rulleposisjon og åpne overlegg beholdes. Bases-data og overskrifter oppdateres uten
egen kode, som i web.

### Oppstartsrekkefølge

t0 argumenter → konfig → åpne økt (alternativ buffer, oppstartsskjerm) → spør etter evner (kitty, OSC 11) → parallelt:
`runtime.ready()` (workere) og Shiki-kjernen → løs notatet (eller notatlisten) → `ensureLanguages` → `getDocument` →
kortstokk → første ramme. Lysbildenivå fra `--niva` (som `:presenter`), overganger fra `--uten-agenda`. Start på
tittellysbildet.

## Beslutning 8: Testbarhet – rammer som data, e2e via rør og en hodeløs terminal

### Nivå 1 – rene funksjoner (Vitest, node)

Kjernen har allerede fasit-testene (S1–S8, AK-2-02/04/05). Terminalens rene deler testes likt: dekoder, bredde,
reflow, tabell, figlet-kjede, geometri → `fitDraft`, diff (skjelettet har de første).

### Nivå 2 – snapshot av rendret buffer per lysbilde

`src/terminal/test-support/render-note.ts` bygger en `VaultRuntime` over `test-vault/` (uten overvåking, én gang per
testfil) og gir `renderDeck(notat, { cols, rows, palett, fargedybde }) → Frame[]` – samme kode som kjøringen, uten
terminal. For hvert notat i `test-vault/presentasjon/` × **80×24, 120×36, 200×50**:

- **Tekstsnapshot** (`frameToLines`) per lysbilde til `__snapshots__/<notat>.<cols>x<rows>.txt` med
  `toMatchFileSnapshot` – lesbar diff i PR-er.
- **Målrettede stilsjekker** i stedet for fullstendige stilsnapshots (som ville brutt ved hver palettjustering):
  hodet har `hode`, kodetokens har palettens `kode.*`, plassholdere har `dekor` osv.
- **Invarianter for alle lysbilder og størrelser:** ingen kontrolltegn i celler; ingen halve brede tegn; all tekst i
  utkastets enheter finnes i et lysbilde eller i et rulleområde (AK-3-07 «intet kuttes usynlig»); agendalinjen bare
  på innholdslysbilder (AK-3-04); figlet bare på tittel/agenda/overgang (AK-3-03).
- **AK-3-02:** rekkefølgen sammenlignes med `docs/test/v2-fasit.json` gjennom `prepareSlideSource` (samme funksjon som
  web, §1); terminaltilpasningen får bare legge til `.forts<m>`-id-er.

### Nivå 3 – e2e mot ekte prosess i en ekte pty: headless tmux, ikke node-pty

**Valg:** QAs rigg (`e2e/support/terminal.ts`, laget parallelt med denne ADR-en) – presentasjonen kjøres i en **ekte
pseudoterminal** i en headless `tmux`-server (privat sokkel, `-f /dev/null`). tmux er terminalemulatoren: skjermen leses
med `capture-pane` (tekst) og `capture-pane -e` (SGR per celle), taster sendes med `send-keys`, `resize-window` gir ekte
SIGWINCH, `#{alternate_on}`/`#{cursor_flag}` viser terminaltilstanden, og `pipe-pane` logger råstrømmen (OSC 8,
`?1049h/l`, `?25l/h`, fargekoder). Et lite skallskript skriver `stty -g` før og etter og exit-koden, så AK-3-11 måles
*etter* at prosessen er ute. Arkitekten godkjenner riggen som e2e-nivået for v3 og forkaster sitt eget første forslag
(rør + `@xterm/headless` med en testmodus i CLI-en): tmux gir ekte termios og SIGWINCH uten nye npm-pakker og uten
testkroker i produksjonskoden.

Kontrakter fra appen til riggen:
- Appen leser `TERM`/`COLORTERM`/`TERM_PROGRAM`/`NO_COLOR` fra miljøet (riggen setter Ghostty- og xterm-256-profiler).
- **Testkrok for ukjent feil (AK-3-11):** `VAULT_READER_TEST_CRASH=etter-første-ramme` kaster en feil etter første
  ramme. Det er den eneste testkroken; den virker bare med variabelen satt.
- tmux svarer ikke som Ghostty på alt: kitty-tastaturet (`CSI ?u`) slås ikke på i tmux, så e2e tester den klassiske
  dekodingen (Esc med 30 ms tidsavbrudd); CSI u dekkes av enhetstestene. OSC 8 kontrolleres i råstrømmen.
- Tidtaking for AK-3-12 skjer i riggen (start → tittellysbildets tekst i `capture-pane`), median av 5.
- tmux (≥ 3.2) er et systemkrav for e2e (CI har 3.4; macOS: `brew install tmux`). Mangler tmux, skal v3-testene
  **feile med en tydelig melding**, ikke hoppes over stille – ellers mister vi AK-3-11/12 uten at noen merker det.

**Hvorfor ikke node-pty:** native tillegg med install-skript (ADR-006 §4 nekter dem i `allowScripts`), forhåndsbygde
binærfiler mangler for flere plattform/Node-kombinasjoner, kompilering krever byggverktøy hos kunden, og pakken er en
gjenganger i Nexus-karantene. tmux gir det samme (ekte pty) uten npm-avhengighet.

## Mappestruktur

```
src/core/                         ren TS uten plattform (§1) – flyttes i K1–K6
  hast/  outline/  presentation/{model,fit}  format/  keyboard/  commands/
src/terminal/
  main.ts                         ✓ inngang (npm run present)
  app/run-present.ts              ✓ komposisjonsrot (skjelett: plassholderskjerm)
  features/
    cli-args/                     ✓ argumenter
    screen/                       ✓ terminalhygiene (alternativ buffer, raw mode, gjenoppretting)
    keys/                         ✓ stdin → KeyInput (CSI, SS3, CSI u, paste, svar)
    cells/                        ✓ cellemodell, Unicode-bredde, diff → ANSI
    capabilities/                 3-a  fargedybde, OSC 8, kitty-spørring, OSC 11
    vault/                        3-a  VaultRuntime-oppsett, notatoppslag, ensureLanguages, live
    note-picker/                  3-a  fuzzy-notatliste
    session/                      3-a  tilstand (lysbilde, overlegg, rulling, svart) som reduser
    commands/                     3-a  terminalhandlere, registry('terminal'), motor-adapter
    theme/                        3-b  farger.json → TerminalTheme (truecolor/256/16/ingen)
    draw/                         3-b  HAST → blokker → linjer (inline, reflow, kode, tabell, base, callout, plassholder, fotnoter)
    figlet/                       3-b  .flf-leser, fonter, fallback-kjede
    slides/                       3-b/3-c  lysbildeoppsett, agendalinje, statuslinje, geometri → fitDraft
    command-line/                 3-c  `:`-linjen
    overlays/                     3-c  oversikt, hjelp, svart skjerm, «for liten»
  test-support/                   3-b  render-note, rammesnapshot
```

`tsconfig.server.json` inkluderer `src/terminal` (Node-prosjektet), Vitest kjører `src/terminal/**/*.test.ts` i
`server`-prosjektet, og ESLint forbyr `react` og `**/web/**` i terminalen (skjelettet har alle tre).

## Konsekvenser

- + Én lysbildemodell i praksis, ikke bare i prinsippet: web og terminal kaller `prepareSlideSource`, `buildSlideDrafts`,
  `fitDraft`, `finalizeDeck` og `resolveSlide` fra samme filer. Flyttingen er ren omorganisering med uendret testantall.
- + Tilpasningen i terminalen er eksakt og deterministisk (rader og kolonner), uten målepass; snapshots er stabile.
- + Ingen nye runtime-avhengigheter i skjelettet; senere bare `get-east-asian-width` (fra lockfila). E2e bruker tmux, ingen
  ny npm-pakke.
- − Vi eier en renderer (~1 500–2 500 linjer når 3-b/3-c er ferdige). Akseptert: den er rene funksjoner med høy
  testdekning, og alternativet (Ink) løser ikke de vanskelige delene (A2, tabeller, figlet, bredde).
- − Risiko: **oppstartstid**. Målt 3,2 s uten tiltak; M1–M3 gir anslagsvis 2,75 s + npm. M4 er reserven.
- − Risiko: **ulik tegnbredde mellom terminaler** (emoji med VS16, Ambiguous i CJK-oppsett). Vi tegner aldri egen krom
  med emoji eller tvetydige symboler utenfor hvitelisten; innhold med emoji følger Ghostty. Andre terminaler kan få en
  forskjøvet ramme rundt slike tegn – dokumenteres som kjent begrensning.
- − Risiko: kodefargene avhenger av at serverens Shiki-tema (`--shiki-token-*`) og UX' `farger.json` har samme
  tokenliste. En test i 3-b sjekker at alle tokenvariabler i serverens `createVaultReaderTheme` finnes i fargefila.
- − Flyttingen (K1–K6) berører mange importer mens andre jobber; derfor først og alene i 3-a.
