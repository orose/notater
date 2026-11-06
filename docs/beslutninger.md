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

## PO-avgjørelser etter UX-rapport (bølge 1)

Designet (docs/design/) er **godkjent** som referanse for implementasjon.
- **PO-18** Tredje typesett «Klartekst» (Atkinson Hyperlegible Next): ja, men lav prioritet (slice 6).
- **PO-19** Initial og seksjonsnummer: global av/på-bryter i temavelgeren («Ornamentikk»), default på. Ikke per notat i v1.
- **PO-20** Fotnoter som sidenoter på bred skjerm; faller tilbake til fotnoteliste nederst på smal skjerm/mobil.
- **PO-21** Ingress hentes fra frontmatter `description`, deretter `summary`; ellers ingen ingress.
- **PO-22** Skjulte properties i header: `aliases` og `tags` vises i egne dedikerte felt (ikke som property-rader); `cssclasses`, `publish`, `position` skjules alltid. Ekstra skjulte properties kan settes per vault i config (`hiddenProperties`).
- **PO-23** Lesetid i header: ja.

## PO-avgjørelser etter frontend-rapport (slice 0–2)

Frontendens avvik 1–8 er **godkjent** (temascript som ekstern fil pga. CSP; brutte lenker er ikke-navigerbare knapper med forklaring per QA-fasit; CSS per feature; `recent`-feature; tooling-tsconfig).
- **PO-24** Nytt endepunkt `GET /api/vaults/:id/tags` → `{ vaultId, tags: [{ tag, count }] }`. Ukjente API-ruter svarer 404, ikke 400.
- **PO-25** Brutte lenker med aliastreff får `data-vr-suggest` + `data-vr-suggest-title` (PO-7).
- **PO-26** Tvetydige lenker får `data-vr-ambiguous="<antall kandidater>"` (PO-8).
- **PO-27** Ugyldig frontmatter: dokumentet får `frontmatterError: string | null`.
- **PO-28** Backlinks for ikke-eksisterende mål: siden «ikke skrevet ennå» viser «Lenket fra». Server eksponerer dette (f.eks. backlinks-endepunkt som godtar mål uten fil).
- **PO-29** `hiddenProperties` filtreres på serveren. Klienten får aldri skjulte properties.
- **PO-30** Fotnoteoverskrift «Fotnoter» settes på serveren.
- **PO-31** SSE `/api/events` holdes åpen med heartbeat (kommentar-linje hvert 15. s).

## Backend (slice 0–2, 2026-11-05, backend-utvikler)

