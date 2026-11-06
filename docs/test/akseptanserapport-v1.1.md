# Akseptanserapport v1.1 – lesekomfort og tastaturstyring

Utført av QA 2026-11-06 på branch `claude/beautiful-curie-thcwd3` (HEAD `9302a58`, i tillegg QA-endringene som ikke er committet ennå).
Grunnlag: `docs/produkt/v1.1-spesifikasjon.md` (AK-1.1-01..12), `docs/test/testplan-v1.1.md`, fasit
`test-vault/README-QA.md` §19 og `docs/test/v1.1-fasit.json`.

**Konklusjon: v1.1 anbefales godkjent.** Alle tolv akseptansekriteriene er verifisert automatisk. Det finnes ingen kjente
funksjonsfeil, bare én åpen kosmetisk bug (BUG-014). Noen få punkter må verifiseres manuelt hos kunden på Mac (sjekklisten nederst).

## 1. Kjøringer

Miljø: Linux-container, Node 22, Chromium (Playwright 1.63), `TZ=Europe/Oslo`, `E2E_PORT=4650`.

| Kjøring | Resultat |
|---|---|
| Vitest (enhet + integrasjon) | **948/948** bestått |
| `npm run lint` / `npm run typecheck` | Grønne |
| Playwright, alle prosjekter (`desktop`, `mobil`, `mock-desktop`, `mock-mobil`, `perf` uten vault) | **649 bestått, 0 feilet**, 155 hoppet over (prosjektspesifikke, f.eks. tastatur bare på desktop; perf uten `PERF_VAULT`) |
| v1.1-filene + `ak12-live-reload`, `desktop` + `mobil`, `--repeat-each=3` | **627 bestått, 0 feilet, 0 ustabile** |
| Axe-matrise med v1.1-kontrollene (`v1.1-ak11-12-axe-matrise.spec.ts`) | **24/24** kombinasjoner, 0 brudd |
| Ytelse (`--project=perf`, 2000-vault `--seed 42`) | Alle krav holdt, se §3 |
| Ingen `test.fixme` igjen | Bekreftet (`grep`): alle v1.1-tester er aktive |

QA har gått gjennom alle endringer andre har gjort i v1.1-testene siden QA skrev dem (`git diff 004ebd1..HEAD`). Bare
`test.fixme` er fjernet, og ingen påstander er svekket. Unntakene er justeringer PO har godkjent (PO-69, PO-77, PO-80) og en
ny test fra frontend (`v1.1-po74-fokusring`).

## 2. Status per akseptansekriterium

