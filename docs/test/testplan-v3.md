# Testplan v3 – presentasjon i terminalen

Eier: QA. Grunnlag (bindende): `docs/produkt/v3-spesifikasjon.md` (T1–T7, AK-3-01 til -13; **Mermaid og kanban tegnes
ikke**, de vises som plassholdere), **ADR-011** (særlig §3 evner og hygiene, §4 HAST → celler, §5 figlet, §6 tastatur,
§7 CLI/notatvalg/live, §8 testbarhet), PO-106 til PO-112 i `docs/beslutninger.md`, `docs/test/teststrategi.md`,
`docs/test/testplan-v2.md`. Fasit: `test-vault/README-QA.md` §21, `docs/test/v3-fasit.json` (terminalspesifikt) og
`docs/test/v2-fasit.json` (lysbilderekkefølgen – samme fasit som web, AK-3-02). UX-kilder testene leser direkte:
`docs/design/terminal/farger.json` (fargeroller) og `docs/design/terminal/figlet/vr-blokk.flf`, `vr-smal.flf`.

## 1. Arbeidsform (TDD)

- Tre nivåer (ADR-011 §8): **1** rene funksjoner og **2** rammesnapshots per lysbilde (`renderDeck` → `Frame[]`,
  `toMatchFileSnapshot`) skrives av utviklerne i `src/terminal/` mot den samme fasiten. **3** e2e mot den ekte prosessen
  i en ekte pty – det er QAs akseptansetester i `e2e/terminal/v3-*.spec.ts`, beskrevet her.
- Alt som krever ny funksjonalitet er `test.fixme('TC-3-…')` med AK-ID i fila/describe. **Utvikleren fjerner `.fixme`**
  for testene som hører til en funksjon i samme commit som funksjonen leveres (B5). En test som feiler etter levering er
  en bug – testen endres ikke uten QA.
- **Kjører nå (grønne):** riggens selvtest (TC-3-00-01..05), fasitsjekkene (TC-3-02-00, -00w mot web-presentasjonen),
  ikke-TTY og `--hjelp` (TC-3-01-11/-12), og hygienen i skjelettet (TC-3-11-01, -03, -04, -10, -11).
- Hver test har egen vault-kopi (fixture `vault`, med fixture-mtimes) og egen tmux-server; live-testene endrer bare
  kopien. Konfigurasjonen peker på en port der ingenting lytter (T7 «frittstående»).

## 2. Teknisk testoppsett

### 2.1 Riggen (`e2e/support/terminal.ts`, godkjent i ADR-011 §8)

