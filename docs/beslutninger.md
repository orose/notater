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

## PO-avgjørelser etter E403 fra kundens npm-brannmur (2026-11-06)

- **PO-52 Avhengighetspolicy** Kunden fikk `npm install` avvist av Sonatype Nexus (`E403 Requested item is quarantined`, `undici-8.12.4.tgz` publisert dagen før). Alle versjoner i `package-lock.json` (også transitive og dev) skal være minst **21 dager** gamle. Lockfila bygges med `npm install --before=<dato for 21 dager siden>` og sjekkes med `npm run check:deps` (`scripts/check-dependency-age.mjs`, `--days` for annen grense). Direkte avhengigheter er senket innen samme major; `jsdom` ^31 → ^30. `undici` (dev, via jsdom) er løftet fra 8.12.1 til 8.12.2, fordi 8.12.1 har 8 kjente sårbarheter (én høy). `overrides: { "playwright-core": "$@playwright/test" }` holder én `playwright-core` lik `@playwright/test` (ellers drar `@axe-core/playwright` inn nyeste og e2e får typefeil). `allowScripts: { "esbuild": false }` fjerner npm 11-advarselen om install-skript (esbuild virker uten). Kunden installerer med `npm ci`, ikke `npm install`. `.nvmrc` peker på Node 24 LTS (24.22.1); `engines` er uendret (≥ 22.22). Verifisert på Node 22.23/npm 10 og Node 24.22/npm 11: enhetstester, lint, build, hele e2e og AK17-ytelse. Se [ADR-006](arkitektur/ADR-006-avhengighetspolicy.md).

## Arkitektur v1.1 (2026-11-06, arkitekt)

Se [ADR-007](arkitektur/ADR-007-kommandoer-og-tastatur.md), [ADR-008](arkitektur/ADR-008-visningstilstand.md) og [ADR-009](arkitektur/ADR-009-disposisjon-diskre-embedding-og-folding.md).

