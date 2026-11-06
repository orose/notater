# Testplan v1.1 – lesekomfort og tastaturstyring

Eier: QA. Grunnlag: `docs/produkt/v1.1-spesifikasjon.md` (AK-1.1-01 til -12), `docs/test/teststrategi.md`,
ADR-007/008/009 og PO-53 til PO-56 i `docs/beslutninger.md`. Fasit: `test-vault/README-QA.md` §19 og
`docs/test/v1.1-fasit.json` (testene leser JSON-fila; endres vaultet, endres begge i samme commit).

## 1. Arbeidsform (TDD)

- Akseptansetestene ligger i `e2e/v1.1-*.spec.ts` og kjører mot den **ekte** serveren og en temp-kopi av
  testvaultet (globalSetup, PO-17), i prosjektene `desktop` (1440 px) og `mobil` (360 px, touch).
- Alt som krever ny funksjonalitet er merket `test.fixme('TC-…', …)` med AK-ID i fil/describe. **Frontend
  fjerner `.fixme`** for testene som hører til en funksjon i samme commit som funksjonen leveres
  (B5: testen fantes og feilet først). En test som fortsatt feiler etter levering, er en bug – ikke en grunn
  til å endre testen uten QA.
- Aktive allerede nå (grønne): P1-sjekkene (TC-02-00, TC-05-00, TC-10-01), selvtesten av tastereglene
  (TC-08-01..07) og sjekken av registeret (TC-08-08/09, mot `catalogBindings()`).
- Kjøring: `E2E_PORT=4620 npx playwright test e2e/v1.1-` (bare v1.1) eller hele suiten uten filter.

## 2. Testdata (nytt i testvaultet)

| Notat | Brukes til |
|---|---|
| `lesekomfort/Kvartalsrapport.md` + `lesekomfort/kilder/*` (9) | F2: notat-, seksjons- og blokkembeds under H1/H2/H3/H5/H6, nestet, manglende, syklus, dybdegrense, bilde, base; P1-felle i frontmatter |
| `lesekomfort/Dyp struktur.md` | F3: H1–H6, hopp H2→H4, blokk-ID dypt nede, lenker før første overskrift, unikt søkeord |
| `lesekomfort/Lang brødtekst.md` | F1/F4: lange avsnitt, langt ord, properties, P1-felle, lenker for navigasjon i zen |

Konsekvens: QA-IDX-01 er nå **91** notater. Oppdatert i `README-QA.md`, `e2e/ak01-vault-indeks.spec.ts`,
`src/server/app/create-app.test.ts` og `src/server/features/vault-index/vault-snapshot.test.ts` (godkjent av PO).
Ingen av de nye notatene har tagger eller lenker til notater med tilbakelenke-fasit, og ingen havner i baser
eller endrer søkefasiten.

## 3. Sporbarhet AK → testcaser