| Del | Hvordan |
|---|---|
| Terminal | Headless **tmux ≥ 3.2** (CI 3.4), én privat sokkel per terminal (`-L qa-v3-<pid>-<n>`, `-f /dev/null`, `status off`, `escape-time 0`). tmux er terminalemulatoren – ekte pty, ekte termios, ekte SIGWINCH. Ingen npm-pakke (ADR-006). |
| Oppstart | Et skall-skript per terminal: venter på «go» (så `pipe-pane` er koblet til før første byte), `stty -g` før, `npm run --silent present -- …`, `stty -g` etter, `QA-EXIT=<kode>`. `trap 'true' INT TERM HUP` holder skallet i live uten å arves av appen. |
| Skjermbuffer | `capture-pane -p` (tekst) og `-e` (SGR) → `Celle { tegn, fg, bg, fet, dempet, kursiv, understrek, invertert }` (`tolkSgr`). Bredde: `visningsbredde` (grafemer, bredde-2, kombinerende = 0). |
| Råstrøm | `pipe-pane -o` → `rå.log`: OSC 8 (`osc8Mål`), `?1049h/l`, `?25l/h`, fargekoder (`sgrIRåstrøm`, `fargekoder`). |
| Tilstand | `display -p '#{alternate_on} #{cursor_flag} #{pane_width} #{pane_height}'` – leses **etter** at prosessen er ute. |
| Taster | `send-keys` (`j`, `Right`, `PageDown`, `Space`, `Escape`, `C-c`, `Enter`, `Up`/`Down`), `-l` for bokstavelig tekst (æøå), `kommando('presenter h4')` = `:` + tekst + Enter. |
| Størrelse | `resize-window -x -y` (SIGWINCH). |
| Signaler | `signal(sig, 'appen' \| 'gruppen')`: `kill` til den innerste Node-prosessen med `src/terminal/main.ts`, eller til tsx + appen samtidig (som når vinduet lukkes). Bare etterkommere av testens eget skall – aldri `pkill -f`. |
| Nettverk | `NODE_OPTIONS=--import e2e/support/terminal-nettvakt.mjs` logger **alle** TCP-forsøk (også 127.0.0.1) fra Node-prosessene (ikke npm) til `nett.log`; testen krever tom logg (B10, T7). |
| Miljøprofiler | `GHOSTTY` (`TERM=xterm-ghostty`, `COLORTERM=truecolor`, `TERM_PROGRAM=ghostty`) som standard; `XTERM_256` (`TERM=xterm-256color`, uten `COLORTERM`/`TERM_PROGRAM`); `NO_COLOR=1`. `TMUX`, `NO_COLOR`, `FORCE_COLOR`, `COLORFGBG` fjernes før start. `LANG=nb_NO.UTF-8`, `TZ=Europe/Oslo`. |
| Lese et lysbilde | Statuslinjen = nederste ikke-tomme rad, `n/N` sist. Agendalinjen = øverste ikke-tomme rad med et agendapunkt **og** `n/m`. Figlet = ≥ 3 rader på rad der < 20 % av blekket er bokstaver/sifre (`finnFiglet`; gjenkjenner begge UX-fontene, ikke tabeller/callouts – selvtestet). |
| Fixtures | `rigg` (vilkårlig kommando, for selvtesten), `vault` (kopi + konfig), `present(valg)` (lukkes automatisk). Hjelpere: `presenterNotat`, `gåTilLysbilde`, `lesAlleSkjermer`, `rullHeleBlokken`, `forventGjenopprettet`, `forLiteMønstre`, `figletKjede`. |
| Figlet-fasit | Egen `.flf`-leser og ADR-011 §5-kjeden i riggen (`lesFlf`, `figletKjede`) – uavhengig av appens kode, regnet med marg 0 og 4; avhenger svaret av margen, sjekkes bare invariantene. |

### 2.2 Prosjekter og kjøring

- Filene ligger i `e2e/terminal/` og kjører i Playwright-prosjektet **`terminal`** (PO-118: `testMatch: /terminal\/v3-.*\.spec\.ts$/`); `desktop`/`mobil` ignorerer dem. Ytelsestesten (`…-terminal-perf.spec.ts`) går i `perf`. Prosjektet bruker Desktop Chrome bare for TC-3-02-00w (fasiten mot web-presentasjonen).
- Mangler tmux, **feiler** testene med en tydelig melding (ADR-011 §8), de hoppes ikke over stille.
- Kjøring: `E2E_PORT=4810 npx playwright test --project=terminal` (bare v3), hele suiten uten filter, ytelse
  `E2E_PORT=4810 npx playwright test --project=perf e2e/terminal`. Kjør **aldri** `playwright install`.
- Mac: `brew install tmux`. Manuelt i ekte Ghostty: se §8.

## 3. Testdata

| Notat | Brukes til | Fasit |
|---|---|---|
| Alle i `presentasjon/` fra v2 | AK-3-02 rekkefølge (samme fasit), AK-3-03..07 | `v2-fasit.json`, QA-V2-* |
| **`presentasjon/Terminalkanter.md` (ny)** | æøå/emoji/bredde-2/kombinerende tegn; emoji i agendapunkt (figlet → fet); agendapunkt som er ett ord på 80 tegn; lange ord og URL, ekstern lenke (OSC 8); callouts; inline Bases-tabell; bilde-plassholder; tabell med 10 kolonner | `v3-fasit.json › kanter`, QA-V3-01 |