| # | Beslutning / antakelse | Begrunnelse | Status |
|---|---|---|---|
| AR-1.1-01 | Kommandoregisteret = statisk katalog (`commands/model/catalog.ts`: id, navn, aliaser, gruppe, beskrivelse, argumenter, bindinger per modus) + handlere (`isEnabled`/`argumentValues`/`run`) koblet i React. `CommandHandlers` er en mappet type over `CommandId`, så manglende handler er typefeil. | P2. Katalogen må kunne leses av README-generatoren i Node uten React. | Vedtatt |
| AR-1.1-02 | `isEnabled(ctx)` returnerer `{ enabled: false, reason }` med norsk begrunnelse; paletten viser den, tast gir toast. | F5 «deaktivert med forklaring». | Vedtatt |
| AR-1.1-03 | Kommandoer når resten av appen kun via `CommandContext.ports` (rulling, historikk, palett, hjelp, Utseende, tema, visning, disposisjon, toast). | Katalogen forblir ren; handlere testbare med falske porter; ingen feature-sykler. | Vedtatt |
| AR-1.1-04 | Tastenotasjon med `event.key`: `'g g'`, `'Leader w'`, `'Mod+k'`, `'Ctrl+d'`. Shift er aldri modifikator for tegn (`'?'`, `'G'`); bokstavers store/små følger `shiftKey`, ikke Caps Lock. Aldri `event.code`. | Norsk Mac: `:` `/` `?` krever Shift; `code` gir fysisk US-posisjon. | Vedtatt |
| AR-1.1-05 | `Mod` = ⌘ eller Ctrl, begge virker overalt; `Ctrl` er bokstavelig Control (også på Mac, for `Ctrl d/u`). Ikke lov å binde både `Mod+x` og `Ctrl+x`. | PO-36; ⌘D er bokmerke i nettleseren. | Vedtatt |
| AR-1.1-06 | P5 håndheves med **hviteliste** (`P5_SAFE_CHARACTERS`) + forbud mot `Alt`. Døde taster (`Dead`) og IME ignoreres. | «bl.a.» i P5 gjør en svarteliste ufullstendig. | Vedtatt |
| AR-1.1-07 | P4 gjelder første akkord uten modifikator i normal-modus (`Space d`, `z a`, `Ctrl d` er lov). Esc kun for `system.escape`, som står i registeret. | Spesifikasjonens eget tastaturkart bruker `d`/`a`/`u` etter prefiks/modifikator. | Vedtatt |
| AR-1.1-08 | Ingen sekvens kan være prefiks av en annen i samme modus (testet). Tidsavbrudd (1 s) brukes kun til å forlate en påbegynt sekvens. | Ingen tvetydighet, ingen venting på `g` vs `gg`. | Vedtatt |
| AR-1.1-09 | Which-key vises 400 ms etter leader; mens den vises løper ikke tidsavbruddet. Kun for leader i v1.1. | Ellers ville hintet forsvinne etter 0,6 s. | Vedtatt |
| AR-1.1-10 | Én `keydown`-lytter på `window` (boblefase). Rekkefølge: `defaultPrevented` → modal åpen (inaktiv) → tekstfelt (kun `inTextFields`) → Space på aktiverbart element (native) → motor. | P7; lokale Esc-lyttere går først; Space på knapper/faner beholder sin funksjon (tilgjengelighet). | Vedtatt |
| AR-1.1-11 | Taster komponentene håndterer selv etter ARIA-mønstre (↑↓↵ i paletten, ←→ Home End i base-faner, Tab) står som `KEY_HINTS` i katalogen, men bindes ikke av motoren. | P2 (oversikten komplett) uten å flytte widget-taster ut av widgetene. | Vedtatt |
| AR-1.1-12 | Én palett med modus avgjort av inndata (`:` = kommandoer). Enter lukker paletten før kommandoen kjøres (neste ramme). Egen enkel fuzzy, ingen ny avhengighet. | F5; unngår stablede modaler; ADR-006. | Vedtatt |
| AR-1.1-13 | `?`-oversikt og README genereres fra `shortcutGroups()`; `npm run docs:shortcuts` skriver mellom `<!-- hurtigtaster:start/end -->`, sync-test i `scripts/`. Skript og test lages i slice 1.1-a (ikke før tastene virker). `commands/model` og `keyboard` må være ren TS og legges i `tsconfig.tooling.json`. | F6/AK-1.1-07. | Vedtatt |
| AR-1.1-14 | ⌘K/⌘. flyttes fra `SearchProvider`/`ThemeProvider` til registeret. Paletten lukker selv på ⌘K (motoren er inaktiv bak modal). | P2, P6 uendret oppførsel. | Vedtatt |
| AR-1.1-15 | Ny feature `view-settings`: lesebredde (global, `localStorage['vault-leser.visning']`, `data-width` satt av `tema-init.js` før maling), diskré (per `vaultId\ndocPath`, kun «på»-oppføringer, maks 500, følger `renamed`), zen (flyktig, `data-zen`). Samme mønster som `theme-state.ts` (normalisering, try/catch). | ADR-008, P1. | Vedtatt |
| AR-1.1-16 | Folding-tilstand bor i `features/outline` (`Set<id>`, provider med nøkkel vault+notat), aldri lagret. | F3 «huskes ikke». | Vedtatt |
| AR-1.1-17 | Diskré embedding, TOC-fletting, §-nummer og seksjoner beregnes i klienten fra HAST (`buildOutline`), ikke fra DOM og ikke på serveren. **Ingen API-endring**; dagens egenskaper ved `vr-embed` er gjort normative i api.md («Garantier for innebygd innhold») og låst med servertest. | Serveren sender allerede nok til begge visninger; diskré er et klientvalg. | Vedtatt |
| AR-1.1-18 | Nivåregel i diskré: tittel `T = min(6, forrige + 1)` (ingen foregående overskrift ⇒ `forrige = 1`); innhold forskyves relativt; overskrifter retagges. Notat som starter med H1 bruker den som tittel (PO-35). Innebygde overskrifter får id `~e<n>-<i>`. | F2; skjermlesere får riktig struktur; `~` kolliderer aldri med serverens id-er. | Vedtatt |
| AR-1.1-19 | §-nummer beregnes (`data-vr-sec`), CSS-telleren fjernes. | CSS-tellere telles ikke i `display:none` (folding) og `>`-selektoren treffer ikke diskré embeds. | Vedtatt |
| AR-1.1-20 | Seksjon = til neste overskrift på samme/høyere nivå, **men aldri forbi slutten av embeden** overskriften står i. Kun toppnivå-overskrifter (vert + diskré embeds) kan foldes/nummereres. | Folding av innebygd overskrift skal ikke skjule vertens tekst; F3. | Vedtatt |
| AR-1.1-21 | `za` bruker samme leselinje som scroll-spy (30 % av vindushøyden), ikke toppkanten. | `za` folder seksjonen TOC-en markerer som aktiv. Spesifikasjonen sier «over toppen av visningen» – PO kan velge 0 %. | Antakelse (PO) |
| AR-1.1-22 | Overskrifter i **rammede** (ikke-diskré) embeds og i callouts/sitater/lister kan ikke foldes og nummereres ikke. | Rammede embeds er kort (F3: «jf. F2»); som § i dag. | Antakelse (PO) |
| AR-1.1-23 | Utfolding ved hash-navigasjon skjer under rendering (før `useDocumentScroll`), søketreff til samme notat folder ut alt, `hidden="until-found"` + `beforematch` der støttet. Scroll-spy hopper over skjulte overskrifter. | Ingen falsk «Fant ikke seksjonen»; `display:none` gir `top = 0`. | Vedtatt |

## PO-avgjørelser etter arkitektrapport v1.1

- **PO-53 (AR-1.1-21)** `za` bruker samme leselinje som TOC (30 % ned i viewport). Godkjent – konsistens med TOC veier tyngre enn spesifikasjonens «toppkant». Spesifikasjonen oppdateres.
- **PO-54 (AR-1.1-22)** Overskrifter i innrammede (ikke-diskré) embeds, callouts og sitater kan ikke foldes og får ikke §-nummer. Godkjent.
- **PO-55** `Ctrl d`/`Ctrl u` er primært for macOS; om nettleseren på Windows/Linux sluker dem, er det akseptert (QA dokumenterer).
- **PO-56** Space beholder vanlig funksjon på knapper/faner/skjemaelementer; ellers er den leader (bevisst endring).

## PO-avgjørelser etter QA-testplan v1.1

Alle QAs forslag i testplan-v1.1 (Q-01–Q-12) er **godkjent**, med disse presiseringene:
- **PO-57 (Q-02)** Tittelen til et innebygd notat teller som nærmeste overskrift for embeds inni det (A-tittel H2 → B-tittel H3).
- **PO-58 (Q-01)** Embed før første overskrift i vertsnotatet: notattittelen (H1) regnes som nærmeste overskrift → embed-tittel blir H2.
- **PO-59 (Q-03/Q-04)** Fold-knapp: «Fold sammen X» / «Fold ut X». Toast: «Diskré embedding på/av for dette notatet».
- **PO-60 (Q-05)** Kildelenke på touch: alltid synlig, dempet.
- **PO-61 (Q-06/Q-07)** Zen kan slås på fra Utseende. I zen vises en diskré, alltid tilgjengelig «Avslutt zen»-knapp (på touch alltid synlig; på desktop synlig ved hover/fokus i øvre hjørne).
- **PO-62 (Q-09/Q-11)** Full bredde på `.base`-sider: ingen synlig endring, ingen feil. `zM` som skjuler fokusert element flytter fokus til ytterste foldede overskrift.