| AK | Fil | Testcaser | Merknad |
|---|---|---|---|
| AK-1.1-01 Lesebredde | `v1.1-ak01-lesebredde.spec.ts` | TC-01-01 standard; -02 Utseende + paneler beholdes; -03 `Space w`; -04 `:bredde`; -05 huskes etter reload, globalt; -06 `.base`; -07 360 px × begge bredder × rapport (rammer/diskré) × foldet | ≥ 100 px bredere ved 1440 px |
| AK-1.1-02 Diskré av/på | `v1.1-ak02-03-diskret.spec.ts` | TC-02-00 utgangspunkt (P1); -01 Utseende + toast; -02 `Space d` + toast; -03 `:diskret`; -04 kun dette notatet, tilbake, reload; -05 kilde-notat påvirker ikke vert; -06/-07 deaktivert på `.base` (palett og Utseende) | |
| AK-1.1-03 Diskré visning | samme | TC-03-01 ingen ramme/etikett/knapp (beregnet stil); -02 nivåer (QA-V11-10); -03 H1-tittel én gang; -04 TOC; -05 §; -06 kildelenke ved hover; -07 ved fokus + Enter; -08 nestet arver; -09 feilkort; -10 base/bilde uendret; -11 mobil-TOC; -12 touch; -13 fold innebygd overskrift, ikke embed som blokk; -14 fold av vertens H1; -15 § uendret ved fold | |
| AK-1.1-04 Folding | `v1.1-ak04-folding.spec.ts` | TC-04-01 alle 10 overskrifter (seksjonsgrense, `aria-expanded`, navn, `data-vr-folded`, indikator, utfold); -02 hover; -03 Tab/Enter/Space; -04 touch: alltid synlig, ≥ 24 px; -05 innhold før første overskrift; -06 `zM`/`zR`; -07 `za` fokusert; -08 `za` ved leselinje 30 % (PO-53); -16 `za` over første overskrift; -17 rammede embeds kan ikke foldes (PO-54); -09 `:fold alle`/`:utfold alle`; -10 `#^blokk` folder ut forfedre og bare dem; -11 `#overskrift`; -12 TOC-klikk; -13 søketreff; -14 huskes ikke (reload, bort og tilbake) | |
| AK-1.1-05 Zen | `v1.1-ak05-zen.spec.ts` | TC-05-00 utgangspunkt (P1); -01 skjuler paneler/krom, beholder tittel/properties, sentrert; -02 ikke fullskjerm, ingen demping; -03 + full bredde; -04 overlever lenke, `H`, palett-søk; -05 taster/palett i zen, Esc lukker oversikt først; -06 `Space z`; -07 `:zen`; -08 Esc (bare uten dialog); -09 Esc avbryter sekvens før zen; -10 aldri aktiv ved start/ny fane; -11 med mus; -12 mobil: topplinje skjult, «Avslutt zen»; -13 mobil + full bredde | |
| AK-1.1-06 Én palett | `v1.1-ak06-07-palett-oversikt.spec.ts` | TC-06-01 `⌘K`; -02 `/`; -03 `:` + `<kbd>`; -04 Backspace over `:`; -05 `:zen`, `:zn` (fuzzy), `:diskret`, `:tema terminal`, `:palett fosfor`, `:mørk`, `:fold alle`, `:hjelp`, `:taster`; -06 `:lys`; -07 argument-underliste; -08 deaktivert med forklaring; -09 **alle** kommandoer i oversikten finnes i paletten med samme taster; -10 Esc + fokus; -11 med mus/touch | F7-tastene: TC-F7-* |
| AK-1.1-07 `?`-oversikt | samme | TC-07-01 grupper i rekkefølge; -02 hele tastaturkartet; -03 Esc og `?` lukker; -04 norsk `?`; -05 fra Utseende; -06 plattformvisning (PO-36); -07 identisk med registeret; -08 README i sync | Arkitektens sync-test `scripts/docs-shortcuts.test.ts` dekker generatoren |
| AK-1.1-08 Reserverte/⌥-taster | `v1.1-ak08-register.spec.ts` | TC-08-01..07 selvtest av reglene; **-08 registeret: P4, P5, konflikter (aktiv)**; **-09 dekker tastaturkartet, kun `normal`, gyldige grupper, unike id-er (aktiv)**; -10 det som vises i `?` | Uavhengig av `validateBindings` (egen parser i `e2e/support/keymap-rules.ts`) |
| AK-1.1-09 P7 | `v1.1-ak09-tastatur.spec.ts` | TC-09-01 palettens felt; -02 `input`/`textarea`/contenteditable/`select` injisert i siden; -03 bak Utseende; -04 bak oversikten; -05 bak mermaid-zoom; -06 Space på knapp (PO-56); -07 modifikatorer; -08..-11 norsk tastatur (`:` `?` `/` `;`) | |
| F7 (AK-06/07) | samme | TC-F7-01 `j/k`; -02 `Ctrl d/u`; -03 `G`/`gg`; -04 `H/L`; -05 Space ruller ikke; -06 which-key etter ~400 ms + Esc; -07 rask `Space w` uten hint; -08 `g Esc g`; -09 tidsavbrudd; -10 ukjent fortsettelse; -11 reserverte taster gjør ingenting; -12 redusert bevegelse; -13 `⌘.`/`Space m`; -14 `Space t` | |
| AK-1.1-10 P1 | `v1.1-ak10-12-p1-a11y.spec.ts` | TC-10-01 frontmatter-feller ignoreres (aktiv); -02 alt i bruk → sjekksum av `lesekomfort/` + mtime uendret, bare GET/HEAD; -03 valg kun i `localStorage`, ikke URL | |
| AK-1.1-11 Regresjon | hele suiten | Se §5 | |
| AK-1.1-12 a11y | `v1.1-ak10-12-p1-a11y.spec.ts` | TC-12-01 axe lys/mørk: Utseende, diskré rapport, foldet notat, zen; -02 palett `:`, oversikt, which-key; -03 fold-knapp (rolle, `aria-expanded`, fokus beholdes); -04 Tab til nye kontroller + synlig fokus; -05 toast `role=status` uten fokus; -06 zen beholder `main` og hopp-lenke | Manuell VoiceOver-stikkprøve (nivåer i diskré modus, fold-knapp) |