Konsekvens: QA-IDX-01 er nå **106** notater (105 → 106). Oppdatert i `README-QA.md`, `e2e/ak01-vault-indeks.spec.ts`,
`src/server/app/create-app.test.ts` og `src/server/features/vault-index/vault-snapshot.test.ts` (godkjent av PO i
oppdraget). Notatet har ingen tagger og ingen wikilenker; den inline basen er en kopi av Sprintoversikt blokk 1, og
`arkitektur.png` har ingen tilbakelenkefasit – base-, søke- og tilbakelenkefasiten er uendret. Rekkefølgen er sjekket mot
web-presentasjonen (TC-3-02-00w, grønn).

`v3-fasit.json` inneholder: `storrelser` (80×24, 120×36, 200×50; for små: 79×23, 79×24, 80×23, 40×12 og meldingen),
`rekkefolge`, `kanter`, `figlet` (fonter, regel, `hoder` per T/A/O-lysbilde × størrelse), `agendalinje` (ved 80 og 200
kolonner), `nummerering` («0n /»), `statuslinje`, `plassholdere`, `lenker` (OSC 8, PO-109), `innhold` (kode, tabeller,
fotnoter, callouts), `taster` og feilkoder, `farger` (henviser til `farger.json`, miljøprofiler), `live`, `notatvalg`,
`ytelse` (PO-106) og `hygiene`. Fasiten er generert én gang og sjekket av TC-3-02-00; endres et notat, endres fasiten i
samme commit.

## 4. Sporbarhet AK → testcaser