## PO-avgjørelser etter UX-rapport v1.1

Designet (prototype-v1.1.html, designsystem §11) er **godkjent** som referanse.
- **PO-63** `:` beholdes i feltets verdi, men tegnes som prompt (visuelt som design; testene som sjekker `value === ':'` holder).
- **PO-64** Ingen tak på full bredde – kunden har eksplisitt akseptert lange linjer.
- **PO-65** Underoverskrifter i diskré notatembed forskyves med samme nivåforskyvning som tittelen (maks H6).
- **PO-66** Sekvenstidsavbrudd pauses mens which-key vises (samsvarer med ADR-007).
- **PO-67** Ingen flagg i mobil-topplinjen; Utseende viser tilstanden.
- **PO-68** Innrammet embed-tittel som `<p class="embed-title">` (ikke `<h4>`) for å unngå heading-order-brudd. Ny regel: ingen `opacity` på tekst.
- «§ → ⌄» ved hover på fold-håndtak: forelagt kunden.

## PO-avgjørelser etter slice 1.1-a

- **PO-69** `?`-kortet bruker **par-rader** slik designet viser (f.eks. «`j` / `k` Rull ned / opp»), med `data-command-id` per kommando inne i raden. Paletten viser kun primær hurtigtast. QA justerer TC-07-07/08 og TC-06-09. README-tabellen kan følge par-radene.
- **PO-70** `gg`/`G` hopper uten animasjon (som vim). ADR-007 oppdateres.
- **PO-71** Lokale bilder skal ha reservert høyde (ingen layout-hopp): serveren setter `width`/`height` på `<img>` for lokale vedlegg (lest fra filheader, uten ny avhengighet). Testen TC-F7-12 venter i tillegg på at bilder er lastet.
- **PO-72** QA-filen `e2e/support/keymap-rules.ts` peker på `commands/model/index.ts` – godkjent.
- **PO-73** Kunden godkjenner «§ → ⌄»: fold-pil erstatter §-tegnet ved hover, nummeret står fast.
- **PO-74 (kundefunn)** I prototype-v1.1 henger det igjen en loddrett strek på hver side av lesespalten etter veksling mellom optimal og full bredde. Strekene skal ikke være der. Rettes i prototypen og må ikke forekomme i implementasjonen (e2e-sjekk).

## Backend: bildedimensjoner PO-71 (2026-11-06, backend-utvikler)

| # | Beslutning | Begrunnelse | Status |
|---|---|---|---|
| BE35 | Ny blad-feature `src/server/features/image-size`: egen header-parser for PNG, JPEG (inkl. EXIF-orientering), GIF, WebP (VP8/VP8L/VP8X) og SVG. Leser 4 KiB med én gang, deretter bare posisjonslesing (JPEG hopper over store EXIF/ICC-segmenter; SVG leser maks 64 KiB). Faste grenser (1024 JPEG-markører, 256 IFD-oppføringer, dimensjon ≤ 100 000); alt ugyldig gir `null`. | Ingen ny avhengighet (ADR-006). Begrenset I/O og ingen løkker på ondsinnede filer. | Vedtatt |
| BE36 | Dimensjonene caches som `VaultFile.imageSize` og leses parallelt med tekstfilene ved indeksering, og på nytt i `updateSnapshot` bare når mtime/størrelse endres. | Rendering er synkron og trenger størrelsen uten I/O. Målt merkostnad ~70–100 ms per 1000 bilder (test: < 300 ms, AK17). | Vedtatt |
| BE37 | `\|300x200` og `<img width height>` skaleres til å passe inni boksen med bevart sideforhold; `\|300` / bare `height` regner ut den andre siden. Ukjent størrelse gir bare det som ble bedt om. `![alt\|300](sti)` støttes (bare med `\|`, så alt-tekst som «2024» ikke blir en bredde). | PO-71: bevar sideforholdet, ingen forvrengning selv uten `height: auto`. | Vedtatt |
- **PO-75** Navngivning for bredde følger ADR-008 (`data-width="full"`, nøkkel `vault-leser.visning`). Designsystemet oppdateres ved neste UX-runde.
- **PO-76** Testene i `ak12-live-reload` skal tåle gjentatt kjøring (egen vault-kopi per test eller tilbakestilling) – QA-oppgave.
- **PO-77** QA-hjelperen `overskrift()` (eksakt tekstslutt) – godkjent. Ankerlenke `#` kun på h2/h3 som i v1 – godkjent.
- **PO-78 (bug)** Omdøping kan splittes over to SSE-batcher (removed i én, added i neste) → ingen `renamed`. Backend skal holde tilbake `removed` i et kort vindu (f.eks. 300 ms) for å pare med en påfølgende `added`.

## PO-avgjørelser etter slice 1.1-d

- **PO-79** Feilkort for embeds skal få designets v1.1-utseende (§11.4) – frontend.
- **PO-80** TC-12-04 bruker piltaster i radiogruppen (riktig radio-semantikk) – QA.
- **PO-81 (bug)** Tast rett etter at en dialog lukkes med `Esc` skal virke (vim-brukere trykker `Esc` + `j` i én bevegelse). Tastaturmotoren skal aktiveres synkront når dialogen lukkes – frontend. Dekker de ustabile TC-05-08/TC-12-02.
- **PO-82** Tilbakeholdsvindu for slettinger 1000 ms (rene slettinger kan komme inntil ~1 s senere). Godkjent.
- **PO-83** BUG-014 rettet (felles varselsone). Toasten «Fant ikke seksjonen …» flyttes inn i varselsonen ved neste anledning (backlog, lav).

