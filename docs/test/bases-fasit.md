# Bases-fasit for testvaultet

Eier: QA. Utledet fra `test-vault/` og verifisert med et uavhengig referanseskript (Python, ikke en del av leveransen). Maskinlesbar versjon: `docs/test/bases-fasit.json` – Vitest-/Playwright-tester bør importere den i stedet for å hardkode.

Basene `test-vault/Domene.base` og `test-vault/Oppgaver.base` er byte-identiske med `docs/produkt/bases-eksempler.md`.

## Forutsetninger

Fasiten bygger på disse reglene (fra PO-merknadene i `bases-eksempler.md` + QAs forslag merket **(PO?)**, se `test-vault/README-QA.md` §17):

| Regel | Kilde |
|-------|-------|
| `file.tags`/`file.hasTag` dekker frontmatter `tags` (liste eller skalar) **og** inline `#tagg` utenfor kode/kommentarer. | PO |
| `hasTag("task")` matcher `task` og nestede `task/…`, men **ikke** `tasks`/`taskforce`. | PO |
| `hasTag` er case-insensitiv (`#Task` matcher). | **(PO?)** T1 |
| `file.name` = filnavn uten `.md`. `file.folder` = mappesti relativt til vault-rot uten avsluttende `/` (`"/"` for rot, jf. arkitektens O4). | PO |
| `file.inFolder("x")` = `folder == "x"` eller `folder` starter med `"x/"`. | **(PO?)** B1 |
| `file.folder != "templates"` er **ikke** rekursiv: `templates/sprint/…` slipper gjennom (som i Obsidian). | Obsidian-semantikk |
| Strengsammenligning `==`/`!=` er case-sensitiv (`"Todo" != "todo"`). | **(PO?)** B6 |
| Manglende property: `status != "done"` → sann; `status == "done"` → usann. | **(PO?)** B4 |
| Sortering: tall numerisk, datoer kronologisk, tekst med `Intl.Collator('nb', { sensitivity: 'base', numeric: true })`. Manglende verdier **sist** uansett retning. | **(PO?)** B2, B3 |
| Kanban: kolonner i `groupOrder`-rekkefølge, deretter ikke-oppførte verdier alfabetisk (nb-kollasjon), deretter «(ingen)». | PO (+ B2) |
| Kanban uten `sort`: kort sortert på `file.name` stigende. | **(PO?)** B5 |
| `.obsidian/` og `.trash/` indekseres ikke. | QA-IDX-03/04 |
| Arkiv-viewet forutsetter mtimes fra `docs/test/fixture-mtimes.json` (git bevarer ikke mtime). Kjør `node test-vault-tools/sett-fixture-mtimes.mjs <kopi-av-vault>` før testen. | QA |

Kolonneoverskrifter (forslag): `file.name` → «Navn», `file.tags` → «Tagger», `file.mtime` → «Endret», `status` → «status», `due` → «due» (note-properties vises med eget navn). Datoer vises `dd.MM.yyyy`, `file.mtime` som `dd.MM.yyyy HH:mm` i Europe/Oslo **(PO?)** B10. Tomme celler vises som dempet «–».

---

## 1. `Domene.base` → view «Domene» (table)

Kolonner: **Navn** (`file.name`). Ingen gruppering. Sortering: `file.name` ASC.

| # | Navn | Sti |
|---|------|-----|
| 1 | Adresse | `domene/delt/Adresse.md` |
| 2 | avtale | `domene/avtale.md` |
| 3 | Betaling | `domene/Betaling.md` |
| 4 | Faktura | `domene/Faktura.md` |
| 5 | Hendelseskatalog | `domene/Hendelseskatalog.md` |
| 6 | Kunde | `domene/Kunde.md` |
| 7 | Lager | `domene/Lager.md` |
| 8 | Ordre | `domene/Ordre.md` |
| 9 | Produktkatalog | `domene/Produktkatalog.md` |
| 10 | Ærendelogg | `domene/Ærendelogg.md` |
| 11 | Øyeblikksbilde | `domene/Øyeblikksbilde.md` |
| 12 | Åpningstider | `domene/Åpningstider.md` |

**Skal IKKE vises** (og hvorfor):

| Fil | Filtrert av |
|-----|-------------|
| `domene/_MOC.md` | `file.name != "_MOC"` |
| `domene/ordre-opprettet.md` | `hasTag("kafka-topic")` (frontmatter) |
| `domene/betaling-mottatt.md` | `hasTag("kafka-topic")` (kun inline) |
| `domene/delt/kunde-endret.md` | `hasTag("kafka-topic")` (nestet `kafka-topic/intern`) |
| `domene/domenemodell.svg` | `file.ext == "md"` |
| `domene-arkiv/Gammel kunde.md` | `inFolder("domene")` (mappen heter `domene-arkiv`) |
| `arkiv/2023/Kunde.md` | `inFolder("domene")` |