| # | Beslutning / antakelse | Begrunnelse | Status |
|---|---|---|---|
| BE1 | Ny feature `markdown-syntax` (laveste lag) eier Obsidian-markdown → mdast. Både indeks og rendering bruker den. | ADR-004 krever samme parser for metadata og rendering; uten eget lag ville `vault-index` måttet avhenge av `markdown`. | Vedtatt |
| BE2 | Indeksen parser med GFM **uten autolink-literal**; rendering bruker full GFM. | Autolink-literal kostet ~1/3 av parsetiden og påvirker kun eksterne URL-er (aldri vault-lenker). Test sikrer like wikilinks/tagger/blokk-id-er. | Vedtatt |
| BE3 | Metadata-uttrekk i `worker_threads`-pool (alle kjerner, maks 8) ved første indeksering; inline ved inkrementelle endringer. | ADR-004-fallback: én tråd brukte 5,8 s på 2000 notater. | Vedtatt |
| BE4 | Alle Obsidian-transformasjoner i mdast gjøres i **ett** rekursivt pass (ikke `findAndReplace`/`visit` per regel). | Målt ~1 s spart per 2000 notater. | Vedtatt |
| BE5 | Pålitelige noder (wikilinks, tagger, kode, mermaid, base, ikke-støttet) går gjennom sanitizeren som tomme plassholdere `data-vr-ref="<nonce>-<n>"`, og bygges etter sanering fra en sidetabell. Nonce er tilfeldig per rendering. | Sanitizer-skjemaet kan holdes stramt (ingen `vr-*` eller `data-vr-link` tillatt før sanering); forfalskede plassholdere/`vr-*` i rå HTML fjernes. | Vedtatt |
| BE6 | `%%kommentarer%%` fjernes i en kode-bevisst forbehandling; escapede `\[`, `\=`, `\#`, `\!` får en usynlig vaktpost slik at de ikke blir lenke/markering/tagg. Uavsluttet `%%` skjuler resten av fila. | micromark mister informasjon om escapes; Obsidian skjuler resten ved uavsluttet kommentar. | Antakelse (uavsluttet) |
| BE7 | Lenkeoppløsning: wikilinks = eksakt fra rot → `./`/`../` relativt → sti-suffiks/filnavn; markdown-lenker = relativt til kilden → rot → suffiks. Flere treff: samme mappe → færrest mapper → alfabetisk (PO-8). Notatnavn matches før fullt filnavn, så `[[versjon 2.0.1 notater]]` og `[[Faktura.md]]` begge virker. | README-QA §4 regel 1–6, QA-IMG-08. | Vedtatt |
| BE8 | Syklusvern: nøkkel = `fil#ankerId`. `![[#Annen seksjon]]` og `![[#Seksjon]]` i samme notat er lov så lenge samme seksjon ikke allerede rendres. | Naturlig regel; se åpent spørsmål BE-Q1. | Antakelse |
| BE9 | Innebygd innhold (embeds) får ingen overskrift-/blokk-id-er. | Unngår duplikate id-er og feil scroll-spy. | Vedtatt |
| BE10 | Søkeindeksen (MiniSearch) bygges i bakgrunnen etter at vaultet er «klart»; første søk venter. | Holder AK17 (indeks klar < 3 s); søk trengs ikke i første sidevisning. | Vedtatt |
| BE11 | Shiki-grammatikker varmes opp i bakgrunnen etter indeksering (ett språk per event-loop-runde). | Første rendering av et kodetungt notat tok 300–370 ms pga. lat grammatikk-kompilering; nå ~150 ms. | Vedtatt |
| BE12 | `@hono/node-server` startes med `overrideGlobalObjects: false`. | Ellers erstattes global `Response`, og Shikis WASM-lasting krasjer («reading 'body'»). | Vedtatt |
| BE13 | Host-guard sjekker kun vertsnavn (`127.0.0.1`/`localhost`), ikke port. Manglende `Host` slippes gjennom. | Vite-proxyen sender `Host: 127.0.0.1:5173`; DNS-rebinding har alltid et fremmed vertsnavn. | Vedtatt |
| BE14 | Frontmatter-datoer uten tidssone tolkes som UTC (`2026-11-05` → `2026-11-05T00:00:00.000Z`, `hasTime=false`). | Samme dag uansett serverens tidssone. | Antakelse |
| BE15 | Excalidraw-notater (`*.excalidraw.md`) indekseres (lenker/tagger) men rendres som `vr-unsupported`, og er ikke med i søk. | QA-IDX-11, R5. | Antakelse |

### Åpne spørsmål fra backend

| # | Spørsmål | Forslag |
|---|---|---|
| BE-Q1 | QA-EMB-06 sier `![[#Seksjon]]` i `Selv-embed.md` skal gi syklus-kort, men embeden står **før** «## Seksjon», ikke inni den. Med regelen i BE8 rendres seksjonen (som selv embedder «Annen seksjon»). Skal *alle* selv-embeds av egne seksjoner stoppes? Da stoppes også `![[#Annen seksjon]]`, som fasiten sier er lov. | Behold BE8; QA justerer fasit/notat. |
| BE-Q2 | QA-SOK-06: `HEMMELIG-KOMMENTAR` skal gi «ingen treff», men `README-QA.md` inneholder selv ordet (i inline-kode), så det treffes korrekt. | QA endrer fasit til «ingen treff utenom README-QA». |
| BE-Q3 | `![[Oppgaver.base#Ukjent view]]`: `data-view` sendes uendret; avklaring av «første view + advarsel» (E2) skjer i slice 3. | – |

## PO-avgjørelser etter backend-rapport og PO-akseptansetest (slice 0–2)

- **PO-32 (BE-Q1)** Backends regel for selv-embed (samme fil + samme seksjon = syklus) godtas. QA justerer fasit QA-EMB-06.
- **PO-33 (BE-Q2)** QA justerer fasit QA-SOK-06 (README-QA selv inneholder ordet).
- **PO-34 (BE-Q3)** `![[X.base#Ukjent]]` → advarselskort «Viewet «Ukjent» finnes ikke» med liste over tilgjengelige views.
- **PO-35 Dobbel tittel** Hvis notatets første innholdsblokk er en H1, brukes den som visningstittel og fjernes fra brødteksten. Ellers er tittelen filnavnet. Initialen (ornamentikk) gjelder første avsnitt etter dette.
- **PO-36 Snarveier** Vis `⌘K` på macOS og `Ctrl K` ellers.
- **PO-37 README** Mangler (AK18). Skal dekke: krav (Node ≥ 22.22, `.nvmrc`), `npm install && npm start`, peke på eget vault (config/CLI/env), flere vaults, snarveier, feilsøking.
- **PO-38** Ubrukte pakker (`remark-frontmatter`, `mdast-util-find-and-replace`) fjernes.

## Backend (slice 3–4, Bases, 2026-11-05, backend-utvikler)

