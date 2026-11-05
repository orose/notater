# Produktbrief – Vault-leser (presentasjonslag for Obsidian)

Eier: PO. Dette dokumentet er kilden til sannhet for scope og beslutninger. Teamet skal ikke avvike uten å spørre PO.

## Visjon

En lokal, rask og *vakker* leser for et Obsidian-vault med teknisk innhold (IT, programmering, arkitektur).
Den skal være motiverende å lese i – som et godt teknisk tidsskrift – ikke en generisk «AI-dashboard»-side.

## Faste beslutninger (fra kunden)

| # | Beslutning |
|---|-----------|
| B1 | **Kun lesing** i v1. Løsningen skriver aldri til vaultet. |
| B2 | **Ren Node-løsning** (TypeScript). Ingen Java, ingen database. Filsystemet er kilden til sannhet; indeks i minnet. |
| B3 | Frontend i **React**: funksjonelle komponenter, **named exports** (ingen default exports). |
| B4 | **Feature-basert mappestruktur** (f.eks. `features/links`, `features/bases`), ikke tekniske lag (`controllers/`, `services/`). |
| B5 | **TDD**: tester skrives før implementasjon. Ingen star-imports (`import * as`) med mindre et bibliotek krever det. |
| B6 | Vault-sti settes i **konfigfil** (og kan overstyres med env/CLI-flagg). Flere vaults skal være mulig å bytte mellom via config. |
| B7 | Kjører lokalt på **macOS**, primært desktop, men **mobilvennlig**. |
| B8 | **Syntetisk testvault** brukes (ekte vault er ~2000 notater; ytelse skal testes mot generert vault av den størrelsen). |
| B9 | Grensesnitt på **norsk**. |
| B10 | Ingen nettverkskall ut. Fonter og biblioteker bundles lokalt. |

## Innholdsfunksjoner i bruk i vaultet

| Funksjon | Prioritet |
|---|---|
| Wikilinks `[[x]]`, `[[x\|alias]]`, `[[x#overskrift]]`, `[[x#^blokk]]` | Må |
| Innebygde notater `![[x]]`, `![[x#seksjon]]` (syklus-beskyttet) | Må |
| Callouts `> [!note]`, foldbare `> [!tip]-` | Må |
| Kodeblokker (java, json, bash, yaml, sql, ts, m.fl.) med syntax highlighting | Må |
| Mermaid | Må |
| Frontmatter / properties, tags | Må |
| **Bases** (`.base`-filer og ` ```base `-blokker i notater) – table og kanban | Må |
| Bilder `![[bilde.png]]` / `![](sti)` (ikke i bruk ennå, men skal støttes) | Bør |
| Oppgavelister, fotnoter, `==markering==`, `%%kommentar%%` (skjules) | Bør |
| LaTeX, Canvas, Excalidraw, Dataview | **Ikke i scope** – vises som et diskret «ikke støttet»-kort der det dukker opp |

## Bases – faktisk brukt syntaks (minimumsstøtte)

Begge kunde-eksemplene skal rendres korrekt. Se `docs/produkt/bases-eksempler.md`.

- Filtre: `and` (støtt også `or`, `not`), nestbare, både globalt og per view.
- Uttrykk: `file.inFolder(...)`, `file.hasTag(...)`, `file.ext`, `file.name`, `file.folder`, `file.mtime`, `file.tags`, sammenligning `==` `!=` `<` `>` `<=` `>=`, negasjon `!`, strenglitteraler, `if(cond, a, b)`.
- Property-navnerom: bar `status` == `note.status`; `formula.x`; `file.x`.
- Views: `type: table` og `type: kanban`; `name`, `order` (kolonner/kortfelter), `sort` (flere nøkler), `groupBy` (+ `direction`), `groupOrder` (kanban), `columnSize`, `indentProperties`.
- Flere views per base → faner.
- Ukjente funksjoner/nøkler: ikke krasj; vis en diskret advarsel i viewet.

## Akseptansekriterier

### Kunde
- AK1 Kan lese ulike vaults via konfigfil.
- AK2 Mørkt/lyst tema følger OS-innstilling.
- AK3 Tema kan overstyres manuelt (lys/mørk/system), valget huskes.
- AK4 Kjører lokalt på Mac.
- AK5 Mobilvennlig (≥ 360 px bredde, ingen horisontal scroll på sidenivå; kodeblokker scroller internt).
- AK6 Designet er distinkt, motiverende og typografisk gjennomarbeidet – ikke generisk.
- AK7 Navigasjon mellom notater ved klikk på lenker.

### Utvidet av PO
- AK8 **Temasystem i to akser** (ønske fra kunden): *typografisk sett* (minst «Tidsskrift» = retning A, og «Terminal-editorial» = retning C) × *fargepalett* (minst 2 per modus) × lys/mørk. Alle kombinasjoner skal holde WCAG AA-kontrast.
- AK9 Ødelagte lenker vises tydelig, men ikke stygt.
- AK10 Tilbakelenker per notat.
- AK11 Stabile, bokmerkbare URL-er per notat; frem/tilbake i nettleser fungerer.
- AK12 Live reload: endringer i vaultet (fra Obsidian) vises uten manuell refresh.
- AK13 `⌘K` hurtigsøk (tittel, aliaser, innhold). Full tastaturnavigasjon.
- AK14 Kodeblokker: highlighting som følger tema, språkmerke, kopier-knapp, filnavn/tittel hvis oppgitt.
- AK15 Mermaid følger tema, store diagrammer kan forstørres.
- AK16 Innholdsfortegnelse for lange notater (scroll-spy på desktop).
- AK17 Ytelse: ~2000 notater indeksert < 3 s; notatbytte < 200 ms.
- AK18 Én kommando for oppstart (`npm start` eller `./start.sh`), README med oppsett.
- AK19 WCAG AA, synlig fokus, `prefers-reduced-motion` respekteres.
- AK20 Sikkerhet: ingen path traversal ut av vaultet; HTML i markdown saniteres; server binder kun til `127.0.0.1`.

## Slice-plan

| # | Slice | Innhold |
|---|-------|---------|
| 0 | Grunnmur | Config → vault, filtre, markdown-rendering, tema lys/mørk/system |
| 1 | Navigasjon | Wikilinks, backlinks, URL-er, brutte lenker, embeds, bilder |
| 2 | Teknisk innhold | Kode, mermaid, callouts, properties, TOC |
| 3 | Bases – tabell | Filtre, formler, sortering, gruppering |
| 4 | Bases – kanban | Kanban-view |
| 5 | Flyt | ⌘K, live reload, snarveier |
| 6 | Polering | Temasystem fullt ut, mobil, a11y, ytelse |

## Arbeidsregler for teamet
- Alt arbeid på branch `claude/beautiful-curie-thcwd3`. PO committer etter hver leveranse.
- Detaljavklaringer: PO bestemmer. Antakelser dokumenteres i `docs/beslutninger.md`.
- Hver slice er «ferdig» når: tester grønne, QA har verifisert mot AK, README oppdatert, kunden kan teste med én kommando.