| AK | Fil | Testcaser |
|---|---|---|
| AK-3-01 Start, notatliste, frittstående | `v3-ak01-start.spec.ts` | TC-3-01-01 starter på tittel, **ingen TCP-tilkoblinger** (heller ikke til web-serveren); -02 eksakt treff (navn, sti, `.md`, store/små bokstaver); -03 navn uten anførselstegn; -04 fuzzy med ett klart treff starter direkte; -05 **flere treff** («rapport» → liste forhåndsfylt, filtrering, Enter); -06 **ukjent notat** (melding, exit ≠ 0, terminalen urørt); -07 uten argument: liste, filter, Enter, Esc avslutter rent; -08 NFC mot NFD-filnavn; -09 `--vault`; -10 read-only (sjekksum av hele kopien); **-11 ikke-TTY → norsk melding, exit 1 (kjører)**; **-12 `--hjelp` med alle flagg (kjører)** |
| AK-3-02 Rekkefølge = v2 | `v3-ak02-rekkefolge.spec.ts` (+ `v3-00`) | **TC-3-02-00 fasitsjekk (kjører)**, **-00w Terminalkanter i web == fasit (kjører)**; -01 alle v2-notater + Terminalkanter eksakt ved 200×50; -02 ved 80×24 og 120×36 modulo ekstra «(forts.)»; -03 `--niva h4`/`h2`; -04 «Mye innhold»: alle 39 markører én gang i rekkefølge, ≥ 2 deler; -05 `--uten-agenda`; -06 «Utenfor rapporten» vises aldri |
| AK-3-03 Figlet | `v3-ak03-04-figlet-agendalinje.spec.ts` | TC-3-03-01 per T/A/O-lysbilde × 3 størrelser: font og antall linjer etter kjeden (høyde 4·n eller 3·n), fallback = ingen figlet + fet tekst, ingen avkutting, høyde ≤ ⅓ rader, farger = rollene `hode`/`hode_skygge`; -02 figlet aldri på innhold; -03 resize 200 → 80 på en overgang bytter blokk → fet, samme lysbilde |
| AK-3-04 Agendalinje | samme | TC-3-04-01 ved 80 og 200 kolonner: synlige punkter, progresjon, avkorting med «…», aldri bredere enn terminalen, ikke på tittel/agenda; -02 gjeldende punkt uthevet (andre attributter); -03 «Mange agendapunkter» ved 200 = v2 (QA-V2-22); -04 «0n /» på innholdsoverskriften; -05 ingen agendalinje på overgangene |
| AK-3-05 Kode, tabeller, callouts, Bases | `v3-ak05-06-tegning.spec.ts` | Ved 80×24, 120×36, 200×50: TC-3-05-01 kode med ≥ 3 truecolor-syntaksfarger; -02 tabell med rammetegn, fotnote under tabellen; -03 callouts med ramme og etikett, lang linje innenfor rammen; -04 Bases-tabell («Kritisk», rekkefølge som fasit); -05 **kodeblokk bredere enn 80** (`↪`, ingen tegn tapt); -06 **12 × 40-tabell**: alle 480 celler synlige ved rulling; -07 **10 kolonner ved 80**: alle celler hele; -08 **æøå, emoji, bredde-2, A+U+0308**, statuslinjen ikke forskjøvet; -09 **lange ord og URL** brytes hardt uten tap, ekstern OSC 8; -10 intern lenke → `obsidian://open?vault=…&file=…` (PO-109); -11 uten OSC 8-støtte: ingen OSC 8 |
| AK-3-06 Plassholdere | samme | TC-3-06-01 Mermaid (2 steder), kanban, bilde × 3 størrelser: tekst fra spesifikasjonen, ikke rå kilde, ikke fet, navigasjon virker etterpå; -02 «Høyt diagram» gir verken rulling eller «(forts.)» |
| AK-3-07 Tilpasning | `v3-ak07-tilpasning.spec.ts` | TC-3-07-01 listepunkt deles aldri; -02 for stor kode ruller med `↑`/`↓` og hint, alle 120 linjer; -03 ingenting kuttes (ingen rad bredere enn terminalen, statuslinjen nederst, `n/N` konsistent) for statusmøte, rapport, Terminalkanter; -04 **resize midt i presentasjonen** (120×36 → 80×24 → 200×50 → 100×30): samme lysbilde; -05 resize på en «(forts.)»-del; -06 mange raske resize-hendelser |
| AK-3-08 Taster og `:` | `v3-ak08-taster.spec.ts` | TC-3-08-01/-02 hver neste/forrige-tast + grenser; -03 `gg`/`G`, `g Esc`; -04 oversikt (`o`, j/↓, Enter, Esc); -05 svart skjerm (`b`/`.`), neste gir bildet tilbake uten å bla; -06 `?` viser tastene; -07 `:presenter h4`, `:agenda av` beholder lysbildet; -08 `:palett`, `:farger terminal`; -09 feil: `h9`/`hx` E475, `h5`/`h4` E486, ukjent palett/farger E475, ukjent kommando **E492**; -10 `:` + Esc avbryter, `:q` avslutter; -11 statuslinjen (tittel, hint, `7/10`) |
| AK-3-09 Farger | `v3-ak09-farger.spec.ts` | TC-3-09-01 standard truecolor med `farger.json › standard` (fosfor), bakgrunnen males; -02 **kontrast** for hver palett på 6 lysbilder (tekst ≥ 4,5:1, figlet/rammer ≥ 3:1 mot cellens bakgrunn); -03 ukjent palett; -04 **`--farger terminal`** bare SGR 30–37/90–97/40–47/100–107, aksent fra `ansi16.aksentAvPalett`; -05 **`NO_COLOR`**: ingen fargekoder, gjeldende punkt skilles med fet/invers/understrek; -06 `NO_COLOR` + `--farger terminal` → 16 farger (ADR-011 §3: første treff vinner); -07 **`TERM=xterm-256color` uten truecolor**: ingen `38;2`/`48;2`; -08 `:farger terminal` underveis |
| AK-3-10 Live | `v3-ak10-live.spec.ts` | TC-3-10-01 endret agendaoverskrift på lysbilde 7 → «Pågår nå», 7/10; -02 **sletting av lysbildet man står på** → overgangen «Jobbes med nå», 5/9 (ADR-010 §5); -03 Bases-data endres → raden oppdateres; -04 nytt lysbilde før gjeldende; -05 notatet slettes → «Notatet finnes ikke lenger», kommer tilbake, `q` avslutter (ADR-011 §7); -06 15 raske lagringer |
| AK-3-11 Hygiene, < 80×24 | `v3-ak11-hygiene.spec.ts` | **TC-3-11-01 `q`/`Esc`/`Ctrl c` (kjører)**: exit 0, alternativ skjerm av, markør på, `stty` som før, `?1049h…?1049l` og `?25l…?25h` i riktig rekkefølge; -02 `:q`; **-03 SIGTERM/SIGHUP til appen (kjører)**; **-03b til hele forgrunnsgruppen (kjører, F-1 rettet)**; **-04 `Ctrl c` midt i en tastestorm og en resize (kjører)**; -05 ukjent feil (`VAULT_READER_TEST_CRASH=etter-første-ramme`): gjenopprett, så stakk på hovedskjermen, exit 1; -06 `Ctrl c` i oversikten; **-10 start i 79×23, 79×24, 80×23, 40×12 → melding, `q` rent (kjører)**; **-11 resize til 79×23 og tilbake (kjører)**; -12 meldingen viser ikke innhold, samme lysbilde etterpå |
| AK-3-12 Ytelse | `v3-ak12-terminal-perf.spec.ts` (perf) | TC-3-12-01 generert 2000-vault + «Mange agendapunkter»; appen startes **uten npm** (PO-106) til `1/18` står i bufferet: median av 5 < 3 s (Mac) / < 4,5 s (container); 80 bytter p95 < 50 ms (målt i tmux, øvre grense) |
| AK-3-13 Regresjon | hele suiten | §6 |