| # | Beslutning / antakelse | Begrunnelse | Status |
|---|---|---|---|
| BE16 | Bases-rader er **alle** indekserte filer (ikke bare `.md`), slik Obsidian gjør. | `Domene.base` filtrerer selv på `file.ext == "md"` (QA: `domenemodell.svg` skal filtreres av det leddet). | Vedtatt |
| BE17 | `![[X.base#View]]`: serveren returnerer kun det viewet (eksakt navn, deretter uten hensyn til store/små bokstaver). Ukjent view → `views: []` + `unknown-view` med `availableViews` (nytt valgfritt felt på `BaseWarning`). | PO-12/PO-34; klienten slipper å filtrere og får listen strukturert. | Vedtatt |
| BE18 | Filterledd med ukjent funksjon eller parse-feil ignoreres (= sant) med **én** advarsel `unknown-function`/`parse-error`. Ukjent funksjon i formel/verdi gir `null`. | B8/O8. | Vedtatt |
| BE19 | Uten `sort` sorteres også **tabeller** på `file.name` ASC (ikke bare kanban). Siste uavgjort: `file.name`, så sti. | Fasit §3.3 («Med feil» sortert på navn); deterministisk rekkefølge. | Antakelse |
| BE20 | `&&`/`||` har JS-verdisemantikk (`status \|\| "ingen"` gir en verdi). Sammenligning dato ↔ datostreng er tillatt (`due < "2026-12-01"`). Ellers O6 (ulike typer: `==` usant, `<` usant). | Naturlig i formler; påvirker ikke filtre. | Antakelse |
| BE21 | Tom streng og tom liste regnes som «tom» (sorteres sist, havner i «(ingen)»). | Samme opplevelse som manglende property. | Antakelse |
| BE22 | Gruppe-etiketter for datoer formateres `dd.MM.yyyy` (ren dato) / `dd.MM.yyyy HH:mm` Europe/Oslo (med tid) på serveren. Celler sendes som ISO (klienten formaterer). | B10. | Vedtatt |
| BE23 | Resultater caches per snapshot (WeakMap); uttrykk med `now()`/`today()` caches ikke. Postkilden (én `VaultRecord` per fil, lat konvertering) bygges én gang per snapshot. | Live reload uten eksplisitt invalidering; < 50 ms kaldt. | Vedtatt |
| BE24 | `this` = vertsnotatet for ` ```base `-blokker og `.base`-fila selv for fil-baser (også ved embed, siden `BaseRequest` ikke bærer verten). | Enkelt; utvides hvis kunden bruker `this` i embeddede baser. | Antakelse |
| BE25 | PO-38 utført: `remark-frontmatter` og `mdast-util-find-and-replace` avinstallert. | Ubrukte. | Vedtatt |

## PO-avgjørelser etter Bases-leveranse (slice 3–4)

- **PO-39 (BE19)** Ja: tabeller uten `sort` sorteres på `file.name`.
- **PO-40 (BE20)** JS-lik `&&`/`||` og dato-mot-datostreng-sammenligning godtas.
- **PO-41 (BE24)** `this` → `.base`-fila ved embed godtas for v1 (kunden bruker ikke `this` i sine baser).
- **PO-42** QA legger `![[Oppgaver.base#Ukjent]]` inn i `lenker/Embed-test.md` og oppdaterer forventningen i `document-service.test.ts`.
- **PO-43 Bred layout for Bases** `.base`-sider og base-blokker bryter ut av lesekolonnen og bruker lesekolonne + høyre marg (høyre marg brukes ikke på `.base`-sider). Kanban-kolonner: min 220 px, fordeles på tilgjengelig bredde; først når de ikke får plass, intern horisontal scroll med synlig hint (fade i kant). Mål: Oppgaver-kanban (6 kolonner) skal vise alle kolonnene uten scroll ved 1440 px.
- **PO-44 Ingen duplikat-tilbakelenker** Tilbakelenker med kontekst nederst i notatet er primærvisningen. Høyre marg viser i stedet en kompakt lenke «Tilbakelenker (n) ↓» som hopper ned.
- **PO-45** Uthevingen i tilbakelenke-kontekst skal dekke hele lenketeksten (`Oppgaver.base`, ikke bare `Oppgaver`).
- **PO-46** Frontend-forslag 1–3 fra backend godkjent: `unknown-view` → «Viewet «X» finnes ikke» + `availableViews`; `invalid-yaml` inne i kortet; e2e setter `timezoneId: 'Europe/Oslo'`.

## PO-avgjørelser etter frontend runde 3

- **PO-47** Kanban-kolonnebredde min 168 px (10.5rem) godkjent – målet om 6 kolonner uten scroll ved 1440 px veier tyngst.
- **PO-48** Bred base-blokk i notat vs. sticky høyre marg: TOC/marg tones ut (opacity 0, ikke klikkbar, `aria-hidden` uendret – fortsatt tilgjengelig via tastatur/skjermleser) mens en bred blokk overlapper margsonen, og kommer tilbake når blokken er passert.
- **PO-49** SSE får eksplisitt `type: 'renamed'` med `from`/`to` (backend), klienten bruker den når den finnes.

## Backend: ytelse AK17 (BUG-008/BUG-009, 2026-11-06, backend-utvikler)

| # | Beslutning | Begrunnelse | Status |
|---|---|---|---|
| BE26 | Metadata-workerne kjører en esbuild-bunt laget i minnet ved oppstart (`Worker(kode, { eval: true })`), med tsx som reserve. `esbuild` er lagt til som direkte avhengighet (fantes fra før via tsx/vite). | Oppstart av en tsx-worker tok ~1,1 s (hver modul gjennom loader-krokene), bunten ~0,15 s. | Vedtatt |
| BE27 | «Indeks klar» venter ikke på Shiki. Shiki lastes rett etter at indeksen er klar; rendering venter via `renderReady()`. | Shiki parallelt med workerne kostet ~0,4 s indekseringstid. Første dokument rett etter oppstart kan vente ~0,5 s én gang. | Vedtatt |
| BE28 | Bakgrunnsarbeid (søkeindeks i biter à 25, Shiki-oppvarming linje for linje, forhåndsrendering) kjører bare når ingen API-forespørsel har pågått de siste 150 ms (`ActivityTracker`). Et søk gjør resten av søkeindeksen «haster» (ingen venting på ledig tid). | Før: søkeindeks (~1,4 s) og Shiki-oppvarming (opptil 1,5 s i én blokk) blokkerte forespørsler rett etter oppstart. | Vedtatt |
| BE29 | Shiki varmer først opp kodespråkene vaultet faktisk bruker (mest brukt først, uten å vente på ledig tid), deretter resten i ledig tid. | Grammatikk-kompilering midt i en forespørsel kostet 150–300 ms. | Vedtatt |
| BE30 | Forhåndsrendering: de 100 mest lenkede notatene etter indeksering og etter hver endring, og lenkemålene (maks 40) til hvert notat som åpnes, inn i render-cachen (LRU 500). Render-cachen tilhører fortsatt én revisjon (A20), så live reload invaliderer alt – også notater som embedder et endret notat. | Neste klikk treffer ofte cachen (byggetid < 1 ms). En innholds-/avhengighetsnøklet cache ble vurdert, men gir lite når kald rendering er ~4 ms, og øker risikoen for utdatert innhold. | Vedtatt |
| BE31 | `GET /document` har `Server-Timing: wait;dur=…, build;dur=…` (venting på indeks/Shiki og oppbygging inkl. JSON). | Gjør det mulig å skille server- og klienttid i ytelsestester og devtools. | Vedtatt |

## PO-avgjørelser etter ytelsesrunde

- **PO-50** Første dokument etter oppstart kan vente ~0,5 s én gang (Shiki). Godtatt – indekseringskravet prioriteres.
- **PO-51** AK17 notatbytte anses oppfylt på serversiden (p95 138–154 ms i nettleser under last). Frontend legger til prefetch ved hover/fokus for margin.

## Backend slice 6 (2026-11-06, backend-utvikler)

| # | Beslutning | Begrunnelse | Status |
|---|---|---|---|
| BE32 | PO-49: ved omdøping/flytting sendes fortsatt `removed` + `added`, og **i tillegg** `{ type: 'renamed', path, from, to }`. Par gjenkjennes på samme inode (+ størrelse) eller lik SHA-1 av innholdet (tekstfiler), innenfor samme debounce-bunt; hver fil i høyst ett par. | Bakoverkompatibelt: eldre klienter (og frontendens `detectMoves`) virker uendret. Inode dekker vanlig `rename`/flytting også for bilder; innholds-hash dekker kopi + sletting. | Vedtatt |
| BE33 | PO-3: `--lan` / `VAULT_READER_LAN` / `"lan": true` binder `0.0.0.0` og skriver advarsel + LAN-adresser. Vertssjekken (A16) godtar da i tillegg maskinens egne IPv4-adresser og `<maskinnavn>.local`; listen leses på nytt (høyst hvert 5. s) ved ukjent navn, så ny DHCP-adresse virker uten omstart. Uten flagget er alt som før (A17 gjelder fortsatt for standardoppsettet). | Mobil på hjemmenettet uten å åpne for DNS-rebinding. IPv6-adresser støttes ikke i v1. | Vedtatt |
| BE34 | Opprydding: ingen ubrukte server-avhengigheter (depcheck). Ingen TODO/FIXME i `src/server`/`src/shared`. Alle API-ruter i koden står i api.md. | PO slice 6. | Vedtatt |