## Arkitektur v2 – presentasjonsmodus (2026-11-08, arkitekt)

Se [ADR-010](arkitektur/ADR-010-presentasjonsmodus.md). Skjelett i `src/web/features/presentation/`.

| # | Beslutning / antakelse | Begrunnelse | Status |
|---|---|---|---|
| AR-2-01 | Lysbildemodellen er to rene trinn: `buildSlideDrafts(source, { slideLevel })` (S1–S8, uavhengig av layout) og `finalizeDeck(drafts, fit, { transitions })` (A2-fortsettelser, nummer, progresjon, id-er). Bare tilpasningen mellom dem bruker DOM. | Struktur og fasit (AK-2-02/04/05) testes som rene funksjoner; layout isolert. | Vedtatt |
| AR-2-02 | Presentasjonen bygger sin egen disposisjon med `discreet = true` (S1) og uten `applyFolds` (S8), uavhengig av lesevisningens valg. Inndata er disposisjonens toppnivåflyt (`Outline.flow`, nytt felt i `outline`). | S1/S8; flyten beregnes allerede i `buildOutline`. | Vedtatt |
| AR-2-03 | Nivåer: automatisk `A = min(nivåer)`, `S = A + 1`. `:presenter h<n>`: `S = n`, `A` = høyeste nivå som *finnes* under `n`; ingen ⇒ ingen agenda. `h<n>` er gyldig når nivået har minst én overskrift. | S2–S4 («nærmeste nivå over»). | Antakelse (PO) |
| AR-2-04 | Agendapunkter = overskriftene på agendanivået `A`. Overskrifter over `A` (kun ved overstyring) blir verken agendapunkter eller lysbilder; har de eget innhold, blir det et innholdslysbilde uten agendapunkt (før første agendapunkt: innledning, S6). | Samsvarer med QAs forslag Q-05 (fasit `niva.h4`); renere agenda enn å ta med alle nivåer. | Antakelse (PO) |
| AR-2-05 | Innhold mellom et agendapunkt og første underoverskrift blir et eget innholdslysbilde med agendapunktets overskrift. Tom agendaseksjon gir bare overgangen (med `:agenda av`: et lysbilde med kun overskriften). | S3 sier ikke hva som skjer med punktets egen innledning. | Antakelse (PO) |
| AR-2-06 | Splitting (A2) skjer mellom blokker; en liste på toppnivå kan deles mellom listepunkter (aldri inne i ett), `ol` fortsetter med `start`. Kode, tabell, base, callout, sitat og Mermaid deles aldri. | A2 «aldri inne i … liste-element». | Antakelse (PO) |
| AR-2-07 | Logisk lerret 1920×1080 CSS-px, skalert til vinduet med `transform: scale(k)`. UX-enheten `--lp` (`100cqw/1920`) blir da 1px i både visning og måling. Tilpasningen er uavhengig av vindusstørrelse; resize, delt vindu og fullskjerm gir ingen ny måling. | A1; deterministisk og raskt; ren container-enhet-skalering kunne gitt andre linjebrudd enn målingen. | Vedtatt |
| AR-2-08 | Tilpasningen skjer ved bygging, før visning, i et skjult målelerret som rendrer samme `SlideView` og CSS (én wrapper `div.slide-unit` per enhet). Alle uavklarte utkast måles i samme pass; høyst ~5 pass totalt. | Identisk layout i måling og visning; få tvungne layouter. | Vedtatt |
| AR-2-09 | Skriftskala i diskrete trinn `fontScaleSteps(step, min)`: fra 1 ned til minimum i steg på `--slide-fit-step`, minimum `--slide-text-min-lp / --slide-body-lp` per typesett – lest fra UX-tokens i målelerret (reserve 0,025 / 0,75). Splittet utkast: minste antall deler på minimum, deretter største skala som gir samme antall; alle deler samme skala. Enhet for stor alene: bilde/diagram skaleres, ellers minste skrift + intern rulling. | A2; UX eier tallene; lik typografi på «(forts.)»; ingenting kuttes usynlig. | Vedtatt |
| AR-2-10 | Mermaid og bilder måles ikke: de får fast minstehøyde (`--slide-figure-min`) i målingen og vokser inn i ledig plass i visningen. Målelerret bruker plassholder for `vr-mermaid`. | Ingen asynkron rendering eller lasting av Mermaid i målingen. | Vedtatt |
| AR-2-11 | Ytelse: start-lysbildet og naboene måles først og vises; resten i bakgrunnen i biter (`requestIdleCallback`). Nummer/antall er foreløpige til målingen er ferdig. Gjeldende ± 1 lysbilde er montert på forhånd. | AK-2-13 (start < 500 ms, bytte < 100 ms). | Vedtatt |
| AR-2-12 | Måleresultatene caches per utkast med nøkkel (hash av enheter + overskrift + viste `BaseResult`-er, typesett, layoutversjon). Live reload måler bare endrede utkast; typesett-bytte måler alt; palett/modus/vindu måler ingenting; `document.fonts` `loadingdone` tømmer. | Live reload og temabytte uten unødig måling. | Vedtatt |
| AR-2-13 | Regel for UX: palett og lys/mørk kan ikke endre fontvekt, -størrelse eller avstand i lysbilder. | Ellers må de inn i cachenøkkelen. | Vedtatt |
| AR-2-14 | Lysbilde-id = slug av overskriftsteksten (github-slugger, forhåndsmatet med `tittel`/`agenda`/`innledning`/`overgang`), `overgang.<nøkkel>`, suffiks `.del<k>` (S5) og `.forts<m>` (A2). Ikke disposisjonens id (`~e<n>-<i>` er posisjonell). | Spesifikasjonen: «identifisert ved overskrift»; stabil når embeds legges til. | Vedtatt |
| AR-2-15 | Posisjon ved live reload/nivåbytte: eksakt id → kortere suffiks → samme strukturelle adresse → nærmeste nabo (etterfølger før forgjenger) → samme indeks. Forrige kortstokk vises til gjeldende lysbilde er målt. | AK-2-07; ingen blink. | Vedtatt |
| AR-2-16 | Present er en egen modus i motoren (`KEY_MODES = ['normal','present']`), ny gruppe `presentasjon`, nye kommandoer `present.*`; `:`, `?` og Esc får present-bindinger. `Space` er vanlig tast (neste) i present; ingen `Leader`. | P2/P3; entydighetsregelen hindrer leader-sekvenser i present. | Vedtatt |
| AR-2-17 | P5 og P4-Esc gjelder i alle modi. P4s bokstavliste gjelder bare første akkord i normal-modus (AR-1.1-07), så `p` og `o` kan bindes i present slik spesifikasjonen krever. | Spesifikasjonens tabell bruker `p` og `o`; reservasjonen gjelder redigering fra normal-modus. | Antakelse (PO) |
| AR-2-18 | Lese-kommandoer er deaktivert i present med «Ikke under presentasjon»; `present.*` er deaktivert utenfor med «Bare under presentasjon». `:presenter` med ugyldig/tomt nivå gir E475 med norsk forklaring via ny `argumentError` i handleren. | F5-mønsteret; S4 feilmelding. | Vedtatt |
| AR-2-19 | Oversikten (`o`) er en modal `dialog` som eier sine egne taster (piler, `hjkl`, ↵, `o`, Esc; `KEY_HINTS`). Svart skjerm er et lag (ikke modal); neste/forrige mens svart viser lysbildet igjen uten å bla. | P7; som PowerPoint. | Vedtatt |
| AR-2-20 | Overlegg på notatets rute, ingen ny rute: `?lysbilde=<id>`. Start = push med tom verdi (`?lysbilde=`, «start ved leseposisjon»); bla = replace etter visning; Tilbake avslutter; Esc = `navigate(-1)` når vi la til oppføringen, ellers replace uten parameter. Lesevisningen forblir montert (`visibility: hidden` + `inert`). | Umiddelbar avslutning til samme sted; samme dokumentspørring, palett og live reload. | Vedtatt |
| AR-2-21 | `useDocumentScroll` ruller ikke når bare `lysbilde`-parameteren endres. | I dag ruller hver replace lesevisningen til toppen. | Vedtatt |
| AR-2-22 | Fullskjerm på `document.documentElement` (ikke lerretet), kalt synkront i brukergesten i `present.start`. Avvist/ikke støttet ⇒ vindu uten feil; ved reload toast om `:fullskjerm`. Chromium: Keyboard Lock på Esc. Uten lås: `fullscreenchange` ut som vi ikke ba om = Esc (lukk oversikt, ellers avslutt). | Palett/`?`/toast må vises; spesifikasjonens Esc-semantikk. | Vedtatt |
| AR-2-23 | Gjenbruk: `HastContent` får valgfri `components`-overstyring (overskrifter, sidenoter, fotnotereferanser, Mermaid i måling); Bases og Mermaid uendret, tilpasset med CSS under `.slide`; nye `--slide-*`-tokens fra UX; `ingressOf` flyttes til `properties`. Id-er fjernes i lysbildene. | Ingen duplisert rendering; ingen like id-er med lesevisningen. | Vedtatt |
| AR-2-24 | `:presenter h<n>` lagres i `localStorage['vault-leser.presentasjon']` = `{ v: 1, levels: [[vaultId\ndocPath, n], …] }`, kun overstyringer, maks 500, følger omdøping; `:presenter auto` fjerner. `:agenda av` og svart skjerm huskes ikke. | S4, P1, ADR-008-mønsteret. | Vedtatt |
| AR-2-25 | Ingen serverendring. Dokument-API-et har alt (HAST, toc, properties, mtime, bases, bildedimensjoner); CSP og manglende Permissions-Policy tillater fullskjerm og inline-stil. | Målet i oppdraget. | Vedtatt |

