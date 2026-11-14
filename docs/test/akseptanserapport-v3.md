# Akseptanserapport v3 – presentasjon i terminalen

Eier: QA. Dato: 2026-11-14. Grunnlag: `docs/produkt/v3-spesifikasjon.md` (AK-3-01 til -13), ADR-011,
`docs/design/terminal/designsystem-terminal.md`, PO-106 til PO-138 i `docs/beslutninger.md`, `docs/test/testplan-v3.md`.
Fasit: `docs/test/v3-fasit.json`, `docs/test/v2-fasit.json` (rekkefølgen) og `test-vault/README-QA.md` §20–§21.

**Konklusjon:** Alle 13 akseptansekriterier er **bestått** i de automatiske testene. Ingen `test.fixme` står igjen i
`e2e/terminal/`. Den avsluttende testen fant to nye feil: BUG-016 (middels, bare tester: rammesnapshotene avhenger av
mtime og tidssone) og BUG-017 (lav: dempet tekst i lyst terminaltema når terminalen ikke svarer på OSC 11). Ingen av dem
stopper kundens test, men BUG-016 bør rettes før v3 merges, ellers er `npm test` rød på andre maskiner. QA anbefaler at
v3 går til kundens test. Kundens sjekkliste står i §5.

## 1. Kjøringer

Kjørt i containeren (Linux, tmux 3.4, Node 22) på `E2E_PORT=4810`, mot HEAD `38c51f1` (PO-135/PO-138) med QAs
rettinger for PO-136 i arbeidskopien.

| Kjøring | Resultat |
|---|---|
| Vitest (`npx vitest run`) | **1156/1156** bestått. Med `TZ=Europe/Oslo` (teststrategi §1.4): 33 rammesnapshots feiler – **BUG-016**. Under full last feilet én gang tidsmålingen «2000 notater: rangering under 10 ms per tast» (20,9 ms; samtidig med Playwright). Grønn i ro. |
| `npm run lint`, `npm run typecheck` | Grønne |
| Playwright, alle prosjekter (`desktop`, `mobil`, `mock-*`, `terminal`, `perf` uten `PERF_VAULT`) | **1139 bestått**, 339 hoppet over (prosjektspesifikke), **1 ustabil**: `v1.1-ak05-zen` TC-05-08 feilet én gang under last (Vitest kjørte samtidig). Deretter 60/60 med `--repeat-each=5`. Ikke berørt av v3. |
| Terminalprosjektet, `--repeat-each=3` | **903/903** bestått (301 × 3), ingen ustabile |
| Ytelse, TC-3-12-01 (`--project=perf e2e/terminal`, 2000-vault `--seed 42`) | Se §3. Bestått i to kjøringer. |
| Skjermbilder | 90 bilder: statusmøtet ved 80×24, 120×36, 200×50 × (terminalfarger mørkt tema, terminalfarger lyst tema, `--palett fosfor`), §4 |

### 1.1 Rettinger i testene etter 3-c (PO-136)

| Test | Retting |
|---|---|
| TC-3-07-04, -06 | Venter på omtegning etter resize (folioen mot satsens høyre kant). `geometri()` sentrerer satsen over 160 kolonner (design §1.1). TC-3-07-06 sjekker siste lysbilde som n = N, siden «(forts.)»-delene endrer nummeret. |
| TC-3-07-02 | Rullingen venter opptil ~600 ms per tast; under last kom omtegningen sent, og rullingen stoppet ved linje 116. |
| TC-3-08-06 | Venter på hjelpevinduet «Hurtigtaster», ikke på «→ neste» i starthintet. |
| TC-3-08-07 | Totalen leses fra lysbilde 2 (PO-124), og navigasjonen går via innholdet. |
| TC-3-08-08, TC-3-09-08 | Råstrømmen avgrenses etter Enter: kommandolinjen tegnes i paletten mens man skriver, og det ga falske 38;2-koder. Venter til omtegningen er ferdig skrevet (`ventPåRo`). Bekreftelsen i statuslinjen (PO-134) gjør at bare folioen sammenlignes. |
| TC-3-03-03 | Fasiten følger kjeden: «Kundetilbakemeldinger og support» er bredere enn satsen (160) i vr-blokk → to linjer ved 200×50, fet fallback ved 80×24. |
| TC-3-06-01 | Bildeplassholderen er fet og dempet (PO-134). |
| TC-3-12-01 | Fixme fjernet. Måler `node scripts/present.mjs` (= `npm run present` uten npm, PO-106) til tittelsiden står i bufferet. |

QA har gått gjennom utviklerens endringer i QA-filene i 3-c (bare fjerning av `fixme`) og er enig i dem.