## 4. Kanttilfeller

| Kanttilfelle | Forventet | Test |
|---|---|---|
| Hurtigtaster i tekstfelt | Tastene havner i feltet; bare ⌘K/⌘. virker (`inTextFields`) | TC-09-01, -02 |
| Bak modal dialog | Motoren inaktiv; dialogens egne taster (Esc, `?` i oversikten, ⌘K i paletten) virker | TC-09-03..05 |
| Sekvens avbrytes | `g Esc g` og `g … 1,5 s … g` gjør ingenting; `z x` gjør ingenting | TC-F7-08..10 |
| Space-hint | Ikke før ~400 ms; viser `w d z m t`; tidsavbruddet løper ikke mens hintet vises (ADR-007); Esc skjuler og avbryter | TC-F7-05..07 |
| Space på knapp/fane/avkrysning | Native funksjon, ikke leader (PO-56); på lenker og i brødtekst er Space leader | TC-04-03, TC-09-06 |
| `:` på norsk tastatur (Shift+.) | Ekte tastehendelse med `code=Period`+Shift via CDP åpner kommandomodus | TC-09-08 |
| `?` (Shift++) og `/` (Shift+7) | Oversikt / notatsøk | TC-07-04, TC-09-09/10 |
| Caps Lock | `g` med Caps Lock er fortsatt `g` (ADR-007) | Enhetstest (`key-input.test.ts`); ikke e2e (Playwright kan ikke sette Caps Lock) |
| Døde taster og ⌥ | Ignoreres; aldri bundet | TC-08-05/08/10, TC-09-07 |
| Zen ved navigasjon | Lenke, `H`/`L`, palett-søk beholder zen; full sidelasting (reload, ny fane) starter uten | TC-05-04, -10, -13 |
| Esc i zen med åpen palett/oversikt | Første Esc lukker dialogen, neste avslutter zen | TC-05-05, -08 |
| Esc med påbegynt sekvens i zen | Avbryter bare sekvensen | TC-05-09 |
| Folding + dyplenke | Bare forfedrene til målet foldes ut; andre forblir foldet; målet er i visningen | TC-04-10, -11 |
| Folding + TOC/søk | Folder ut; søketreff i samme notat = «åpne notatet» (alt ut, ADR-009) | TC-04-12, -13 |
| Folding + § | § endres ikke når seksjoner foldes (`data-vr-sec`) | TC-03-15 |
| Folding av innebygd overskrift | Stopper ved embedens slutt; vertens tekst etter embeden vises | TC-03-13 |
| Folding over første overskrift / uten overskrifter | `za` → toast «Ingen seksjon her» | TC-04-16 |
| Folding og live reload | Folder på vertsoverskrifter som finnes beholdes (ADR-009) | Enhetstest i `outline`; manuell stikkprøve (e2e ville endret delt vault-kopi) |
| Diskré huskes per notat | Nøkkel vault-id + sti; andre notater og kildenotater upåvirket; overlever tilbake og reload | TC-02-04, -05, TC-10-03 |
| Diskré på notat uten embeds | Lov; toast «Ingen innebygde notater i dette notatet» (ADR-007) | Manuell |
| Diskré: H1 i kilden | Brukes som tittel, vises én gang | TC-03-03 |
| Diskré: dybdegrense/syklus/manglende | Kortene vises alltid | TC-03-09 |
| Diskré: H6-flating | Dypere nivåer flates til H6 | TC-03-02 (Plan/Steg, Risiko/Tiltak) |
| Reserverte taster (P4) | Ikke bundet; trykk gjør ingenting | TC-08-08, TC-F7-11 |
| ⌥-taster (P5) | Ikke bundet | TC-08-08, -10 |
| `.base`-side | `:diskret` og Utseende-kontrollen deaktivert med forklaring; full bredde gir ingen feil | TC-02-06/07, TC-06-08, TC-01-06 |
| Mobil (360 px) | Ingen horisontal scroll i noen tilstand; Utseende via topplinjen | TC-01-07, TC-05-12/13 |
| Touch | Fold-pil alltid synlig (dempet) og ≥ 24 px; kildelenke nåbar uten hover; zen kan avsluttes uten tastatur | TC-04-04, TC-03-12, TC-05-12 |
| Ctrl d/u på Windows/Linux | Kan bli slukt av nettleseren; akseptert (PO-55). Chromium/Linux i e2e: forventes å virke | TC-F7-02 |
| Redusert bevegelse | Rulling uten animasjon | TC-F7-12 |
| Privat modus / blokkert lagring | Valgene gjelder økten, ingen feil (ADR-008) | Enhetstest i `view-settings`; manuell |