## PO-avgjørelser etter arkitektrapport v2

- **PO-84 (AR-2-17)** Bokstavreservasjonen i P4 gjelder kun normal-modus; present-modus kan binde `p`, `o` osv. P5 (⌥-forbud) og Esc-regelen gjelder overalt.
- **PO-85** AR-2-03 til AR-2-06 godkjent (nivåvalg, overskrifter over agendanivå ignoreres, agendapunktets innledning som eget lysbilde, lister kan deles mellom punkter).
- **PO-86** Skriftminimum ved automatisk krymping: UX sitt forslag (≈ 30 px på 1920×1080-lerretet, faktor ≈ 0,75). 24 px er for lite ved komprimert skjermdeling.
- **PO-87** `Esc` avslutter til **seksjonen for gjeldende lysbilde** (ikke startposisjonen) – mer nyttig etter et møte («vis meg detaljene her»). Spesifikasjonen presiseres.
- **PO-88** `f` i present-modus = fullskjerm av/på (i tillegg til `:fullskjerm`). Etter reload vises toast med hint om `f`.
- **PO-89** Lenker i lysbilder virker og forlater presentasjonen; Tilbake går inn igjen. Godkjent.
- **PO-90** Tagger vises ikke på tittellysbildet.
- **PO-91** Ukjent lysbilde-id i URL ved ny lasting → tittellysbildet. QA tilpasser TC-2-11-13.

## PO-avgjørelser etter UX-rapport v2