| AK | Status | Bevis (e2e, testplanens TC-ID-er) |
|---|---|---|
| AK-1.1-01 Lesebredde | **Bestått** | TC-01-01..07: Utseende, `Space w`, `:bredde`; huskes etter reload; ≥ 100 px bredere ved 1440 px; ingen horisontal sidescroll ved 360 px i noen tilstand (rammer, diskré, foldet, zen) |
| AK-1.1-02 Diskré av/på per notat | **Bestått** | TC-02-00..07: Utseende, `Space d`, `:diskret`, toast; bare gjeldende notat; huskes etter tilbake og reload; kildenotatet og andre notater påvirkes ikke; deaktivert med forklaring på `.base` |
| AK-1.1-03 Diskré visning | **Bestått** | TC-03-01..15: ingen ramme/etikett/knapp (beregnet stil); overskriftsnivåene == fasit QA-V11-10 (33 overskrifter, H1–H6 med utflating); TOC == QA-V11-11 (20 punkter); § 1–6 == QA-V11-12, uendret ved folding; kildelenke ved hover og fokus; nestet arver; feilkortene synlige; base og bilde uendret |
| AK-1.1-04 Folding | **Bestått** | TC-04-01..17: alle 10 overskrifter i `Dyp struktur` (seksjonsgrense, `aria-expanded`, navn, indikator); hover/fokus/touch; `za` (fokus og leselinje 30 %, PO-53), `zM`, `zR`; dyplenke, TOC og søk folder ut bare det som trengs; huskes ikke; rammede embeds foldes ikke (PO-54) |
| AK-1.1-05 Zen | **Bestått** | TC-05-00..13: paneler og krom skjult, tittel og properties beholdt, sentrert; sammen med full bredde; overlever lenke, `H` og palett-søk; avsluttes med `Space z`, `:zen`, `Esc` (dialog først, sekvens først) og «Avslutt zen» på touch; starter aldri aktivert |
| AK-1.1-06 Én palett | **Bestått** | TC-06-01..11: `⌘K`/`/` gir søk, `:` gir kommandoer; alle kommandoer i `?`-kortet kan kjøres fra paletten med primærtasten (PO-69); argument-underlister; fuzzy; deaktiverte med begrunnelse; mus/touch |
| AK-1.1-07 `?`-oversikt | **Bestått** | TC-07-01..08: grupper i rekkefølge; hele tastaturkartet; identisk med registeret (kommandoer, tastealternativer, tasthint); README i sync (+ arkitektens `scripts/docs-shortcuts.test.ts`); norsk `?`; plattformriktig `Ctrl K` |
| AK-1.1-08 Reserverte og ⌥-taster | **Bestått** | TC-08-01..10: QAs uavhengige regelsjekk mot `catalogBindings()` og mot det `?`-kortet viser, i tillegg til arkitektens `validateBindings` (Vitest) |
| AK-1.1-09 P7 | **Bestått** | TC-09-01..11: palettfeltet, injisert `input`/`textarea`/contenteditable/`select`, bak Utseende, `?`-kortet og mermaid-zoom; Space på knapp (PO-56); modifikatorer; norsk tastatur via ekte tastehendelser (`:` Shift+., `?` Shift++, `/` Shift+7) |
| AK-1.1-10 P1 | **Bestått** | TC-10-01..03: frontmatter-feller (`diskret-embedding`, `lesebredde`, `zen`, `cssclasses`) ignoreres; med alle funksjoner i bruk er sjekksum og mtime uendret og bare GET/HEAD sendt; valgene lagres bare i `localStorage` |
| AK-1.1-11 v1-regresjon | **Bestått** | Hele v1-suiten grønn (AK1–AK20, Bases, B1, B10, PO-51). WCAG AA i alle 3 typesett × 4 paletter × lys/mørk, også med v1.1-kontrollene åpne (diskré og foldet, zen og full bredde, palett `:`, `?`-kortet): 24/24, 0 brudd. AK17: se §3 |
| AK-1.1-12 Tilgjengelighet | **Bestått** (automatisk) | TC-12-01..06 + axe-matrisen: 0 brudd; fold-knapp med rolle, navn, `aria-expanded` og fokus beholdt; Utseende med tastatur (radiogruppe med ett tab-stopp og piltaster, PO-80); toast `role=status`. VoiceOver: manuell sjekk, se §6 |

Følgefeil som ble funnet og rettet under v1.1: BUG-012 (endringer rett etter oppstart gikk tapt) og BUG-013/PO-78 (omdøping
delt over to SSE-batcher), begge rettet av backend og dekket av tester i `ak12-live-reload`. Testene i `ak12-live-reload`
bruker nå én vault-kopi og én server per test (PO-76).

## 3. Ytelse (AK17 og folding)

2000-vault generert med `generate-large-vault.mjs --count 2000 --seed 42`. Måling i container (CI-kravet er < 4,5 s).

| Måling | Resultat | Krav |
|---|---|---|
| Indeksering, serverens `indexMs` (5 kalde starter) | median **2131 ms** (2001–2755) | < 3 s (Mac), < 4,5 s (container) |
| Fra prosess-start til klar | median 2748 ms | rapporteres |
| Notatbytte uten prefetch (n=20) | median 92 ms, **p95 166 ms** (server p95 13 ms) | p95 < 200 ms |
| Notatbytte med hover-prefetch (n=10) | median 67 ms, p95 111 ms | p95 < 200 ms |
| Folding, enkeltfold med pil, langt notat (300 seksjoner, ~1200 avsnitt), n=40 | median **29 ms**, p95 **45 ms** | < 200 ms (QA-budsjett) |
| `zM` (fold alle), målt fra første tast | median 77 ms, maks 86 ms | < 200 ms |
| `zR` (utfold alle) | median 110 ms, maks 121 ms | < 200 ms |

Folding-målingen er en ny test: `e2e/v1.1-folding-perf.spec.ts`, som kjøres i perf-prosjektet.

## 4. Manuell gjennomgang (skjermbilder)

34 skjermbilder ligger i
`/tmp/claude-0/-home-user-notater/42d2d3a4-f504-5d51-84b3-820da0930dd8/scratchpad/v11-aksept/`:
desktop (1440 px) og mobil (360 px) × Tidsskrift lys og Terminal mørk:

- 01 rapport i rammevisning
- 02 rapport diskré
- 03 kildelenke ved hover
- 04 diskré med foldede seksjoner
- 05 `Dyp struktur` etter `zM`
- 06 zen + full bredde
- 07 `?`-kortet
- 08 palett i kommandomodus
- 09 which-key

Vurdering mot spesifikasjonen:

- **Diskré embedding.** Innholdet glir inn i teksten. Tittelnivåene er riktige. TOC og § følger embedsene (§1 Sammendrag … §6 Bilde og
  base). Kildelenken «Fra Driftsstatus» står i margen ved hover. Feilkortene er synlige.
- **Folding.** Foldet seksjon viser «… 56 ord · UTFOLD»-linjen som diskré indikator. Pilen og §-nummeret står i margen. På
  mobil er pilen synlig uten hover.
- **Zen + full bredde.** Panelene og krom er borte, og tittel og properties er beholdt. Teksten flyter i full bredde. På mobil
  vises «×» (Avslutt zen) øverst til høyre.
- **`?`-kortet.** Par-radene er gruppert som i spesifikasjonen, med «Bare som kommando: :lys :mørk :tema :palett», og
  tasthint-radene er med.
- **Funn: BUG-014 (lav, kosmetisk).** Når to varsler vises samtidig (zen-hint og toast «Full bredde»), legger de seg oppå
  hverandre. På 360 px blir zen-hintet uleselig, og which-key-panelet blir delvis dekket av en toast. Ingen funksjon påvirkes.
  Foreslått løsning: stable varslene.

## 5. Kjente begrensninger

- **Nettlesere:** e2e kjører bare i Chromium. Safari/WebKit (målplattformen) og fysisk norsk Mac-tastatur er ikke testet
  automatisk. Se sjekklisten.
- **`Ctrl d` / `Ctrl u` på Windows/Linux:** kan bli slukt av nettleseren (`Ctrl u` = vis kilde). Akseptert (PO-55). I Chromium på
  Linux virker de.
- **Space ruller ikke lenger** (leader, F7). PageDown, `j` og `Ctrl d` gjør jobben. Space beholder vanlig funksjon på
  knapper, faner og skjemaelementer (PO-56).
- **Caps Lock og døde taster** er dekket av enhetstester, ikke e2e, fordi Playwright ikke kan sette Caps Lock.
- **Diskré-valget** lagres i nettleseren (`localStorage`, per vault og notat). Det følger ikke med til en annen nettleser eller
  maskin, og ryddes ikke for slettede notater (maks 500).
- **Folding og zen huskes ikke**, med vilje (F3, F4). Ved live reload beholdes bare foldene på vertsoverskrifter som
  fortsatt finnes (ADR-009).
- **Spørsmål fra testplanen §7:** de PO ikke har avgjort, er implementert slik QA og ADR-ene foreslo (Q-01/Q-02 nivåer, Q-03
  knappnavn, Q-06 «Avslutt zen»).

## 6. Manuell sjekkliste for kunden (Mac, norsk tastatur, Safari)

Start med `npm start` og åpn `lesekomfort/Kvartalsrapport` i testvaultet, eller et eget vault.

1. **Vim-flyt på norsk Mac-tastatur:**
   - `j` / `k` ruller.
   - `Ctrl d` / `Ctrl u` ruller en halv side.
   - `G` og `gg` går til bunnen og toppen.
   - `H` / `L` går tilbake og frem.
   - `:` (Shift + .) åpner kommandoer, `?` (Shift + +) åpner hurtigtastkortet, og `/` (Shift + 7) åpner søk.
   - ⌥8 (`[`) og andre ⌥-tegn gjør ingenting.
2. **Leader:**
   - `Space` alene ruller ikke. Etter et halvt sekund vises hintet med w, d, z, m og t.
   - `Space w` bytter bredde, `Space d` slår på diskré embedding (vises med toast), `Space z` slår på zen, og `Esc` går ut av zen.
   - `⌘.` bytter lys/mørk, og `⌘K` åpner søk.
3. **Safari:**
   - Gjenta punkt 1–2.
   - Folding: pil ved hover, `za`, `zM` og `zR`. En dyplenke (`Dyp struktur`, «til blokken») skal folde ut.
   - Zen + full bredde skal fungere sammen.
   - ⌘F skal finne tekst i foldede seksjoner (`hidden=until-found` der Safari støtter det; ikke et krav).
4. **VoiceOver** (⌘F5):
   - På fold-knappen leses «Fold sammen «…», knapp, utvidet» og etter trykk «sammenslått».
   - Rotoren viser overskriftene i diskré modus med riktige nivåer (H2 Sammendrag, H3 Funn …).
   - Paletten: skriv `:zen`, så skal valget og hurtigtasten leses opp.
   - `?`-kortet: gruppene leses som overskrifter.
5. **iPhone/iPad (valgfritt, `--lan`):**
   - Fold-pilene er synlige uten hover.
   - Zen kan avsluttes med «×».
   - Ingen sidelengs scroll.