## 5. Regresjonsomfang (AK-1.1-11)

Hele den eksisterende suiten kjøres uendret ved hver slice: Vitest (enhet + integrasjon) og Playwright
`desktop`, `mobil`, `mock-desktop`, `mock-mobil`, samt `perf` før 1.1-e. Spesielt utsatt:

| Område | Hvorfor | Tester |
|---|---|---|
| ⌘K-søk (AK13) | Søket flyttes inn i felles palett; lytteren flyttes til registeret | `ak13-sok.spec.ts`, `ui.spec.ts` |
| Tema/⌘. (AK2/3/8) | ⌘. flyttes til registeret | `ak02-03-19-tema-a11y.spec.ts`, `ak08-temaer.spec.ts` |
| TOC/scroll-spy (AK16) | TOC fra disposisjonen; scroll-spy hopper over skjulte overskrifter | `ak14-16-innhold.spec.ts` |
| § (Tidsskrift/Terminal) | CSS-teller erstattes av `data-vr-sec` | TC-03-05, skjermbildematrisen |
| Embeds (QA-EMB-*) | `Embed` får diskré gren | `ak07-11-navigasjon.spec.ts` |
| Navigasjon/#anker/scroll (AK7/11) | Utfolding ved hash | `ak07-11-navigasjon.spec.ts` |
| Layout 360 px (AK5) | Nye kontroller, zen | `ak05-layout.spec.ts` (alle notater, inkl. de nye) |
| WCAG (AK19) | Nye kontroller | `ak02-03-19-tema-a11y.spec.ts` + TC-12-* |
| Ytelse (AK17) | Disposisjon/folding per render | `perf.spec.ts` (notatbytte p95 < 200 ms) |
| Live reload (AK12) | Diskré følger omdøping; folding ved reload | `ak12-live-reload.spec.ts` |

## 6. Selektorer og testid-er (kontrakt mot frontend)

Testene bruker rolle + navn der spesifikasjonen eller ADR-ene gir dem, ellers `data-testid`. Hjelperne ligger
i `e2e/support/v11.ts`. Avvik avtales med QA før de implementeres.

| Hva | Selektor | Kilde |
|---|---|---|
| Utseende | `role=dialog` navn «Utseende» | v1 |
| Lesebredde | `role=group` «Lesebredde» med `role=radio` «Leseoptimalisert» / «Full bredde» | QA-forslag |
| Diskré-kontroll | label «Diskré embedding – dette notatet» (checkbox eller switch), `disabled` på `.base` | spesifikasjonen F2 |
| Hurtigtaster fra Utseende | `role=button` «Hurtigtaster» | QA-forslag (F6) |
| Palett | `dialog[open]` som inneholder `role=combobox`; valg `role=option`, deaktivert `aria-disabled="true"` med begrunnelse som tekst | ADR-007 §4 |
| Kommando i palett | `role=option` med `data-command-id="<id>"`, hurtigtast som `<kbd>` | QA-forslag + ADR-007 |
| `?`-oversikt | `role=dialog` navn «Hurtigtaster»; gruppene som overskrifter i rekkefølge | spesifikasjonen F6 |
| Rad i oversikten | `data-testid="hurtigtast-rad"` + `data-command-id="<id>"` (hint: hint-id); navn i `data-testid="hurtigtast-navn"`; hvert tastealternativ i `data-testid="hurtigtast-binding"` med én `<kbd>` per akkord | QA-forslag |
| Which-key | `data-testid="leader-hint"`, én `<kbd>` per fortsettelse (`w d z m t`) | QA-forslag |
| Fold-pil | `role=button` «Fold sammen ‹tekst›» / «Fold ut ‹tekst›», `aria-expanded`, gjerne `aria-controls` | ADR-009 |
| Foldet overskrift | `data-vr-folded` på overskriften; indikator som `data-testid="fold-indikator"` i overskriften **eller** `::after`/`::before` med innhold | ADR-009 + QA |
| Diskré embed | `vr-embed` → `div.embed-discreet` (`data-vr-discreet="true"`), ingen «Innebygd fra», ingen «Åpne notat →» | ADR-009 |
| Kildelenke | `role=link` «Kilde: ‹tittel›» (`a.embed-source`), seksjon: «Kilde: Notat › Seksjon»; skjult = `opacity: 0` eller sr-only | ADR-009 |
| § | `data-vr-sec="<n>"` på nummererte H2, `::before` med «§» i Tidsskrift | ADR-009 |
| Toast | `role=status` med «Diskré embedding …» (`på`/`av`) | v1-toast |
| Zen | `html[data-zen="on"]`; skjult: `navigation` «Vault», `complementary` «På denne siden», `banner` (mobil); touch: `role=button` «Avslutt zen» | ADR-008 + QA-forslag |
| Bredde | `html[data-width="full"]` (testene måler bredden) | ADR-008 |
| TOC | `navigation` «Innhold» (desktop), «Innhold (kompakt)» (mobil) | v1 |