## 5. Kanttilfeller

| Kanttilfelle | Forventet | Test |
|---|---|---|
| æøå, emoji, bredde-2-tegn | Riktig bredde (👩‍💻 og 🇳🇴 = 2, A+U+0308 = 1), ingen forskjøvet ramme/statuslinje, ingen tapte tegn | TC-3-05-08 |
| Emoji/CJK i en figlet-tekst | Hele hodet fet (aldri blandet) – «Særtegn 🙂» | TC-3-03-01 (kanter 3) |
| é, ü i en figlet-tekst | NFD uten aksent (`é → E`): «Del én» får figlet | TC-3-03-01 (delte 3), TC-3-02-00 |
| Veldig lange ord og URL-er | Deles mellom grafemer, ingen orddeling, ingenting kuttes; URL-er klikkbare (OSC 8) | TC-3-05-09 |
| Agendapunkt på 80 tegn i ett ord | Aldri figlet (fallback brytes hardt ved 80); agendalinjen avkortes, gjeldende punkt forkortes med «…» (Q-3-02) | TC-3-03-01 (kanter 10), TC-3-04-01 |
| Kodeblokk bredere enn terminalen (~95 tegn ved 80) | Myk bryting med `↪` i dempet gutter, ingen tegn tapt, intern rulling ved 120 linjer | TC-3-05-05, TC-3-07-02 |
| Tabell med mange kolonner ved 80 | Kolonnebredder krympes og celletekst brytes; får ikke minimumsbreddene plass: kortvisning `Kolonne: verdi`; aldri horisontal overflyt; alle celler synlige ved rulling | TC-3-05-06, -07 |
| Terminal på 79×23 (og 79×24, 80×23, 40×12) | «Terminalen er for liten (79×23).» + «minst 80×24», ingen lysbildeinnhold, `q` avslutter rent; ved resize tilbake vises samme lysbilde | TC-3-11-10..12 |
| Resize midt i en presentasjon | Samme lysbilde (id), alt lagt ut på nytt for ny størrelse; også mange hendelser på rad og på en «(forts.)»-del | TC-3-07-04..06, TC-3-03-03 |
| `Ctrl c` midt i en tegning | Terminalen gjenopprettes (alternativ skjerm, markør, `stty`) | TC-3-11-04, -06 |
| SIGTERM / SIGHUP (vinduet lukkes) | Gjenoppretter, exit 143/129 | TC-3-11-03, -03b |
| Ukjent feil | Gjenopprett, deretter stakk på hovedskjermen, exit 1 | TC-3-11-05 |
| Ukjent notatnavn | Melding med argumentet, exit ≠ 0, ingen alternativ skjerm igjen | TC-3-01-06 |
| Flere treff ved fuzzy-søk | Åpnes direkte bare ved ≥ 1,5 × nummer to (ADR-011 §7); ellers liste med søket utfylt («rapport» → 3 treff) | TC-3-01-04, -05 |
| `NO_COLOR` | Ingen fargekoder; fet/invers/understrek bærer uthevingen | TC-3-09-05 |
| `--farger terminal` | Bare 16 ANSI-farger; vinner over `NO_COLOR` (ADR-011 §3) | TC-3-09-04, -06, -08 |
| Terminal uten truecolor (`TERM=xterm-256color`) | 256 farger (nærmeste), ingen `38;2`/`48;2`; ingen OSC 8 | TC-3-09-07, TC-3-05-11 |
| Live endring av lysbildet man står på | Samme lysbilde/nummer etter endret overskrift; Bases-rad oppdateres | TC-3-10-01, -03 |
| Live sletting av lysbildet man står på | Nærmeste nabo, etterfølger først: 5/9 | TC-3-10-02 |
| Notatet slettes | «Notatet finnes ikke lenger», vises igjen når det kommer tilbake | TC-3-10-05 |
| Ikke en terminal (rør/CI) | Norsk melding, exit 1, ingen escape-sekvenser | TC-3-01-11 |
| Web-serveren kjører ikke / ingen nettverk | Ingen TCP-forsøk i det hele tatt | TC-3-01-01 |
| Read-only | Sjekksum av hele vault-kopien uendret | TC-3-01-10 |