## 2. `Oppgaver.base`

### 2.0 Global filtrering (grunnlag for alle tre views)

`file.hasTag("task") and file.folder != "templates"` gir **17** notater. Formel `formula.team` = «Testgjengen» hvis taggen `team` finnes, ellers «Mine oppgaver».

| Navn | Sti | Tagger (`file.tags`) | status | priority | due | formula.team |
|------|-----|---------------------|--------|----------|-----|--------------|
| Avklar (GDPR) sletting av kundedata | `oppgaver/` | task, team | todo | 1 | 2026-11-18 | Testgjengen |
| Bytt til records i DTO-er | `oppgaver/` | Task | todo | 3 | 2026-11-25 | Mine oppgaver |
| Dokumenter retry-strategi | `oppgaver/` | task | done | 3 | 2026-10-01 | Mine oppgaver |
| Evaluer Testcontainers | `oppgaver/` | task, team | blocked | 2 | 2026-12-01 | Testgjengen |
| Fiks flaky test i BetalingServiceTest | `oppgaver/` | task, team | done | 1 | 2026-10-15 | Testgjengen |
| Gjennomgå ADR-er | `oppgaver/` | task, team | done | 2 | 2026-09-30 | Testgjengen |
| Lag dashboard i Grafana | `oppgaver/` | task | Todo | 2 | 2026-11-10 | Mine oppgaver |
| Migrer til Java 21 | `oppgaver/` | task/backend | doing | 1 | 2026-11-08 | Mine oppgaver |
| Oppdater README | `oppgaver/` | task | done | 3 | 2026-10-20 | Mine oppgaver |
| Oppgrader Spring Boot til 3.3 | `oppgaver/` | task | todo | 1 | 2026-11-20 | Mine oppgaver |
| Optimaliser SQL-spørring | `prosjekter/2026/q4/backend/sprint-12/` | task, team | doing | 2 | 2026-11-09 | Testgjengen |
| Refaktorer logging | `oppgaver/` | task | todo | 10 | 2026-12-15 | Mine oppgaver |
| Rydd Kafka-konsumentgrupper | `oppgaver/` | team, task/backend | todo | 2 | 2026-11-15 | Testgjengen |
| Sett opp Flyway-migreringer | `oppgaver/` | task | – | 3 | – | Mine oppgaver |
| Skriv integrasjonstest for ordre-API | `oppgaver/` | task, team | doing | 2 | 2026-11-12 | Testgjengen |
| Sprint-oppgave-mal | `templates/sprint/` | task | todo | – | – | Mine oppgaver |
| Undersøk minnelekkasje | `oppgaver/` | task | todo | – | 2026-11-10 | Mine oppgaver |

**Skal IKKE vises:** `templates/Oppgave-mal.md` (folder = `templates`), `teknisk/Bash-tips.md` (`#task` bare i kode; `taskforce` ≠ `task`), `.trash/Slettet notat.md`, `.obsidian/plugins/dataview/README.md`, `teknisk/Arkitektur/ADR-001 Bruk Kafka.md` (har `status`, men ikke `task`), `edge/Ugyldig frontmatter.md` (ugyldig YAML → ingen tagger), `edge/Uavsluttet frontmatter.md`.

### 2.1 View «Huskeliste» (table)

- View-filter: `status != "done"` → 13 rader.
- Gruppert på `formula.team` ASC → grupper i rekkefølge **Mine oppgaver**, **Testgjengen**. Gruppeoverskrift viser navn og antall.
- Kolonner i rekkefølge: **Navn** (553 px), **status** (101 px – `note.status` i `columnSize` er samme property som `status`), **due** (standardbredde).
- Sortering innen gruppe: `priority` ASC, deretter `due` ASC. Manglende verdier sist.

**Mine oppgaver (8)**

| # | Navn | status | due | (priority – ikke vist) |
|---|------|--------|-----|------|
| 1 | Migrer til Java 21 | doing | 2026-11-08 | 1 |
| 2 | Oppgrader Spring Boot til 3.3 | todo | 2026-11-20 | 1 |
| 3 | Lag dashboard i Grafana | Todo | 2026-11-10 | 2 |
| 4 | Bytt til records i DTO-er | todo | 2026-11-25 | 3 |
| 5 | Sett opp Flyway-migreringer | – | – | 3 |
| 6 | Refaktorer logging | todo | 2026-12-15 | 10 |
| 7 | Undersøk minnelekkasje | todo | 2026-11-10 | – |
| 8 | Sprint-oppgave-mal | todo | – | – |