## 7. Spørsmål til PO (med forslag)

| # | Spørsmål | QA foreslår |
|---|---|---|
| Q-01 | Embed **før** første overskrift i verten: hvilket nivå? | H2 (konteksten er notatets tittel, H1). Samme som ADR-009. Fasit: `Sammendrag` = H2. |
| Q-02 | Nestet embed i et innebygd notat som ikke har egne overskrifter (`Sirkel A` → `Sirkel B`): er `Sirkel A`s (syntetiske) tittel «nærmeste foregående overskrift»? | Ja → `Sirkel B` = H3. Ellers ville B fått samme nivå som A og sett ut som en søsken. Fasit er skrevet slik; ADR-009 bør presiseres. |
| Q-03 | Navn på fold-knappen når seksjonen er foldet: spesifikasjonen sier «Fold sammen ‹overskrift›». | «Fold sammen X» / «Fold ut X» (ADR-009), med `aria-expanded`. Testene godtar begge, men krever «Fold sammen» når utfoldet. |
| Q-04 | Tekst i toast ved diskré-bytte | «Diskré embedding på for dette notatet» / «Diskré embedding av for dette notatet» (testene matcher `/Diskré embedding/` + `på`/`av`). |
| Q-05 | Kildelenken på touch (ingen hover) | Alltid synlig, dempet, som fold-pilen (`@media (hover: none)`). TC-03-12 godtar også «vises ved trykk». |
| Q-06 | Hvordan avsluttes zen på mobil/touch uten tastatur, når topplinjen er skjult? | En diskret, alltid synlig knapp «Avslutt zen» (touch) som også vises ved musebevegelse øverst på desktop. Uten den bryter zen P6 på mobil. TC-05-12 forutsetter dette. |
| Q-07 | Zen med mus (P6): bare via paletten? | Legg også «Zen-modus» i Utseende ved siden av lesebredde og diskré. Ingen test krever det ennå. |
| Q-08 | Esc i zen når en sekvens er påbegynt | Første Esc avbryter bare sekvensen; neste avslutter zen (ADR-007). TC-05-09. |
| Q-09 | Full bredde på `.base`-sider (allerede brede) | Ingen synlig endring, ingen feil, ingen horisontal scroll. TC-01-06. |
| Q-10 | Overskrifter i rammede embeds i normalvisning: skal de være med i TOC? | Nei, som i v1 (PO-54 sier de foldes/nummereres ikke). Fasit QA-V11-02. |
| Q-11 | Skal fokus på en fold-knapp i en seksjon som skjules av `zM` flyttes? | Ja, til fold-knappen på den ytterste foldede overskriften (ellers forsvinner fokus i et skjult element). Ikke testet ennå; legges til TC-04-06 hvis godkjent. |
| Q-12 | `Ctrl u` på Linux/Windows (vis kilde i enkelte nettlesere) | Dokumenteres som kjent begrensning (PO-55); e2e i Chromium forventer at den virker. |

## 8. Manuelt

- VoiceOver (macOS/Safari): overskriftsnivåer i diskré rapport (rotoren), fold-knappens tilstand, which-key.
- Norsk Mac-tastatur fysisk: `:` `?` `/` `⌘.` og at ⌥-tegn ikke utløser noe.
- PO/kunde: skjermbilder av diskré rapport, foldet notat, zen (lys/mørk × Tidsskrift/Terminal) – AK6-ånd.
