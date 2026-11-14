# Handover – Vault-leser (for ny Claude-session)

Sist oppdatert: 2026-11-14. Skrevet av PO (Claude) for å kunne fortsette i en ny session uten tapt kontekst.

> **Til ny session:** Les dette dokumentet først, deretter `docs/beslutninger.md` (nederst er nyest). Ikke start utvikling før kunden ber om det.

## 1. Rollen din og arbeidsformen

- Du er **Product Owner** for et team: arkitekt, UX/webdesigner, frontendutvikler, backendutvikler, test- og QA-ansvarlig. **Du skriver ikke kode selv.** Teamet er subagenter (Agent-verktøyet) som du starter og koordinerer. (Kunden reagerte da PO kodet selv – deleger.)
- **Svar alltid på norsk.** Kunden er vim-entusiast, bruker **Mac, Ghostty, norsk tastatur, Node 24/npm 11** og et firma-npm-oppsett med Sonatype-brannmur.
- **Arbeidsflyt per versjon** (har fungert godt):
  1. Diskuter ønsket med kunden, still konkrete spørsmål med anbefaling, til felles forståelse.
  2. Skriv `docs/produkt/v<N>-spesifikasjon.md` med akseptansekriterier → kunden godkjenner.
  3. Parallelt: **arkitekt** (ADR + skjelett), **UX** (designsystem + prototype + skjermbilder), **QA** (testvault, fasit, testplan, akseptansetester som `test.fixme` – TDD).
  4. Vis kunden prototype/skjermbilder før implementasjon.
  5. Utvikler(e) leverer i slices med rapport etter hver. QA tilpasser og fjerner fixme.
  6. QA: avsluttende akseptansetest + `docs/test/akseptanserapport-v<N>.md` med manuell sjekkliste for kunden.
  7. Kunden tester og godkjenner → PR mot `main` (kunden merger, eller ber deg merge).
- **Detaljspørsmål avgjør du selv** og logger som `PO-<nr>` i `docs/beslutninger.md`. Store spørsmål tas med kunden.
- **Rapporter jevnlig** til kunden: kort, med skjermbilder (SendUserFile) og konkrete kommandoer for å teste.

## 2. Praktisk i miljøet

- **Branch:** `claude/beautiful-curie-thcwd3`. Etter at en PR er merget: start branchen på nytt fra `origin/main` (fast-forward fungerer siden merge-committen bygger på branchen; force-push er blokkert).
- **Stop-hook** krever at alt er committet og pushet – committ WIP underveis med tydelig melding.
- **Bruksgrenser:** agenter stopper ved 5-timers/ukesgrense. Arbeidet er lagret; committ WIP og send `SendMessage` til samme agent for å fortsette (ikke start ny). Agent-ID-er fra denne sessionen gjelder ikke i en ny session – start nye agenter med full kontekst (pek dem til dokumentene under).
- **Playwright/Chromium er forhåndsinstallert** – instruer alltid agenter: «kjør ALDRI `playwright install`». Bruk egen `E2E_PORT` per agent (4600–4900) for å unngå kollisjoner.
- **Terminaltester** krever `tmux` (headless tmux-rigg i `e2e/support/terminal.ts`).
- **Avhengighetspolicy (ADR-006):** alle låste pakker ≥ 21 dager gamle (kundens npm-brannmur setter ferske versjoner i karantene). Sjekk med `npm run check:deps`. Oppdater med `npm install --before=<dato for 21 dager siden>`. Anbefal kunden `npm ci`.
- **GitHub:** bruk `mcp__github__*`-verktøyene (lastes via ToolSearch). Repo: `orose/notater`.

## 3. Status