**Testgjengen (5)**

| # | Navn | status | due | (priority) |
|---|------|--------|-----|------|
| 1 | Avklar (GDPR) sletting av kundedata | todo | 2026-11-18 | 1 |
| 2 | Optimaliser SQL-spørring | doing | 2026-11-09 | 2 |
| 3 | Skriv integrasjonstest for ordre-API | doing | 2026-11-12 | 2 |
| 4 | Rydd Kafka-konsumentgrupper | todo | 2026-11-15 | 2 |
| 5 | Evaluer Testcontainers | blocked | 2026-12-01 | 2 |

Mobil (< 768 px): `columnSize` ignoreres ikke, men tabellen scroller horisontalt **internt**; siden scroller ikke horisontalt (AK5).

### 2.2 View «Kanban» (kanban)

- Ingen view-filter → alle 17.
- Kolonner (`groupBy: status`): `todo`, `doing`, `done` (fra `groupOrder`), så ikke-oppførte verdier alfabetisk: `blocked`, `Todo`, og til slutt **(ingen)**.
- Kortfelter: **Navn** (tittel, lenke til notatet), **Tagger** (`file.tags` som chips).
- Kortrekkefølge: `file.name` ASC (B5).

| Kolonne | Antall | Kort (Navn — Tagger) |
|---------|--------|----------------------|
| todo | 7 | Avklar (GDPR) sletting av kundedata — task, team · Bytt til records i DTO-er — Task · Oppgrader Spring Boot til 3.3 — task · Refaktorer logging — task · Rydd Kafka-konsumentgrupper — team, task/backend · Sprint-oppgave-mal — task · Undersøk minnelekkasje — task |
| doing | 3 | Migrer til Java 21 — task/backend · Optimaliser SQL-spørring — task, team · Skriv integrasjonstest for ordre-API — task, team |
| done | 4 | Dokumenter retry-strategi — task · Fiks flaky test i BetalingServiceTest — task, team · Gjennomgå ADR-er — task, team · Oppdater README — task |
| blocked | 1 | Evaluer Testcontainers — task, team |
| Todo | 1 | Lag dashboard i Grafana — task |
| (ingen) | 1 | Sett opp Flyway-migreringer — task |

Sum: 17 kort. Kanban er **skrivebeskyttet** (B1): kort kan ikke dras mellom kolonner.

### 2.3 View «Arkiv» (table)

- View-filter: `status == "done"` → 4 rader.
- Kolonner: **Navn**, **status**, **Endret** (`file.mtime`). `indentProperties: false` → ingen innrykk av property-kolonner (forslag: ingen synlig effekt i tabellvisning; ikke krasj).
- Sortering: `file.mtime` ASC. **Krever fixture-mtimes.**

| # | Navn | status | Endret (UTC i fixture) | Endret vist (Europe/Oslo) |
|---|------|--------|------------------------|---------------------------|
| 1 | Oppdater README | done | 2026-09-15T08:00:00Z | 15.09.2026 10:00 |
| 2 | Fiks flaky test i BetalingServiceTest | done | 2026-10-02T09:30:00Z | 02.10.2026 11:30 |
| 3 | Gjennomgå ADR-er | done | 2026-10-10T14:00:00Z | 10.10.2026 16:00 |
| 4 | Dokumenter retry-strategi | done | 2026-10-28T11:15:00Z | 28.10.2026 12:15 |

Merk at rekkefølgen bevisst er **ulik** sortering på `due` (som ville gitt Gjennomgå ADR-er først) – fanger at feil nøkkel brukes.

## 3. Inline base-blokker i `test-vault/Sprintoversikt.md`