## 2. Status per akseptansekriterium

| AK | Status | Bevis |
|---|---|---|
| AK-3-01 Start, notatliste, frittstående | **Bestått** | TC-3-01-01..12: tittelsiden, eksakt/fuzzy/flere treff/ukjent notat, notatliste med søk (PO-122), NFD, `--vault`, read-only (sjekksum), ikke-TTY, `--hjelp`. Nettvakten registrerte **ingen** TCP-forsøk. |
| AK-3-02 Rekkefølge = v2 | **Bestått** | TC-3-02-00/-00w (fasit og web), -01 eksakt ved 200×50 for 9 notater, -02 ved 80×24/120×36 «modulo forts.», -03 `--niva h4/h2`, -04 «Mye innhold», -05 `--uten-agenda`, -06. S6 er plassavhengig (Q-3-15): «Langt innhold før agenda» har innledningen på tittelsiden ved 200×50. |
| AK-3-03 Figlet-hode | **Bestått** | TC-3-03-01 for alle 41 T/A/O-lysbilder × 3 størrelser mot kjeden i ADR-011 §5 (vr-blokk 1–2 linjer, vr-smal, fet fallback; emoji → fet), farger `hode`; -02 aldri på innhold; -03 resize. |
| AK-3-04 Agendalinje | **Bestått** | TC-3-04-01..05: utheving, progresjon, avkorting etter design §2.5 ved 80 og 200, ingen linje på T/A/O, «0n /». |
| AK-3-05 Kode, tabeller, callouts, Bases | **Bestått** | TC-3-05-01..11 ved 80×24, 120×36, 200×50: Shiki-farger, booktabs, fotnoter (marginalia ved 200, PO-128), callouts, Bases «Kritisk», kode bredere enn terminalen (`↪`), 12×40- og 10-kolonnerstabell, æøå/emoji/bredde-2, lange ord og URL, OSC 8 eksternt og `obsidian://` (PO-109, prosentkodet PO-129). |
| AK-3-06 Plassholdere | **Bestått** | TC-3-06-01 (Mermaid × 2, kanban, bilde × 3 størrelser), -02 høyt diagram. |
| AK-3-07 Tilpasning | **Bestått** | TC-3-07-01..06: listepunkter deles ikke, intern rulling (alle 120 kodelinjer), ingenting kuttes, resize midt i presentasjonen, resize på «(forts.)», mange resize-hendelser. |
| AK-3-08 Taster og `:` | **Bestått** | TC-3-08-01..11: alle neste/forrige-taster med grenser, `gg`/`G`, oversikt, svart skjerm, `?`, `:presenter`, `:agenda av`, `:palett`, `:farger terminal`, E475/E486/E492 (PO-135), `:q`, statuslinjen. |
| AK-3-09 Farger | **Bestått** | TC-3-09-01 terminalfarger som standard (PO-132): bare ANSI-indekser, ingen bakgrunn; -02 fire paletter: truecolor, malt `bg`, kontrast ≥ 4,5/3 mot `bg` (PO-131); -04/-06 `--farger terminal` (vinner over NO_COLOR, PO-130); -05 NO_COLOR; -07 xterm-256color; -08 bytte underveis. Se BUG-017. |
| AK-3-10 Live | **Bestått** | TC-3-10-01..06: overskrift, sletting av gjeldende lysbilde (5/9), Bases-data, nytt lysbilde før, notatet slettes og kommer tilbake, 15 raske lagringer. |
| AK-3-11 Hygiene, < 80×24 | **Bestått** | TC-3-11-01..12: `q`/`Esc`/`Ctrl c`/`:q`, SIGTERM/SIGHUP til appen og til hele forgrunnsgruppen (F-1 rettet), `Ctrl c` under tegning, ukjent feil (testkrok, stakk etter `?1049l`), 79×23/79×24/80×23/40×12, resize tilbake. |
| AK-3-12 Ytelse | **Bestått** | §3 |
| AK-3-13 Regresjon | **Bestått** (med BUG-016) | §1 |

## 3. Ytelse (AK-3-12, PO-106)

Generert vault med 2000 notater (`--seed 42`) + «Mange agendapunkter» (18 lysbilder). Start måles fra prosessstart
(`node scripts/present.mjs`, uten npm) til tittelsiden står i tmux-bufferet; bytte fra `send-keys` til nytt nummer i
bufferet (polling, øvre grense). Krav i container: start < 4,5 s, bytte < 50 ms.