| Versjon | Innhold | Status |
|---|---|---|
| v1 | Leser: wikilinks, embeds, callouts, kode (Shiki), Mermaid, Bases (tabell/kanban), ⌘K-søk, live reload, temaer (3 typesett × 4 paletter × lys/mørk), `--lan` | Merget (orose/notater#1) |
| v1.1 | Lesebredde, zen, folding, diskré embedding, kommandoregister, felles palett (`:`), `?`-oversikt, vim-taster, Space-leader | Merget (orose/notater#1) |
| v2 | Presentasjonsmodus i web: agenda, overganger, agendalinje, 16:9-lerret, «(forts.)», oversikt, svart skjerm, live | Merget (orose/notater#2) |
| v3 | Presentasjon i terminalen (`npm run present`), delt kjerne `src/core`, egen ANSI-renderer, FIGlet med æøå, terminalens eget fargetema som standard | **Godkjent av kunden. PR åpen: orose/notater#3 – ikke merget.** |

**Kunden har bedt om at utviklingen IKKE fortsetter etter v3-PR-en** før de sier fra. Ingen agenter har aktive oppdrag.

Siste kjente testresultat (v3): Vitest 1157/1157, terminal-e2e 301/301, øvrige Playwright-prosjekter grønne. Ytelse: indeksering 2000 notater ~2,1–2,3 s, terminaloppstart ~2,4 s, lysbildebytte web p95 33 ms / terminal 15–17 ms.

## 4. Viktige dokumenter

| Hva | Hvor |
|---|---|
| Opprinnelig brief og akseptansekriterier | `docs/produkt/brief.md`, `bases-eksempler.md` |
| Spesifikasjoner | `docs/produkt/v1.1-`, `v2-`, `v3-spesifikasjon.md` |
| **Alle beslutninger** (PO-1 … PO-138, AR-*, BE*) | `docs/beslutninger.md` |
| Arkitektur | `docs/arkitektur/ADR-001` … `ADR-011`, `api.md`, `struktur.md` |
| Design | `docs/design/designsystem.md` (§11 v1.1, §12 presentasjon), `tokens.css`, prototyper `prototype*.html`, `docs/design/terminal/` |
| Test | `docs/test/teststrategi.md`, `testplan-*.md`, fasit `*-fasit.json`, `bugs.md`, `akseptanserapport-*.md` |
| Testvault (syntetisk) | `test-vault/` med `README-QA.md` (fasit per notat) |
| Bruk | `README.md` |

## 5. Bindende prinsipper (ikke bryt uten kunden)

- **Read-only:** løsningen skriver aldri til vaultet. (Skrivemodus ble vurdert og **droppet** av kunden – «den er god i Obsidian».)
- **P1:** frontmatter er data – ingen visningsvalg leses fra eller skrives til notatene. Valg lever i leseren (localStorage, flagg).
- **P2:** ett kommandoregister (`src/core/commands`) driver palett, `?`, README-tabell og terminal.
- **P4/P5:** reserverte taster for fremtidig redigering (`i a o e I A O s c d x p y u r`, Esc) i normal-modus; ingen ⌥-avhengige taster (norsk tastatur).
- Ingen nettverkskall ut; server binder 127.0.0.1 (unntatt eksplisitt `--lan`).
- Web og terminal deler én lysbildemodell (`src/core/presentation`) – ikke dupliser logikk.
- Kodestil: TypeScript, React funksjonelle komponenter, named exports, ingen default exports, ingen star-imports, feature-basert struktur, TDD.

## 6. Backlog / mulige neste steg (ikke bestilt)

- PO-83: toasten «Fant ikke seksjonen …» inn i felles varselsone (web).
- PO-105: «● live»-merke og kanban-glød i base-hodet (web-presentasjon).
- PO-137: avlede nyanser fra terminaltemaet via OSC 4/10/11.
- Kanban i web-presentasjon ruller internt når den ikke får plass – kunden har ikke tatt stilling til kompakte kort.
- Ideer kunden har nevnt/fått foreslått: PDF-eksport av presentasjon, presentatørvisning, lenkehint (Vimium-stil), avsnittsdemping i zen, Safari/WebKit i automatiske tester, grafvisning, terminal-leser (ikke bare presentasjon).
- Kjente begrensninger: se «Kjente begrensninger» i hver akseptanserapport.

## 7. Hvordan starte i ny session

1. Les denne fila og de nyeste avsnittene i `docs/beslutninger.md`.
2. Sjekk PR-status for orose/notater#3 (merget eller ikke). Hvis merget: start branchen fra `origin/main`.
3. Spør kunden hva som er neste ønske – ikke start utvikling uoppfordret.
