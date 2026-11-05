# Beslutnings- og antakelseslogg

Format: dato · hvem · beslutning/antakelse · begrunnelse · status. Status: **Vedtatt**, **Antakelse**
(må verifiseres, typisk mot ekte Obsidian), **Åpen** (venter på PO).

## Arkitektur (2026-11-05, arkitekt)

| # | Beslutning / antakelse | Begrunnelse | Status |
|---|---|---|---|
| A1 | Én npm-pakke, ingen workspaces. `src/server`, `src/web`, `src/shared`. | Enklest; ingen pakker publiseres. | Vedtatt |
| A2 | Serveren kjøres med `tsx` (dev og `npm start`), ingen server-kompilering. Typesjekk med `tsc -b`. | Færre byggesteg, ingen `.js`-endelser. | Vedtatt |
| A3 | Node ≥ 22.22 kreves (`engines`). | Vite 8/jsdom 31 krever nyere 22.x. | Vedtatt |
| A4 | TypeScript ~6.0, ikke 7. | typescript-eslint støtter < 6.1. | Vedtatt |
| A5 | Playwright låst til eksakt 1.63.0. | Matcher forhåndsinstallert Chromium (1243). | Vedtatt |
| A6 | HTTP: Hono. | Lett, typet, testbar uten nettverk. | Vedtatt |
| A7 | Markdown parses og rendres på serveren; klienten får sanitert HAST (JSON) og rendrer med `hast-util-to-jsx-runtime`. | Obsidian-syntaks krever vault-kunnskap; ingen innerHTML. ADR-002. | Vedtatt |
| A8 | Sanitering skjer etter `rehype-raw`, før våre pålitelige transformasjoner (callouts, Shiki, embeds, Bases, Mermaid). | Én tydelig sikkerhetsgrense. ADR-002. | Vedtatt |
| A9 | Shiki med ett CSS-variabel-tema (ikke dual themes). Paletter defineres kun i CSS. Utvides med `number`/`type`/`property` slik UX har i `tokens.css`. | Ubegrenset antall paletter uten re-render. | Vedtatt |
| A10 | Mermaid kun klient-side, lazy-lastet, `securityLevel: 'strict'`, tema fra CSS-variabler. | Trenger DOM; stort bibliotek. | Vedtatt |
| A11 | Bases evalueres på serveren med egen lexer/Pratt-parser/evaluator. Klienten får ferdig gruppert/sortert resultat. | Ingen `eval`; indeksen er på serveren. ADR-003. | Vedtatt |
| A12 | Ingen «aktivt vault» på serveren. Vault-id i alle URL-er (`/v/:vaultId/...`, `/api/vaults/:vaultId/...`). Indekser opprettes lat. Konfigens `defaultVault` styrer kun `/`-redirect. | Bokmerkbare URL-er på tvers av vaults, ingen delt mutabel tilstand. | Vedtatt |
| A13 | Dokumentstier i API-et sendes som query-parameter (`?path=`), ikke path-segment. | Unngår enkodingsfeil med `/`, `#`, `%`, mellomrom. | Vedtatt |
| A14 | `DocPath` = sti uten `.md` for notater, med endelse for alt annet. | Pene URL-er som speiler Obsidian. | Vedtatt |
| A15 | Path traversal hindres ved at alle stier slås opp i indeksen; disk-stier bygges kun fra indekserte relative stier. | Traversal umulig by construction. ADR-005. | Vedtatt |
| A16 | Host-header-sjekk (kun `127.0.0.1`/`localhost`) mot DNS-rebinding. | Binding til 127.0.0.1 alene beskytter ikke mot rebinding. | Vedtatt |
| A17 | Ingen `--host`-flagg. | AK20. Lesing fra mobil over LAN krever egen PO-beslutning. | Vedtatt |
| A18 | Konfig: `vault-reader.config.json` (sjekket inn, peker på `./test-vault`); `vault-reader.config.local.json` (git-ignorert) erstatter den helt. Presedens CLI > env > fil > standard. | `npm start` virker rett etter kloning; kundens stier havner ikke i git. ADR-005. | Vedtatt |
| A19 | Filovervåking med chokidar v4, debounce 150 ms, `awaitWriteFinish`. Live reload via SSE + `invalidateQueries`. | Robust mot Obsidians skrivemønster. ADR-004. | Vedtatt |
| A20 | Render-cache tømmes helt ved hver indeksendring. | Embeds/Bases/backlinks gjør finmasket invalidering feilutsatt; endringer er sjeldne. | Vedtatt |
| A21 | Embeds: syklusvern via stakk, maks dybde 4. | Hindrer uendelig rekursjon og eksplosjon. | Vedtatt |
| A22 | ESLint håndhever B3/B5 (`export default` og `import * as` gir feil). Konfigfiler for verktøy er unntatt. Default-*import* av tredjepartsbiblioteker (f.eks. mermaid) er tillatt. | Regler som håndheves maskinelt blir fulgt. | Vedtatt |
| A23 | Relative importer uten filendelse. | Konsistent med `moduleResolution: bundler`. | Vedtatt |
| A24 | Fonter via `@fontsource-variable/*` (valg av familie: UX). | B10: ingen nettverkskall ut. | Vedtatt |
| A25 | Port 4317 (app), 5173 (Vite dev), 4318 (e2e). | Unngå kollisjon med vanlige porter. | Vedtatt |

## Obsidian-semantikk – antakelser som QA bør verifisere

