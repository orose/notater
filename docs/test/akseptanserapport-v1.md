# Akseptanserapport v1 – Vault-leser

Eier: QA · Dato: 2026-11-06 · Omfang: slice 0–6, AK1–AK20 og Bases (`docs/produkt/brief.md`), PO-1 til PO-51.

## Konklusjon

**v1 er klar for kundens akseptanse.** Alle automatisk testbare akseptansekriterier er bestått mot den
ekte serveren. Det finnes ingen åpne bugs (`docs/test/bugs.md`, BUG-001 til BUG-011 er rettet). Fire punkter
krever manuell sjekk hos kunden (se sjekklisten nederst): AK4 på Mac, AK6 design, AK18 README og VoiceOver.
Mobil over hjemmenett (`--lan`) bør også prøves.

## Hvordan det er testet

| Nivå | Resultat |
|---|---|
| Vitest (enhet + integrasjon, server og web) | **703 / 703 bestått** (71 filer) |
| Playwright, ekte server (`desktop` 1440 px, `mobil` 360 px), mock-UI (`mock-desktop`/`mock-mobil`), `perf` | **462 bestått, 0 feilet**. 42 er bevisst skippet fordi de gjelder bare ett prosjekt (f.eks. AK8-matrisen kjøres bare på desktop, hover-tester ikke på touch) |
| ESLint, `tsc -b` | Grønne |
| README fulgt i ren kopi av repoet (uten `node_modules`/`dist`) | Bestått etter to små avvik i dokumentasjonen og testoppsettet, rettet (BUG-011) |

Oppsettet (PO-17): `e2e/global-setup.ts` kopierer `test-vault/` til en temp-mappe og setter fixture-mtimes. Den
bygger web til temp og starter `src/server/main.ts` mot kopien. Testene som endrer filer (live reload), og
testene for flere vaults, `--lan` og `npm start`, bruker egne servere og kopier. Ingenting skrives i repoet.

Alle QA-testene har globale vakter. En test feiler ved:

- en dialog (`alert`)
- en forespørsel til en annen vert enn `127.0.0.1`
- en uventet JS-feil
- `console.error`

## Status per akseptansekriterium