| Kjøring | Start, median (alle 5) | Bytte, p95 (median / maks av 80) |
|---|---|---|
| 1 | **2487 ms** (3098 / 2442 / 2746 / 2333 / 2487) | **14,9 ms** (9,6 / 20,9) |
| 2 | **2603 ms** (3132 / 2352 / 2603 / 2432 / 2765) | **17,2 ms** (9,6 / 27,0) |

Første start er kald (≈ 3,1 s). Også medianen holder Mac-kravet på 3 s med margin.

## 4. Skjermbilder

`/tmp/claude-0/-home-user-notater/42d2d3a4-f504-5d51-84b3-820da0930dd8/scratchpad/v3-aksept/png/` (90 PNG,
`NN-statusmote-<kol>x<rader>-<variant>.png`), med rå ANSI-fangster i `…/v3-aksept/ans/` og verktøyene i
`…/v3-aksept/verktoy/` (`fang.sh` fanger hvert lysbilde med `tmux capture-pane -e -N`; `ans-til-png.mjs` er UX sitt
`ans-til-html.mjs` med inn-/utmappe fra miljøet). Varianter:

- `ansi16-mork` – standard terminalfarger (PO-132) i et vanlig mørkt tema.
- `ansi16-lys` – **samme** ANSI-strøm i et vanlig lyst tema. tmux svarer ikke på OSC 11, så appen har valgt mørkt kart.
  Det viser BUG-017 (dempet = ANSI 7). I Ghostty med lyst tema svarer terminalen, og lyst kart brukes – se sjekklisten.
- `fosfor-mork` – `--palett fosfor`, truecolor med malt bakgrunn.

Statusmøtet har 10 lysbilder ved alle tre størrelsene (designdokumentet §2.6 nevner 12 / 10 / 9; det stemmer ikke
lenger med appen, og 10 = v2-fasiten).

## 5. Kjente begrensninger

- **BUG-016** (åpen): rammesnapshotene i `src/terminal` avhenger av mtime og tidssone.
- **BUG-017** (åpen): lyst terminaltema uten OSC 11-svar gir nesten usynlig dempet tekst.
- Lys/mørk og kitty-tastaturet kan ikke testes automatisk i tmux (ingen OSC 11-svar, CSI u slås ikke på). Dekkes av
  enhetstester og manuell sjekk.
- Ulik tegnbredde mellom terminaler (emoji med VS16, CJK-oppsett) er en kjent begrensning (ADR-011).
- Tidsmålingen av lysbildebytte er en øvre grense (polling av tmux).
- `Ctrl z` støttes ikke (PO-110). Ingen nyanser fra OSC 4/10/11 i v3 (PO-137).
- Testene krever tmux ≥ 3.2 (`brew install tmux` på Mac); uten tmux feiler de med en tydelig melding.

## 6. Manuell sjekkliste for kunden (Ghostty på Mac)

| # | Sjekk | Forventet |
|---|---|---|
| 1 | `npm run present -- "Statusmøte uke 45"` i Ghostty med **ditt eget tema**, mørkt og lyst | Fargene er temaets egne; ingen bakgrunn males; dempet tekst, aksent og agendalinjen er lesbare i begge |
| 2 | Samme med `--palett fosfor` (og `:palett signal`, `:farger terminal`) | Palettens bakgrunn fyller hele vinduet; `:farger terminal` går tilbake til temaet |
| 3 | **Del terminalvinduet** i Teams og Zoom (ikke hele skjermen), bla gjennom alle lysbilder | Figlet-hodene, tabeller og fremdriften (`━`/`─`) er lesbare på mottakersiden; ingen flimring |
| 4 | **`Ctrl +` / `Ctrl −`** (eller `⌘+`/`⌘−`) midt i presentasjonen | Lysbildet tegnes på nytt for ny størrelse; samme lysbilde; under 80×24 kommer meldingen «Terminalen er for liten», og lysbildet kommer tilbake |
| 5 | **Lukk Ghostty-vinduet** midt i presentasjonen, åpne et nytt | Det nye skallet er normalt (ekko, markør); ingen hengende prosess (`ps` viser ingen `present.mjs`) |
| 6 | **Cmd-klikk** på «Månedsrapport oktober» (Plan Q1) og på en ekstern lenke | Obsidian åpner notatet (`obsidian://`), nettleseren åpner URL-en |
| 7 | Start mot **vaultet med 2000 notater** (`--vault <sti>`) | Tittelsiden vises på under 3 s; bla føles øyeblikkelig |
| 8 | Endre en overskrift i Obsidian mens presentasjonen står på lysbildet | Oppdateres uten å miste plassen |
| 9 | `q`, `Esc` og `Ctrl c` | Terminalen er som før start |