Hver ` ```base `-blokk er sin egen base (uten `formulas`). Rekkefølgen under følger blokkene i notatet.

### 3.1 Blokk 1 – view «Kritisk» (table)

Filter: `inFolder("oppgaver") and hasTag("task") and priority == 1`. Kolonner: Navn, status, due. Sort: `due` DESC.

| # | Navn | status | due |
|---|------|--------|-----|
| 1 | Oppgrader Spring Boot til 3.3 | todo | 2026-11-20 |
| 2 | Avklar (GDPR) sletting av kundedata | todo | 2026-11-18 |
| 3 | Migrer til Java 21 | doing | 2026-11-08 |
| 4 | Fiks flaky test i BetalingServiceTest | done | 2026-10-15 |

`Optimaliser SQL-spørring` (prio 2) og alt i `prosjekter/` er ute.

### 3.2 Blokk 2 – view «Team» (kanban, `or` + `not`)

Globalt: `hasTag("team") or inFolder("prosjekter")`. View: `hasTag("task") and not(status == "done")`. `not:` med liste = ingen av leddene er sanne.

| Kolonne | Kort (Navn — due) |
|---------|-------------------|
| todo | Avklar (GDPR) sletting av kundedata — 2026-11-18 · Rydd Kafka-konsumentgrupper — 2026-11-15 |
| doing | Optimaliser SQL-spørring — 2026-11-09 · Skriv integrasjonstest for ordre-API — 2026-11-12 |
| blocked | Evaluer Testcontainers — 2026-12-01 |

Sum 5. Ingen «(ingen)»-kolonne (alle har status). `done` vises ikke (ikke i `groupOrder`, ingen kort).

### 3.3 Blokk 3 – ukjent funksjon / nøkkel / view-type

- Fane 1 «Med feil» (table): diskret advarsel om ukjent funksjon `file.finnesIkke` og ukjent nøkkel `ukjentNøkkel`. Med forslag B8 (ukjent ledd ignoreres) vises alle notater med `hasTag("task")` = **18** (de 17 over + `templates/Oppgave-mal.md`), sortert på `file.name` ASC (B5 gjelder også tabeller uten `sort`). Kolonne: Navn.
- Fane 2 «Ukjent view-type» (`gallery`): melding «View-typen støttes ikke» – ingen krasj.

### 3.4 Blokk 4 – ugyldig YAML

Feilkort i blokken («Kunne ikke lese base-definisjonen» + linjenummer hvis mulig). Resten av notatet rendres.

## 4. Embeds av baser

| Hvor | Forventet |
|------|-----------|
| `domene/_MOC.md`, `Velkommen.md`: `![[Domene.base]]` | Samme 12 rader som §1. |
| `lenker/Embed-test.md`: `![[Oppgaver.base]]` | Alle tre views som faner, første fane «Huskeliste» aktiv. |
| `lenker/Embed-test.md`: `![[Oppgaver.base#Kanban]]` | Bare Kanban (E2). |

## 5. Feilsøkingsnøkkel – symptom → sannsynlig feil

| Symptom | Sannsynlig feil |
|---------|-----------------|
| `Bash-tips` vises i oppgavebasen | Tagger hentes fra kodeblokker/inline-kode/URL-er, eller `hasTag` gjør prefiks-match på streng (`taskforce`). |
| `Oppgave-mal` vises | `file.folder`-filteret virker ikke. |
| `Sprint-oppgave-mal` mangler | `file.folder != "templates"` er implementert rekursivt (avviker fra Obsidian). |
| `Migrer til Java 21` / `Rydd Kafka-konsumentgrupper` mangler | Nestede tagger matches ikke. |
| `Dokumenter retry-strategi` mangler | Inline-tagger ignoreres. |
| `Oppdater README` mangler | `tags` som skalar streng støttes ikke. |
| `Bytt til records i DTO-er` mangler | Tagger case-sensitive. |
| `Refaktorer logging` (prio 10) havner før prio 2/3 | Tall sorteres som tekst. |
| `Sett opp Flyway-migreringer` / `Undersøk minnelekkasje` øverst | Manglende verdier sorteres først. |
| `Sett opp Flyway-migreringer` mangler i Huskeliste | `undefined != "done"` evalueres som usann. |
| `Lag dashboard i Grafana` i `todo`-kolonnen | Case-ufølsom gruppering (avviker fra B6). |
| `Todo`-kolonnen før `blocked` | Kodepunkt-sortering i stedet for nb-kollasjon. |
| Domene: `avtale` sist eller `Å…` før `Æ…` | Case-sensitiv / kodepunkt-sortering. |
| Domene: `Adresse` mangler | `inFolder` ikke rekursiv. |
| Domene: `Hendelseskatalog` mangler | `hasTag` prefiks-match (`kafka-topics`). |
| Domene: `Gammel kunde` vises | `inFolder` = `startsWith("domene")` uten `/`. |
| Domene: `betaling-mottatt` vises | Inline-tagger ignoreres i Bases. |
| Arkiv i rekkefølgen Gjennomgå → Dokumenter → Fiks → Oppdater | Sorterer på `due` i stedet for `file.mtime`. |
| Arkiv i tilfeldig rekkefølge | Fixture-mtimes ikke satt. |
| `Slettet notat` vises | `.trash/` indekseres. |