| AK | Kriterium | Status | Bevis (e2e-fil) / merknad |
|---|---|---|---|
| AK1 | Ulike vaults via konfigfil | ✅ Bestått | `ak01-vault-indeks`: to vaults i én konfig, `/` går til `defaultVault`, begge kan åpnes. Fulgt i README: `--vault`, `.local.json`, `--config`, `--vault-id`, `VAULT_READER_PORT`. |
| AK2 | Tema følger OS | ✅ Bestått | `ak02-03-19`: følger `prefers-color-scheme` live. Mermaid og kode bytter tema uten reload. |
| AK3 | Manuell overstyring huskes | ✅ Bestått | `ak02-03-19`, `ak08-temaer`: Lys/Mørk/System, typesett og palett huskes over reload og navigasjon. |
| AK4 | Kjører lokalt på Mac | ⚠️ Manuell | `npm ci && npm start` virker i ren kopi (Linux, Node 22.23). Ikke prøvd på Mac – se sjekklisten. |
| AK5 | Mobilvennlig, ingen sidescroll | ✅ Bestått | `ak05-layout`: alle 89 dokumenter på 360 px uten horisontal sidescroll. Kode, tabeller, kanban og bilder scroller internt. |
| AK6 | Distinkt design | ⚠️ Manuell | Skjermbildematrise (`e2e/support/shots.spec.ts`). Krever vurdering fra PO og kunde. |
| AK7 | Navigasjon via lenker | ✅ Bestått | `ak07-11-navigasjon`: alle lenketyper i Lenketest, overskrifter, blokker, tvetydige lenker, eksterne lenker, canvas. |
| AK8 | Temasystem i to akser, AA | ✅ Bestått | `ak08-temaer`: 3 typesett × 4 paletter × lys/mørk = **24 kombinasjoner, 0 kontrastbrudd** (axe) på Callouts og Kodeblokker. |
| AK9 | Brutte lenker tydelige | ✅ Bestått | Brutte lenker navigerer ikke, har stiplet stil og forklaring. Alias-hint gir «Mente du Ordre?». Manglende anker regnes ikke som brutt. |
| AK10 | Tilbakelenker | ✅ Bestått | 7 mål stemmer med fasit, merket «fra egenskap». «Lenket fra» vises på «ikke skrevet ennå»-siden. |
| AK11 | Stabile URL-er, frem/tilbake | ✅ Bestått | 8 spesielle filnavn med reload, `&`, NFD, frem/tilbake med bevart scroll, `#anker` ved lasting. |
| AK12 | Live reload | ✅ Bestått | `ak12-live-reload`: endring vises uten refresh (mål ~1 s, testgrense 3 s), scroll bevares. Atomisk skriving, debounce, sletting og omdøping fanges opp. **`renamed` med from/to** (PO-49) gir «Notatet er flyttet til …». |
| AK13 | ⌘K-søk, tastatur | ✅ Bestått | `ak13-sok`: QA-SOK-01..09 og taggsøk. Snarveien vises som `Ctrl K` utenfor Mac (PO-36). |
| AK14 | Kodeblokker | ✅ Bestått | Highlighting, språkmerke, kopiering (utklippstavle), tittel, ukjent språk, lang linje. |
| AK15 | Mermaid | ✅ Bestått | 7 diagramtyper, feilkort for ugyldig diagram, tema-bytte, forstørring med Esc og fokus tilbake. |
| AK16 | Innholdsfortegnelse | ✅ Bestått | Nivå 2–4, unike ankre, scroll-spy på desktop, sammenleggbar på mobil. |
| AK17 | Ytelse | ✅ Bestått | Se «Ytelse» under. |
| AK18 | Én kommando + README | ✅ Bestått (+ manuell) | `npm start` bygger bare når kilden er endret (`v1-slice6`). README er fulgt kommando for kommando. Kunden bør lese README selv. |
| AK19 | WCAG AA, fokus, reduced motion | ✅ Bestått (automatisk) | axe: 0 brudd på 7 sider, søk, 404 og Bases, i lys og mørk, på desktop og mobil. Hopp-lenke, tastaturflyt med synlig fokus, `prefers-reduced-motion`. VoiceOver: manuell. |
| AK20 | Sikkerhet | ✅ Bestått | `ak20-sikkerhet`: traversal (30 varianter mot `document`/`assets`/`backlinks`/statiske ruter), XSS i sikkerhetsnotatet, CSP/nosniff, SVG-sandbox, Host-guard 403, 127.0.0.1. `v1-slice6`: `--lan` godtar egen IP og `<maskinnavn>.local` og gir 403 for fremmede verter. Uten flagget svarer bare loopback. Alle `/api/*` svarer bare på GET/HEAD (405 ellers). |
| Bases | Kundebaser identisk med fasit | ✅ Bestått | `bases.spec.ts`: Domene, Huskeliste/Kanban/Arkiv, Sprintoversikt blokk 1–4, embeds (`#Kanban`, `#Ukjent` → advarsel), `columnSize`, mtime i Europe/Oslo. |

## Ytelse (AK17)

Målt med `e2e/perf.spec.ts` mot det genererte vaultet (2000 notater, `--seed 42`) i en delt container med 4 kjerner
(loadavg 3–6 under målingen). Server- og klienttid er skilt med `Server-Timing` (BE31) og Resource Timing.

| Måling | Resultat | Krav |
|---|---|---|
| Indeksering (serverens `indexMs`, 5 kalde starter) | 2028, 2040, 1948, 2017, 2031 ms – **median 2028 ms** | < 3 s ✅ |
| Fra prosess-start til indeks klar (inkl. Node/tsx-oppstart, uten `vite build`, PO-4) | median 2641 ms | (info) |
| Notatbytte, klikk → ny tittel og innhold malt, 20 klikk uten prefetch | median 83 ms, **p95 152 ms** | < 200 ms ✅ |
| – serverdel (`Server-Timing` wait + build) | median 1 ms, p95 7 ms | |
| – henting etter klikk (nettverk + server) | median 20 ms, p95 53 ms | |
| – klientdel (totalt − henting: React, Shiki-DOM, layout) | median 64 ms, p95 109 ms | |
| Notatbytte med hover-prefetch (10 klikk, PO-51) | median 62 ms, p95 109 ms. Henting etter klikk: 0 ms | |