## 6. Regresjon (AK-3-13)

Hele suiten kjøres uendret: Vitest (server + web) og Playwright `desktop`, `mobil`, `mock-desktop`, `mock-mobil`, og
`perf` før 3-d. QAs endringer i eksisterende tester: tellingen 105 → 106 notater (fire steder, §3). Spesielt utsatt:

| Område | Hvorfor | Tester |
|---|---|---|
| Lysbildemodell, tilpasning, kommandoer, tastatur | Flyttes til `src/core/` (K1–K6, PO-112) | Hele v2-suiten, `v1.1-ak08-register` (QA oppdaterer `REGISTER_FIL` i `e2e/support/keymap-rules.ts` i samme PR som K5), antall Vitest-tester likt før/etter (1042) |
| `:q` også i web (PO-108) | Ny kommando i katalogen | `v1.1-ak06-07` (`?`-kort og README-tabell teller rader), `v2-ak10-11` |
| Live reload | Terminalen bruker samme `VaultRuntime` | `ak12-live-reload`, TC-2-07-* |
| Layout 360 px | Nytt notat med lange ord/URL og bred tabell | `ak05-layout` (alle notater) |

## 7. Selektorkontrakt mot TUI-en

Terminalen har ingen DOM; kontrakten er hvordan skjermen leses (riggen, §2.1). Avvik avtales med QA før de implementeres.

| Hva | Kontrakt |
|---|---|
| Statuslinje | Siste rad: notattittel · hint (minst «?») · `n/N` **sist** på raden (ADR-011 §4) |
| Agendalinje | Rad 1 på innholdslysbilder: agendapunktene, `n/m` innen punktet; gjeldende med andre SGR-attributter enn naboene; «…» som avkortingsmerke |
| Overskrift | `0n / Overskrift` (agendanummeret), «(forts.)» som tekst |
| Figlet | UX-fontene, tegn i `█▀▄▌▐` i rollen `hode`, skygge i `hode_skygge`; fallback fet `aksent` |
| Plassholdere | Nøyaktig tekstene i T3 / `v3-fasit.json › plassholdere`, ikke fet |
| `:`-linjen | Nederste rad mens den er åpen; feil som `E475`/`E486`/`E492` + norsk tekst |
| For liten | «for liten» + gjeldende `cols×rows` + `80×24` |
| Avslutning | `?1049l` etter siste `?1049h`, `?25h` etter siste `?25l`, `CSI 0m`; stakk etter `?1049l` |
| Lenker | OSC 8 per celle; ekstern = URL, intern = `obsidian://open?vault=…&file=…` (PO-109) |

## 8. Manuelt (Ghostty på Mac)

- Statusmøtet i Ghostty 80×24 og fullskjerm, lys og mørk bakgrunn (OSC 11 → modus), alle fire paletter; skjermdeling i
  Teams/Zoom (delt vindu).