Designet (prototype-v2.html, designsystem §12) er **godkjent** som referanse.
- **PO-92** Esc i fullskjerm: nettleseren tar første Esc og går ut av fullskjerm; presentasjonen fortsetter med toast «Esc igjen avslutter». Ett Esc uten fullskjerm avslutter. AK-2-01 presiseres tilsvarende.
- **PO-93** «Ingen foreldreløse lysbilder» (§12.7.3) godkjent som presisering av A2.
- **PO-94** `↑`/`↓` ruller en for stor blokk internt i present-modus – registreres i kommandoregisteret.
- **PO-95** Tittellysbildet har **ikke** folio eller fremdriftslinje (tidsskrifttradisjon) – presisering av A5.
- **PO-96** `:presenter h2` → agendanivå = notattittel → ingen agenda/overganger. Riktig tolkning av S4.
- **PO-97** Rullehintet («↓ 38 linjer til») beholdes, diskret.
- **PO-98** UX sitt byggeskript for prototypen flyttes inn i `docs/design/prototype-v2/` (kilde + build) så prototypen kan vedlikeholdes.

## PO-avgjørelser etter QA-testplan v2

Alle QAs forslag (Q-03, Q-11, Q-13–Q-16, Q-21, Q-23) er **godkjent** som foreslått. I tillegg:
- **PO-99 (Q-15)** Start/avslutt med mus/touch: «Presenter» i Utseende og en dempet knapp «Avslutt presentasjon» på lerretet.
- **PO-100 (Q-17)** Statusmøtet bruker en **ekte** embed av `Oppgaver.base`. QA får endre tilbakelenke-tallet 6→7 i `ak07-11-navigasjon.spec.ts` og README-QA §4.
- **PO-101 (Q-24)** Feilkoder: `E475` = ugyldig argument (f.eks. `h9`, `hx`); `E486` = nivået finnes ikke i notatet (f.eks. `h5` uten H5). Som i UX-skjermbildene. ADR-010 oppdateres.
- **PO-102 (Q-23)** AK-2-13 «start < 500 ms» gjelder median av 5 målinger; maks rapporteres.

## PO-avgjørelser etter frontend v2 (2-a–2-c)

- **PO-103** Frontendens tolkninger 1–6 godkjent: PO-93 vs Q-21 (kort forløp < 1/3 høyde → blokken blir stående og ruller; ellers deles det), full bredde for lysbilder uten overskrift, inntoning (ikke krysstoning), demping med farge, datoer som tekst på tittellysbildet, Esc slår av svart skjerm.
- **PO-104** QA-testendringene frontend gjorde (TC-2-05-05, -04-02, -08-04, -09-01, -11-05, -07-05, -12-02, -12-14, perf) godkjennes med forbehold om QAs gjennomgang i sluttesten.
- **PO-105 (backlog)** «● live»-merke og kanban-glød i base-hodet (prototype) er ikke laget – lav prioritet, vurderes etter kundens test. Kanban med intern rulling i statusmøtet forelegges kunden.

## Arkitektur v3 – presentasjon i terminalen (2026-11-11, arkitekt)

Se [ADR-011](arkitektur/ADR-011-terminalpresentasjon.md). Skjelett i `src/terminal/` og `npm run present`.