Etter ytelsesrunden ligger flaskehalsen på klienten (rendering), ikke på serveren. Første dokument rett etter
oppstart kan vente ca. 0,5 s én gang mens Shiki lastes (PO-50, godtatt).

## Kjente begrensninger i v1 (vedtatt, ikke feil)

- Dataview, `dataviewjs`, `tasks`, LaTeX-blokker, Canvas og Excalidraw vises som «ikke støttet»-kort med kildetekst. Inline-LaTeX vises rått (PO-13).
- Eksterne bilder lastes aldri (B10). De vises som lenke med bildeikon.
- `[[Alias]]` løses ikke til notatet, som i Obsidian (PO-1). Brutt lenke viser hint «Mente du …?».
- `==markering==` som krysser formatering vises rått (O10).
- Bases: bare tabell og kanban. Andre view-typer (f.eks. `gallery`) vises som «støttes ikke». `this` peker på `.base`-fila ved embed (PO-41).
- `--lan` støtter bare IPv4 og har ingen innlogging. Bruk det bare på et nettverk du stoler på (BE33).
- Første dokument etter oppstart kan bruke ca. 0,5 s (PO-50).
- Tidsstempler uten tidssone i frontmatter tolkes som UTC-dato (BE14).
- Søkeindeksen bygges i bakgrunnen. Det aller første søket rett etter oppstart kan vente litt (BE10/BE28).
- Ikke testet: WebKit/Safari automatisk (bare Chromium er installert i testmiljøet), og ekte Mac-filsystem (FSEvents, NFD fra Finder).

## Manuell sjekkliste for kunden

Kryss av og send tilbake til PO. Tar ca. 30 minutter.

**AK4 – kjører på Mac**
- [ ] `node --version` viser 22.22 eller nyere (ellers `nvm install && nvm use`).
- [ ] Ny klone: `npm install && npm start` → <http://127.0.0.1:4317> viser testvaultet.
- [ ] Stopp med `Ctrl C`, kjør `npm start` igjen. Meldingen «gjenbruker dist/web» kommer, og serveren er oppe på få sekunder.
- [ ] `npm start -- --vault ~/sti/til/ditt/vault`: eget vault vises. Gi et notat nytt navn i Finder eller Obsidian, og endringen vises uten refresh.
- [ ] Åpne i Safari: tema, søk (`⌘K`) og Mermaid virker.

**AK6 – design**
- [ ] Bla gjennom Velkommen, Kafka-grunnleggende, Callouts, Kodeblokker, Mermaid-galleri og Oppgaver.base i Tidsskrift, Terminal og Klartekst, i lys og mørk.
- [ ] Inntrykket er distinkt, gjennomarbeidet og motiverende å lese i (ikke «generisk»).

**AK18 – README**
- [ ] Følg README fra toppen uten hjelp: oppstart, eget vault, `vault-reader.config.local.json` med to vaults, bytte vault i sidepanelet.
- [ ] Feilsøkingsavsnittet forklarer det du eventuelt møtte.

**AK19 – skjermleser (VoiceOver, `⌘ F5`)**
- [ ] Rotor → Landemerker: navigasjon, hovedinnhold og innholdsfortegnelse finnes.
- [ ] Rotor → Overskrifter: én H1 per notat, logisk hierarki.
- [ ] En brutt lenke annonseres som knapp med forklaring. En callout som er foldet, annonseres som lukket eller åpen.
- [ ] `⌘K` → søket annonseres, treff kan velges med piltaster.

**Mobil via `--lan` (PO-3)**
- [ ] `npm start -- --lan` på hjemmenettet. Advarselen og adressene skrives ut. Tillat innkommende tilkoblinger hvis macOS spør.
- [ ] Åpne adressen på telefonen (samme Wi-Fi): navigasjonsskuffen, søket, et langt notat og Oppgaver-kanban virker uten sidescroll.
- [ ] Start på nytt uten `--lan`. Telefonen når ikke lenger leseren.