- Endre skriftstørrelse med `⌘+`/`⌘−` (gir SIGWINCH) midt i en presentasjon; lukke vinduet midt i (SIGHUP, se F-1) og
  sjekke at skallet i et nytt vindu er normalt.
- Klikke OSC 8-lenker (ekstern i nettleseren, intern åpner Obsidian, PO-109).
- Kitty-tastaturprotokollen (`CSI u`) – tmux slår den ikke på, så e2e dekker bare klassisk dekoding (ADR-011 §8).
- En annen terminal (Terminal.app: 256 farger, ingen OSC 8) for «degradere pent» (T2).
- PO/kunde: skjermbilder mot UX' mockups i `docs/design/skjermbilder/v3/`.

## 9. Spørsmål til PO (med forslag) – alle QA-forslag godkjent (PO-118, PO-119)

Avgjort av ADR-011/PO-106–112 (testene følger avgjørelsen): fargedybde-rekkefølgen (`--farger terminal` > `NO_COLOR` >
truecolor > 256 > 16), lys/mørk via OSC 11 ellers mørk, E492 for ukjent kommando, fuzzy-terskelen 1,5 ×, «Notatet finnes
ikke lenger», kodebryting med `↪`, tabellenes kortvisning, testkroken for krasj, start uten npm (PO-106), OSC 8 for
interne lenker (PO-109), ingen lagrede valg (PO-107).

| # | Spørsmål | QAs forslag |
|---|---|---|
| Q-3-01 | AK-3-02 «identisk rekkefølge»: terminalen er mindre enn 16:9-lerretet, så et lysbilde kan få flere «(forts.)»-deler ved 80×24 enn i web. Hva betyr «identisk»? | Utkastene (før tilpasning) er identiske ved alle størrelser; den viste lista er **eksakt** lik v2-fasiten ved 200×50, og ved 80×24/120×36 lik når ekstra «(forts.)» hoppes over (progresjonen teller dem, Q-02). Slik er TC-3-02-01/-02 skrevet. |
| Q-3-02 | Agendalinjen når selv «forrige · nåværende · neste» ikke får plass (8 lange punkter ved 80 kolonner; et agendapunkt på 80 tegn). ADR-011 sier bare trinn 2. | Trinn 3: naboene forkortes med «…» (minst 4 tegn + «…»), trinn 4: bare nåværende med «…» på sidene, trinn 5: nåværende forkortes med «…». Progresjonen vises alltid. Fasiten krever i disse tilfellene bare: gjeldende helt (der det går), «…» finnes, linjen ≤ bredden. |
| Q-3-03 | Fallback-hodet (fet): skal det ha strek under (ADR-011 §5) også når teksten brytes over flere rader? | Ja, streken under siste rad, i `dekor`. Testene sjekker bare fet + ingen avkutting. |
| Q-3-06 | Skal lysbildets bakgrunn males med palettens `bg` i truecolor, eller bruke terminalens bakgrunn? Kontrastkravet (AK-3-09) kan bare garanteres hvis vi eier bakgrunnen. | Mal `bg` på hele flaten i truecolor/256; i 16-fargers modus og med `NO_COLOR` brukes terminalens bakgrunn (`farger.json › ansi16` har `bg: default`). TC-3-09-01/-02 forutsetter dette. |
| Q-3-07 | `NO_COLOR` er ikke nevnt i spesifikasjonen; ADR-011 lar `--farger terminal` vinne over den. Greit? | Ja (det er eksplisitt brukervalg, i tråd med no-color.org). TC-3-09-06 følger ADR-en. |
| Q-3-09 | Ukjent notat: exit-kode og hvor meldingen står? | Ingen alternativ skjerm før notatet er løst; melding på stderr «Fant ikke notatet «…». Prøv uten argument for å søke.», exit 2 (som ugyldig argument). Testen krever bare ≠ 0. |
| Q-3-12 | AK-3-12 «lysbildebytte < 50 ms» måles i dag fra `send-keys` til nytt nummer i tmux-bufferet (polling, ~2–5 ms usikkerhet). Holder det? | Ja; med margin over 50 ms er det en øvre grense. Ingen tidskrok i appen (ADR-011: én testkrok). |
| Q-3-13 | `playwright.config.ts`: eget `terminal`-prosjekt (§2.2)? | Avgjort (PO-118): lagt inn av QA. |
| Q-3-14 | Gjeldende punkt i agendalinjen uten farge (`NO_COLOR`): hvilken markering? | Invers (som vim-tabline), samme i 16-fargers modus. |