| # | Beslutning / antakelse | Begrunnelse | Status |
|---|---|---|---|
| AR-3-01 | Ny mappe `src/core/` for ren TS uten plattform (ingen DOM, Node eller React). Ligger i både web- og server-tsconfig, har egen ESLint-blokk uten globals og testes i Vitests node-prosjekt. `src/shared` forblir kun API-typer. | «Én lysbildemodell» uten duplisering; renheten håndheves av kompilatoren. | Vedtatt |
| AR-3-02 | Flyttes til `src/core` (K1–K6, én commit per trinn, uendret testantall): `hast/` (splitLeadingTitle, prepareContent, én felles `inlineText`), `outline/` (buildOutline), `presentation/` (modell, fit-algoritme, fit-typer uten `CANVAS`, fingeravtrykk, cache), `format/` (ingress, datoformat, `formatBaseDate`), `keyboard/` (uten `dom-guard`), `commands/` (katalog, register, fuzzy, palettvalg, `?`-grupper). Web-featurenes `index.ts` re-eksporterer. | Alt dette er allerede ren TS; terminalen skal ikke importere `src/web`. | Vedtatt |
| AR-3-03 | `prepare()`/`levels()` i `PresentationProvider` flyttes til `core/presentation/prepare-source.ts` (`prepareSlideSource`, `presentationLevelInfo`); innholdsdelen av cachenøkkelen til `draftContentKey`. | Veien NoteDocument → kilde finnes ett sted; web og terminal kan ikke divergere. | Vedtatt |
| AR-3-04 | Flyttingen tas først i slice 3-a som egen, kort PR; QA oppdaterer `REGISTER_FIL` i `e2e/support/keymap-rules.ts` i samme PR. | Mange importer endres mens UX/QA jobber parallelt. | Vedtatt |
| AR-3-05 | Terminalen er en egen komposisjonsrot (`src/terminal/app/`) som bruker server-featurene direkte: `resolveConfig`, `createVaultRuntime` (ett vault), worker-uttrekk, `watchVault`, `getDocument`, `createBaseEvaluator`. Ingen HTTP. | T7; samme indeks, rendering og Bases som web. | Vedtatt |
| AR-3-06 | Serverendringer (bakoverkompatible): `VaultRuntimeDeps.background` (av i terminalen), `createCodeHighlighter({ preload })` + `ensureLanguages`, valgfri `onProgress` ved indeksering. | Oppstartstid; ingen søkeindeks/forhåndsrendering trengs for ett notat. | Vedtatt |
| AR-3-07 | Oppstart målt til 3,2–3,3 s (+ npm) med 2000 notater uten tiltak (indeks 2,3 s, Shiki 0,44 s, tsx-import 0,35 s). Tiltak: Shiki med bare notatets språk startet ved t0 (M1), esbuild-bunt bygget ved endring i stedet for tsx (`scripts/present.mjs`, M2), oppstartsskjerm med fremdrift (M3). To-fase-start (M4) er reserve. | AK-3-12 brytes uten tiltak; anslag etter M1–M3 ≈ 2,75 s. | Vedtatt (M4: reserve) |
| AR-3-08 | Egen tynn renderer på rå ANSI, ikke Ink. `view(tilstand) → Frame` (celler med stil) og `renderFrame(forrige, ny)` som skriver bare endrede celleløp. | A2 krever eksakte høyder før tegning (Ink gir dem først etter render); full kontroll på bredde, tabeller og figlet; ingen nye pakker (ADR-006); rammer er testbare data. | Vedtatt |
| AR-3-09 | Terminalhygiene: inn = raw mode → alternativ buffer → skjul markør → autowrap av → bracketed paste → kitty-tastatur (hvis støttet); ut i omvendt rekkefølge, skrevet synkront med `writeSync`, idempotent, også fra signal-, feil- og exit-krokene. Exit 0/130/143/129/1. Ikke-TTY avvises. | AK-3-11; asynkrone skriv går tapt ved krasj. | Vedtatt |
| AR-3-10 | Ctrl c er en vanlig binding (raw mode slår av ISIG). Ctrl z (suspend) støttes ikke i v3. | Spesifikasjonen; suspend er utenfor scope. | Antakelse (PO) |
| AR-3-11 | Fargedybde: `--farger terminal` ⇒ 16 · `NO_COLOR` ⇒ ingen · kjente truecolor-terminaler/`COLORTERM` ⇒ truecolor · `256color` ⇒ 256 (nærmeste) · ellers 16. Fargene kommer fra UX' `docs/design/terminal/farger.json` (roller, kode-tokens, ANSI-16-kart). Lys/mørk «system» via OSC 11, ellers mørk. | T2/T4; UX eier fargene. | Vedtatt |
| AR-3-12 | HAST → terminalblokker → linjer (rene funksjoner av enhet, bredde og tema) → maling i rammen. Ukjente elementer tegnes som tekst, ukjente `vr-*` som plassholder – aldri krasj. | Målbar, testbar tegning uten DOM. | Vedtatt |
| AR-3-13 | Bredde per grafemklynge (`Intl.Segmenter`): emoji/VS16/ZWJ/flagg og East Asian Wide = 2, kombinerende = 0, Ambiguous (rammetegn, blokktegn) = 1. Wide-tabellen byttes mot `get-east-asian-width` (fra lockfila) i 3-b. | Ghostty og vestlige terminaler; æøå, emoji og CJK (Terminalkanter.md). | Vedtatt |
| AR-3-14 | Kode tegnes fra serverens Shiki-HAST: `var(--shiki-token-X)` → palettens `kode.X` (truecolor) eller ANSI-16-kartet. Ingen ny highlighting i terminalen. Lange kodelinjer brytes mykt med `↪` i gutteren. | Samme tokenisering som web; ingen kode kuttes. | Vedtatt |
| AR-3-15 | Tabeller og Bases-tabell med rammetegn; kolonnebredder krympes til minimum og celletekst brytes; får minimum ikke plass, vises raden som kort (`Kolonne: verdi`). Bases viser første view som web, med fanelinje. Horisontal overflyt deler aldri et lysbilde. | AK-3-05 ved 80 kolonner. | Vedtatt |
| AR-3-16 | Plassholdere (T3): Mermaid, kanban-view, bilder og `vr-unsupported` som stiplet boks med fast høyde (1–3 rader) og spesifikasjonens tekst. | AK-3-06. | Vedtatt |
| AR-3-17 | OSC 8 bare for eksterne lenker (http, https, mailto) og bare i terminaler som støtter det. Interne lenker får lenkefarge uten mål. | Ingen ødelagt utdata i andre terminaler; interne mål finnes ikke i terminalen. | Antakelse (PO) |
| AR-3-18 | A2 i terminalen bruker samme `fitDraft`/`packUnits` (core) med `Geometry` i rader. Skalatrinnene betyr tetthet: `[1, 0.5]` = normal luft / tett. Kontrollpass og intern rulling som ADR-010. Cachenøkkel = `draftContentKey` + `cols×rows` + layoutversjon. | Én algoritme; terminalen har ingen skriftstørrelse. | Vedtatt (trinnene: UX) |
| AR-3-19 | Figlet: egne fonter i FIGlet-format (`vr-blokk` 4 rader, `vr-smal` 3 rader) laget av UX, prosjektets lisens, bundlet, egen liten `.flf`-leser (ingen `figlet`-pakke). Versaler, ÆØÅ, sifre og vanlig tegnsetting; andre aksenter strippes; mangler et tegn, brukes fet tekst for hele hodet. | Lisens og æøå; standardfontene mangler æøå. | Vedtatt |
| AR-3-20 | Fallback for hodet: `vr-blokk` én linje → `vr-blokk` ≤ 2 linjer (≤ 3 på tittel ved ≥ 36 rader) → `vr-smal` ≤ 2 linjer → fet tekst. Høyde ≤ ⅓ av radene. | AK-3-03. | Vedtatt |
| AR-3-21 | Tastedekoder for stdin til `KeyInput` (ADR-007): CSI, SS3, CSI u (kitty, flagg 1, slås på når terminalen svarer på `CSI ?u`), Alt som `ESC x`, bracketed paste, terminalsvar som egne hendelser. Ensom ESC = Escape etter 30 ms uten CSI u. | Samme motor og akkorder som web; entydig Esc i Ghostty. | Vedtatt |
| AR-3-22 | Katalogen får `surfaces` (standard begge) og `surfaceBindings.terminal`. `createCommandRegistry(surface, handlers)`; policy, keymap og `?` per flate og modus; README uendret. Terminalen: v2-present-bindingene + `q`/`Ctrl+c` på `present.stop` (kun terminal), `:farger`, `:palett`, `:lys`/`:mørk`. Bare web: `present.start`, `present.fullscreen`, `theme.setType`, `appearance.open`. | Gjenbruk av katalogen (P2) uten å endre web-tastene. | Vedtatt |
| AR-3-23 | `present.stop` får aliaset `q`, så `:q` virker – også i web-paletten. | Spesifikasjonens `:q`; vim-konsistent. | Antakelse (PO) |
| AR-3-24 | `:`-linjen i nederste rad bruker samme `commandPaletteOptions`, fuzzy og `argumentError` som web-paletten; E475/E486/E492 med samme tekster (E492-teksten flyttes til `core/commands`). | AK-3-08; ingen egen kommandoparser. | Vedtatt |
| AR-3-25 | CLI: `--vault`, `--config`, `--vault-id` går uendret til `resolveConfig`; terminalflaggene `--niva`, `--palett`, `--farger`, `--uten-agenda`, `-h/--hjelp`; `--port`/`--lan` avvises; posisjonsargumenter settes sammen. | ADR-005-presedens; enkel bruk uten anførselstegn. | Vedtatt |
| AR-3-26 | Notatoppslag: eksakt sti → eksakt tittel/alias → Obsidian-oppløsning → fuzzy (klart beste treff åpnes, ellers notatlisten med søket utfylt). Notatlisten: nyeste først, fuzzy med `core/commands/fuzzy`. | AK-3-01; forutsigbart ved tvetydige navn. | Vedtatt |
| AR-3-27 | Live: chokidar i prosessen via `VaultRuntime` (samme debounce og slettehold som serveren); ny kortstokk + `resolveSlide`; omdøping følges, sletting gir melding. | AK-3-10; ingen ny live-logikk. | Vedtatt |
| AR-3-28 | Ingen valg huskes i v3 (palett, farger, nivå); terminalen skriver ingenting til disk. | P1/read-only; enkleste trygge variant. | Antakelse (PO) |
| AR-3-29 | Test: snapshot av rendret buffer (`frameToLines`) per lysbilde ved 80×24, 120×36, 200×50 for `test-vault/presentasjon/`, målrettede stilsjekker og invarianter (ingenting kuttes, ingen kontrolltegn). | AK-3-02–07 uten terminal. | Vedtatt |
| AR-3-30 | E2e i ekte pty via QAs headless tmux-rigg (`capture-pane`, `send-keys`, `resize-window`, `pipe-pane`, `stty -g` før/etter). Ikke node-pty (native, install-skript, Nexus) og ikke rør + `@xterm/headless` (arkitektens første forslag, forkastet). Eneste testkrok i appen: `VAULT_READER_TEST_CRASH=etter-første-ramme`. tmux ≥ 3.2 er systemkrav for e2e; mangler den, feiler testene tydelig. | Ekte termios og SIGWINCH uten npm-avhengigheter eller testmodus i produksjonskoden. | Vedtatt |