| # | Antakelse | Status |
|---|---|---|
| O1 | Wikilinks løses **ikke** via aliaser (som i Obsidian). Aliaser brukes i ⌘K-søk. | Antakelse – se U1 |
| O2 | Lenkeoppløsning: eksakt sti → relativ (`./`, `../`) → sti-suffiks/basename case-insensitivt; ved flere treff: samme mappe som kilde, så korteste sti, så alfabetisk. | Antakelse |
| O3 | `[[x#Overskrift]]` matcher overskriftstekst case-insensitivt; `#A#B` bruker siste ledd. Ukjent anker = ikke brutt lenke. | Antakelse |
| O4 | `file.folder` for filer i rotmappen er `"/"`; ellers mappesti uten skråstrek på slutten (`domene/sub`). | Antakelse |
| O5 | `file.inFolder("x")` er sann også for undermapper av `x`. | Antakelse |
| O6 | Sammenligning mellom ulike typer gir `false`; manglende property er `null`; `null != "done"` er `true`. | Antakelse |
| O7 | Sortering: null sist uansett retning; strenger med `Intl.Collator('nb', { numeric: true })`. | Antakelse |
| O8 | Parse-feil i et Bases-filter → filteret ignoreres + advarsel (ikke tomt resultat). | Vedtatt (arkitekt) |
| O9 | Notattittel = filnavn uten endelse (frontmatter `title` brukes ikke som tittel). | Antakelse |
| O10 | `==markering==` som krysser formatering (`==**fet**==`) støttes ikke i v1. | Vedtatt (begrensning) |
| O11 | `.excalidraw.md` behandles som `unsupported` (ikke som vanlig notat). | Antakelse |

## Åpne spørsmål / utfordringer til PO

| # | Spørsmål | Arkitektens anbefaling |
|---|---|---|
| U1 | Briefen nevner lenkeoppløsning med aliaser. Obsidian løser ikke `[[Alias]]` til en fil. Skal vi avvike fra Obsidian? | Nei – følg Obsidian (O1). Ellers vises lenker som virkende hos oss og brutte i Obsidian. |
| U2 | `kanban` er ikke en innebygd Bases-view i Obsidian (plugin). Hvilken plugin bruker kunden, og har den flere innstillinger enn `groupBy`/`groupOrder`? | Implementer det som står i bases-eksempler.md; be kunden om skjermbilde. |
| U3 | B7 «mobilvennlig» + AK20 «kun 127.0.0.1»: skal kunden kunne lese fra telefonen? Det krever LAN-binding. | Ikke i v1. Mobilvennlig = responsivt design testet i Playwright-mobilprofil. |
| U4 | AK17 «< 3 s» – gjelder det kald oppstart inkludert `vite build` i `npm start`? | Måles som tid fra serverstart til indeks klar; `vite build` ekskluderes. |
| U5 | Node-versjon hos kunden er ukjent. | Krev Node ≥ 22.22 (eller 24 LTS) i README. |

## PO-avgjørelser etter arkitektrapport (bølge 1)

- **PO-1 Aliaser:** Følg Obsidian. `[[Alias]]` løses IKKE via frontmatter-`aliases`; aliaser brukes kun i ⌘K-søk og vises i notat-header. Briefen justeres.
- **PO-2 Kanban:** Kunden har bekreftet at kanban er en innebygd Bases-view i deres Obsidian-versjon. Formatet i `bases-eksempler.md` er fasit. Ingen videre avklaring.
- **PO-3 Mobil:** v1 = responsivt design, verifisert med Playwright mobilprofil. Server binder 127.0.0.1 som default. I slice 6 legges et eksplisitt opt-in-flagg (`--lan`) som binder 0.0.0.0 og skriver en tydelig advarsel i konsollen – slik at kunden kan teste på telefon på hjemmenettet.
- **PO-4 AK17:** Måles fra serverstart til indeks klar (eksklusiv `vite build`). `npm start` skal gjenbruke eksisterende build hvis kilden er uendret.
- **PO-5 Node:** README krever Node 22.22+ (eller 24 LTS), med `.nvmrc`. `npm start` sjekker versjon og gir forståelig feilmelding.
- **PO-6 npm audit (minimatch via ESLint):** Akseptert, kun dev-avhengighet.

## PO-avgjørelser etter QA-rapport (bølge 1)

Alle QA-forslag i README-QA §17 er **godkjent** slik de står, med disse presiseringene:
- **PO-7** `[[Alias]]` er brutt lenke (PO-1), men brutt-lenke-visningen viser hint «Mente du *X*?» når et alias matcher.
- **PO-8** Tvetydig lenke: samme mappe først, deretter korteste sti; diskret tvetydighetsindikator.
- **PO-9** Lenker i properties teller som backlinks.
- **PO-10** Tagger er case-insensitive (`#Task` == `task`). Property-*verdier* er case-sensitive (`Todo` ≠ `todo`).
- **PO-11** Kanban uten `sort` → sorter på `file.name`. Tomme `groupOrder`-kolonner vises.
- **PO-12** `![[X.base#View]]` viser kun navngitt view.
- **PO-13** Inline LaTeX vises rått. Eksterne bilder lastes ikke (B10) – vises som lenke med ikon.
- **PO-14** Enkelt linjeskift → `<br>` (Obsidian-default). Callout-titler på norsk når tittel ikke er oppgitt.
- **PO-15** Maks embed-dybde 5. TOC vises fra og med 3 overskrifter.
- **PO-16** CSP-header: ja.
- **PO-17** E2E kjører mot en kopi av test-vault i temp-mappe med fixture-mtimes (globalSetup). Testene skriver aldri i repoet.