## 10. Funn i skjelettet (før levering)

| # | Funn | Status |
|---|---|---|
| F-1 | Når **tsx og appen** får SIGTERM/SIGHUP samtidig (som når et terminalvindu lukkes og hele forgrunnsgruppen får SIGHUP), henger prosessen: SIGTERM 4 av 4, SIGHUP 1 av 4 med `--repeat-each 4`. Signal bare til appen virker 8 av 8. | **Rettet i 3-a** (PO-119, PO-123): `npm run present` kjører bunten `scripts/present.mjs` i én prosess; riggen signalerer begge innganger (`APP_INNGANGER`). TC-3-11-03b er grønn (SIGTERM og SIGHUP, 3 av 3 hver). |

## 11. Tilpasninger etter slice 3-b (PO-124 til PO-132)

| Beslutning | Endring i testene/fasiten |
|---|---|
| PO-124 Ingen `n/N` på tittelsiden | `erTittelside()` (statuslinjen «Presentasjon … → neste»), `antallLysbilder()` leser totalen fra lysbilde 2, `forventNotat()` leser notattittelen i statuslinjen på lysbilde 2. `lysbildenummer()` gir `{ n: 1, av: null }` på tittelsiden. |
| PO-125 Figlet-høyde uten tomrader | Høyden summeres over figlet-blokkene (én per linje); `figlet.hoder` regnet om. |
| PO-126 Sats maks 160 | `geometri(cols)` etter design §1.1; figlet-kjeden bruker satsen (ikke marg 0–4); folioen sjekkes mot satsens høyre kant. |
| PO-127 Plassholdere | Mermaid/kanban: fet og dempet, detaljlinjen (`flowchart LR`, `Oppgaver.base`) er lov, aldri kilde/korttitler. Bilde: én dempet linje, ikke fet (design §4.10). |
| PO-128 Marginalia ved 200 | TC-3-05-02: noten i høyre spalte (kolonne ≥ marg + mål) ved 200, nederst ved 80/120. |
| PO-129 Prosentkodet OSC 8 | `osc8Mål()` dekoder med `decodeURI` før sammenligning. |
| PO-130 `--farger terminal` > NO_COLOR | TC-3-09-06 forventer 16 farger. |
| PO-131 Kontrast mot `bg` | TC-3-09-02 måler mot rollen `bg` (lys/mørk) og unntar rollen `dekor`/`fremdrift_spor` (design §6.2: dekor har ikke krav). |
| PO-132 Terminalens tema som standard | TC-3-09-01: standard har bare ANSI-indekser, ingen bakgrunn, aksent fra `ansi16.aksentAvPalett`; truecolor-tester bruker `--palett`. |

Andre tilpasninger: `gåTilFasit()` finner fasitlysbildet på innholdet (ekstra «(forts.)» forskyver nummeret ved
80×24/120×36), `erInnholdsside()` skiller innhold fra overgangene (som viser seksjonens titler som tre); agendalinjens
«…»-sjekker følger design §2.5 (skjulte punkter = « … » som eget element; naboer forkortes til 14 tegn, nåværende til
⅓ av satsen). AK-3-02 i «modulo forts.»-modus godtar fortsettelser uten overskrift (S6/S7) og sjekker alle markører.

**Q-3-15 (ny):** S6 er plassavhengig. «Langt innhold før agenda» får eget lysbilde i v2, men ved 200×50 får innledningen
plass på tittelsiden i terminalen (6 lysbilder i stedet for 7). **Forslag:** godta det – S6 er definert av plassen, som
«(forts.)». TC-3-02-01 godtar varianten der innledningen står på tittelsiden, og sjekker at alle markørene vises i rekkefølge.