## PO-avgjørelser etter arkitektrapport v3

- **PO-106** AK-3-12 «start < 3 s» måles fra prosessstart (uten `npm`-overhead) på kundens Mac. I container/CI (4 kjerner, last) er grensen < 4,5 s, som for AK17.
- **PO-107** Ingen lokal lagring av terminalvalg i v3 (AR-3-28).
- **PO-108** `:q` som alias for å avslutte presentasjon også i web-paletten – godkjent (AR-3-23).
- **PO-109** Interne lenker i terminalen får OSC 8 til `obsidian://open?vault=…&file=…` slik at et klikk åpner notatet i Obsidian. Eksterne lenker som før.
- **PO-110** Ctrl z (suspend) støttes ikke i v3.
- **PO-111** `get-east-asian-width` flyttes til `dependencies` (sjekk mot ADR-006).
- **PO-112** Flyttingen til `src/core/` gjøres først og alene i 3-a, i små commits; antall tester skal være likt før og etter.
- Tetthetstrinn for terminal-tilpasning avgjøres av UX.

## PO-avgjørelser etter UX-rapport v3

Terminaldesignet (docs/design/terminal/, skjermbilder/v3) er **godkjent**. UX-avvikene fra ADR-011 (booktabs-tabeller, `▎` for sitater, tittel i tekstfarge, plassholderramme i `strek`, fotnoter som marginalia ved 200 kolonner, tetthet `[1]`, fonter med `▀▄█`, rollen `flate_bg`) godkjennes.
- **PO-113** Plassholdere beholder den valgfrie detaljlinjen (f.eks. «flowchart LR · 7 noder», «11 kort: todo 3 · doing 3 …»).
- **PO-114** Overgangslysbildet har seksjonsnavnet som hode (ikke «AGENDA»).
- **PO-115** Enkeregelen for «(forts.)» flyttes inn i den delte lysbildemodellen i `src/core` og gjelder også web. QA oppdaterer v2-fasiten hvis rekkefølgen endres.
- **PO-116** Hintet om `Ctrl +` vises ikke på tittelsiden; det vises kun som kort melding ved oppstart (før første lysbilde).
- **PO-117** `obsidian://`-lenker bruker vaultmappens navn som standard; kan overstyres med `obsidianVault` i vault-konfigen.
