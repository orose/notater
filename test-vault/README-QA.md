# README-QA – fasit for testvaultet

Eier: QA. Dette er **fasiten** utviklerne tester mot. Hvert kanttilfelle har en ID (`QA-…`) som brukes i sporbarhetsmatrisen i `docs/test/teststrategi.md`. Fasit for basene står i `docs/test/bases-fasit.md`.

> [!warning] Dette notatet er selv en del av vaultet
> Det inneholder bevisst **ingen** ekte wikilinks og **ingen** tagger – all syntaks står i inline-kode. Det skal derfor ha 0 utgående lenker, 0 tagger og ikke dukke opp i noen base. Hvis det gjør det, tolker parseren inline-kode som markdown.

Endrer du et notat i `test-vault/`, oppdater fasiten her og i `docs/test/bases-fasit.md` i samme endring.

Alle tidligere **(PO?)**-punkter er avgjort (PO-1 til PO-38 i `docs/beslutninger.md`). Der en PO-avgjørelse har endret fasiten, står PO-nummeret i raden. Endringslogg for fasiten står i §18. Fasit for v1.1 (lesekomfort og tastatur) står i §19, for v2 (presentasjonsmodus) i §20.

---

## 1. Indeks og filer

| ID | Hva | Forventet |
|----|-----|-----------|
| QA-IDX-01 | Antall notater | **105** `.md`-filer indekseres (104 testnotater + denne fila). 11 av dem ligger i `lesekomfort/` (v1.1, §19), 14 i `presentasjon/` (v2, §20). |
| QA-IDX-02 | Andre filer | 9 ikke-md-filer er synlige for lenker, embeds og Bases: `Domene.base`, `Oppgaver.base`, `Tegning.canvas`, `attachments/arkitektur.png`, `attachments/bred.png`, `attachments/diagram med mellomrom.png`, `attachments/logo.svg`, `attachments/ondsinnet.svg`, `domene/domenemodell.svg`. |
| QA-IDX-03 | `.obsidian/` | Ignoreres helt. `.obsidian/plugins/dataview/README.md` (som inneholder `#task`) skal **ikke** finnes i fil-tre, søk, lenkeoppløsning eller baser. |
| QA-IDX-04 | `.trash/` | Ignoreres helt. `.trash/Slettet notat.md` (tagget `task`) skal ikke vises noe sted. Lenken `[[Slettet notat]]` er brutt. Generelt: alle mapper/filer som starter med `.` ignoreres. |
| QA-IDX-05 | Tomt notat | `edge/Tomt notat.md` (0 byte) indekseres, vises med tittel fra filnavnet og en vennlig tom-tilstand («Notatet er tomt»). Ingen krasj. |
| QA-IDX-06 | Kun frontmatter | `edge/Kun frontmatter.md`: egenskapspanel vises (tags `qa`, status `utkast`, opprettet 2026-10-30), brødtekst er tom-tilstand. Aliaset `Bare egenskaper` er søkbart. |
| QA-IDX-07 | Ugyldig YAML | `edge/Ugyldig frontmatter.md`: brødteksten rendres, diskret advarsel «Egenskapene kunne ikke leses». **Ingen** tagger, **ingen** properties. Resten av indeksen påvirkes ikke. |
| QA-IDX-08 | Uavsluttet frontmatter | `edge/Uavsluttet frontmatter.md`: ingen frontmatter. Første `---` rendres som horisontal linje, `tags: [qa] status: todo` som vanlig avsnitt. Ingen tagger. |
| QA-IDX-09 | Unicode NFD | `edge/Årsrapport (NFD).md` har filnavn i NFD. Indeksen normaliserer til **NFC**: notatet finnes én gang, `[[Årsrapport (NFD)]]` (NFC) løses, URL-en er stabil. |
| QA-IDX-10 | Dypt nestet | `edge/a/b/c/d/e/Dypt nestet notat.md` og `prosjekter/2026/q4/backend/sprint-12/Optimaliser SQL-spørring.md` vises i fil-treet uten at det sprenger bredden på 360 px. |
| QA-IDX-11 | Excalidraw | `edge/Skisse.excalidraw.md` indekseres (lenker/tagger) med `file.name` = `Skisse.excalidraw`. Vises som «ikke støttet»-kort (Excalidraw) og er **ikke** med i søk (R5, BE15). |
| QA-IDX-12 | Maler | `templates/` indekseres som vanlige notater (de er lesbare), men `{{title}}`/`{{date}}` vises rått. |
| QA-IDX-13 | Live reload (AK12) | Endre/opprett/slett/omdøp en fil i en *kopi* av vaultet → endringen vises uten manuell refresh innen ~1 s; tilbakelenker og baser oppdateres. |

## 2. Filnavn og URL-er (AK11)

| ID | Notat | Forventet |
|----|-------|-----------|
| QA-URL-01 | `edge/Æøå og mellomrom – særnorsk.md` | Stabil, bokmerkbar URL (prosent-kodet eller slug – men samme hver gang). Reload på URL-en gir samme notat. |
| QA-URL-02 | `edge/versjon 2.0.1 notater.md` | `file.name` = `versjon 2.0.1 notater`. Ruting tolker ikke `.1 notater` som filendelse. |
| QA-URL-03 | `edge/Notat (kopi).md`, `oppgaver/Avklar (GDPR) sletting av kundedata.md` | Parenteser fungerer i URL, lenker og baser. |
| QA-URL-04 | `edge/R&D – spørsmål og svar.md` | `&` kodes som `%26`; tolkes ikke som query-parameter. |
| QA-URL-05 | `oppgaver/Oppgrader Spring Boot til 3.3.md` | `file.name` = `Oppgrader Spring Boot til 3.3`. |
| QA-URL-06 | Frem/tilbake | Klikk Velkommen → Lenketest → Ordre, deretter nettleser-tilbake to ganger → Velkommen; frem igjen → Lenketest. Scrollposisjon gjenopprettes (R10). |
| QA-URL-07 | Ukjent URL | URL til et notat som ikke finnes gir en pen side i appen («Dette notatet er ikke skrevet ennå») med lenke hjem – ikke en hvit side. Siden viser «Lenket fra» med notatene som lenker til det manglende målet (PO-28), f.eks. `/v/test/Finnes ikke` → «Lenket fra»: `lenker/Embed-test.md` (embed), `edge/Frontmatter-typer.md` (fra egenskap), `lenker/Lenketest.md`. |
| QA-URL-08 | Path traversal (AK20) | `GET` med `../`, `%2e%2e/`, `..%2f`, dobbelkodet `%252e`, `\`, absolutte stier og NUL-byte mot alle fil-/notat-endepunkter (`document`, `assets`, `backlinks`) og mot statiske filer gir 400/404 (statiske ruter: SPA-`index.html`) og leser aldri utenfor vaultet. Dot-mapper (`.obsidian/`, `.trash/`) gir 404. Ukjent API-rute gir 404 `NOT_FOUND` (PO-24). |

## 3. Tagger

Regel: tagger = frontmatter `tags` (liste **eller** skalar streng) + inline `#tagg` i brødtekst. **Ikke** i kodeblokker, inline-kode, `%%kommentarer%%`, URL-fragmenter eller ord uten mellomrom foran (`Utrop#x`). Rene tall (`#2026`) er ikke tagger. Sammenligning er case-insensitiv; visning bruker skrivemåten fra kilden.

| ID | Notat | Forventede tagger (i denne rekkefølgen: frontmatter, så inline) |
|----|-------|------|
| QA-TAG-01 | `oppgaver/Rydd Kafka-konsumentgrupper.md` | `team`, `task/backend` |
| QA-TAG-02 | `oppgaver/Migrer til Java 21.md` | `task/backend` (kun nestet i frontmatter) |
| QA-TAG-03 | `oppgaver/Dokumenter retry-strategi.md` | `task` (kun inline) |
| QA-TAG-04 | `oppgaver/Oppdater README.md` | `task` (skalar `tags: task`) |
| QA-TAG-05 | `oppgaver/Bytt til records i DTO-er.md` | `Task` (inline, stor T) – `hasTag("task")` = sann |
| QA-TAG-06 | `oppgaver/Evaluer Testcontainers.md` | `task`, `team` (team inline) |
| QA-TAG-07 | `teknisk/Bash-tips.md` | `bash`, `verktøy`, `taskforce` – **ikke** `task` (`#task` står bare i kode og i URL) |
| QA-TAG-08 | `teknisk/Markdown-elementer.md` | `qa`, `markdown`, `arkitektur`, `java/spring`, `særnorsk`, `kafka-streams` – ikke `2026`, ikke `ikke-tagg-i-kode`, ikke `ikke-tagg`, ikke `ikkeentagg` |
| QA-TAG-09 | `domene/betaling-mottatt.md` | `kafka-topic` (kun inline) |
| QA-TAG-10 | `domene/delt/kunde-endret.md` | `kafka-topic/intern` – `hasTag("kafka-topic")` = sann |
| QA-TAG-11 | `domene/Hendelseskatalog.md` | `kafka-topics`, `katalog` – `hasTag("kafka-topic")` = **usann** |
| QA-TAG-12 | `edge/Ugyldig frontmatter.md` | ingen |
| QA-TAG-13 | `README-QA.md` (denne) | ingen |
| QA-TAG-14 | Tagg-klikk | Klikk på en tagg åpner søk på taggen (`#task`) med notatene som har den. Nestet: `task` inkluderer `task/backend` (T2). Taggsammenligning er case-insensitiv (PO-10). `GET /api/vaults/:id/tags` gir antall per tagg (PO-24). |

## 4. Lenker (AK7, AK9)

Oppløsningsregler (i tråd med arkitektens O1–O3 i `docs/beslutninger.md`; åpne punkter se PO-spørsmål L1–L5):

1. Fjern `#…` og `|…`. Tom mål-del = samme notat.
2. Mål med `/` → eksakt sti fra vault-rot, så relativ til kilden (`./`, `../`), så sti-suffiks (`delt/Adresse` matcher `domene/delt/Adresse.md`). En sti som havner **utenfor** vaultet er alltid brutt. Wikilinks URL-dekodes ikke (`%2e%2e` er bokstavelig → brutt).
3. Mål med kjent filendelse (`.md`, `.base`, `.canvas`, `.png`, `.svg`, …) → match på fullt filnavn.
4. Ellers: match `.md`-filnavn uten endelse, case-insensitivt, Unicode-NFC.
5. `aliases` brukes **ikke** til lenkeoppløsning (som i Obsidian, PO-1) – bare i søk og i notat-header. `[[Bestilling]]` er derfor brutt, men viser hint «Mente du *Ordre*?» (PO-7, `data-vr-suggest`, PO-25).
6. Flere treff → samme mappe som kildenotatet først, deretter korteste sti (færrest mapper), deretter alfabetisk sti. Diskret tvetydighetsindikator (PO-8, `data-vr-ambiguous="<antall>"`, PO-26).
7. Lenke til notat som finnes, men overskrift/blokk som ikke finnes → **ikke** brutt; går til notatet (toppen) og viser diskret hint.

Fasit for `lenker/Lenketest.md` (nummer = listepunkt i notatet):

| # | Lenke | Mål | Merknad |
|---|-------|-----|---------|
| 1 | `[[Ordre]]` | `domene/Ordre.md` | tekst «Ordre» |
| 2 | `[[Ordre\|ordrene våre]]` | `domene/Ordre.md` | tekst «ordrene våre» |
| 3 | `[[Kafka-grunnleggende#Partisjoner]]` | `teknisk/Kafka/Kafka-grunnleggende.md#partisjoner` | scroller til overskriften |
| 4 | `…#Antall partisjoner` | samme, underoverskrift | |
| 5 | `…#Leveransegarantier\|garantiene` | samme | tekst «garantiene» |
| 6 | `…#^offset-def` | avsnittet «En offset er posisjonen…» | blokken markeres kort (highlight) |
| 7 | `…#^liste-blokk` | listepunktet «Auto-commit er enkelt…» | |
| 8 | `[[domene/Betaling]]` | `domene/Betaling.md` | |
| 9 | `[[teknisk/Kafka/Consumer groups\|konsumentgrupper]]` | `teknisk/Kafka/Consumer groups.md` | |
| 10 | `[[Faktura.md]]` | `domene/Faktura.md` | |
| 11 | `[[Bestilling]]` | **brutt** (PO-1) | alias av `domene/Ordre.md` → hint «Mente du Ordre?» (PO-7) |
| 12 | `[[EDA]]` | **brutt** (PO-1) | alias av `teknisk/Arkitektur/Hendelsesdrevet arkitektur.md` → hint (PO-7) |
| 13 | `[[Loom\|virtuelle tråder]]` | **brutt** (PO-1) | alias av `teknisk/Java/Java 21 – virtuelle tråder.md` → hint (PO-7) |
| 14 | `[[Domenekart]]` | **brutt** (PO-1) | alias av `domene/_MOC.md` → hint (PO-7) |
| 15 | `[[kafka-grunnleggende]]` | `Kafka-grunnleggende` | case-avvik |
| 16 | `[[ORDRE]]` | `domene/Ordre.md` | case-avvik |
| 17 | `[[Avtale]]` | `domene/avtale.md` | case-avvik |
| 18 | `[[bestilling]]` | **brutt** (PO-1) | alias + case-avvik → hint «Mente du Ordre?» (PO-7) |
| 19–25 | spesielle filnavn | respektive notater i `edge/`, `teknisk/Spring/` | 24 = NFD-fila |
| 26 | `[[Kunde]]` | `domene/Kunde.md` | **tvetydig** (også `arkiv/2023/Kunde.md`). Regel 6: korteste sti. Diskret «tvetydig»-indikator, `data-vr-ambiguous="2"` (PO-8, PO-26) |
| 27 | `[[domene/Kunde]]` | `domene/Kunde.md` | |
| 28 | `[[arkiv/2023/Kunde\|gammel kunde]]` | `arkiv/2023/Kunde.md` | |
| 29–30 | `[[Finnes ikke]]` | **brutt** | stiplet/dempet stil + tooltip «Notatet … finnes ikke (ennå)». Rendres som ikke-navigerende knapp som viser forklaring ved klikk (frontend-avvik godkjent av PO); ingen 404-hopp (AK9) |
| 31 | `…#Overskrift som ikke finnes` | `Kafka-grunnleggende` (topp) | ikke brutt; hint «Fant ikke overskriften» |
| 32 | `…#^blokk-som-ikke-finnes` | `Kafka-grunnleggende` (topp) | som 31 |
| 33 | `[[domene/Finnes ikke]]` | **brutt** | |
| 34 | `[[Slettet notat]]` | **brutt** | `.trash/` ignoreres |
| 35 | `[[README]]` | **brutt** | finnes bare i `.obsidian/` |
| 36 | `[[Oppgaver.base]]` | `Oppgaver.base` | åpner basevisning |
| 37 | `[[Domene.base\|domeneoversikten]]` | `Domene.base` | |
| 38 | `[[Tegning.canvas]]` | «ikke støttet»-side for Canvas | ikke brutt |
| 39 | `[[arkitektur.png]]` | bildet (visning/ny fane) | lenke, ikke embed |
| 40 | `[[logo.svg\|logoen]]` | `attachments/logo.svg` | |
| 41 | `[[#Brutte lenker]]` | samme notat, overskrift | ingen sidelasting, bare scroll |
| 42 | `[[#^lokal-blokk]]` | samme notat, avsnittet med `^lokal-blokk` | `^lokal-blokk` vises **ikke** i teksten |
| 43 | `[[Lenketest#Grunnleggende]]` | samme notat | |
| 44–46 | markdown-lenker til `.md` | respektive notater, intern navigasjon | relativ til kildenotatet; URL-dekoding |
| 47 | ekstern | åpnes i ny fane med `rel="noopener noreferrer"`, med ekstern-ikon | ingen forhåndshenting (B10) |
| 48 | `[Brutt markdown-lenke](finnes-ikke.md)` | **brutt** | samme stil som 29 |
| 49–53 | ikke-lenker | vises som tekst/kode | gir **ikke** tilbakelenker |

Andre lenkefasiter:

| ID | Hva | Forventet |
|----|-----|-----------|
| QA-LNK-01 | Blokk-ID-er (`^offset-def`) | Vises aldri som tekst i rendret notat. |
| QA-LNK-02 | `domene/_MOC.md`: `[[delt/Adresse\|Adresse]]` | Løses til `domene/delt/Adresse.md` (sti-suffiks). |
| QA-LNK-03 | Lenke i tabellcelle med `\|` (`teknisk/Markdown-elementer.md`) | `[[Kunde\|lenke med alias i tabell]]` → lenke med tekst «lenke med alias i tabell», tabellen får ikke ekstra kolonne. |
| QA-LNK-04 | Lenker i properties (`domene/Ordre.md` → `relatert`) | Klikkbare lenker i egenskapspanelet; teller som tilbakelenker, merket «fra egenskap» (PO-9). `edge/Frontmatter-typer.md` → `[[Finnes ikke]]` i `lenkeliste` vises som brutt. |
| QA-LNK-05 | Sti-traversering i lenker (`edge/Sikkerhet – ondsinnet HTML.md`) | Alle er brutte; ingen forespørsel treffer filer utenfor vaultet. |
| QA-LNK-06 | Lenke i overskrift (`edge/Veldig langt notat.md`) | Klikkbar i notatet; TOC viser ren tekst. |

### Tilbakelenker (AK10)

Antall **distinkte kildenotater** (inkl. embeds og markdown-lenker; property-lenker i parentes):

| Mål | Forventet antall | Kilder |
|-----|------------------|--------|
| `domene/Kunde.md` | 9 | `domene/Ordre.md` (lenke + property), `domene/_MOC.md`, `domene/delt/Adresse.md`, `domene/delt/kunde-endret.md`, `domene/Ærendelogg.md`, `edge/Veldig langt notat.md`, `lenker/Lenketest.md`, `oppgaver/Avklar (GDPR) sletting av kundedata.md`, `teknisk/Markdown-elementer.md` |
| `arkiv/2023/Kunde.md` | 1 | `lenker/Lenketest.md` (bare den eksplisitte stien) |
| `teknisk/Kafka/Kafka-grunnleggende.md` | 8 (7 uten property-lenker) | `Velkommen.md`, `domene/Betaling.md`, `edge/Frontmatter-typer.md` (kun property), `lenker/Embed-test.md`, `lenker/Lenketest.md`, `teknisk/Arkitektur/Hendelsesdrevet arkitektur.md`, `teknisk/Kafka/Consumer groups.md`, `teknisk/Markdown-elementer.md` |
| `domene/Ordre.md` | 11 (10 uten property-lenker) | `domene/Betaling.md`, `domene/Faktura.md`, `domene/Kunde.md`, `domene/Lager.md`, `domene/_MOC.md`, `domene/ordre-opprettet.md`, `domene/Øyeblikksbilde.md`, `edge/Frontmatter-typer.md` (kun property), `lenker/Lenketest.md`, `oppgaver/Skriv integrasjonstest for ordre-API.md`, `teknisk/Arkitektur/Hendelsesdrevet arkitektur.md` |
| `domene/avtale.md` | 3 | `domene/Faktura.md`, `domene/_MOC.md`, `lenker/Lenketest.md` |
| `lenker/Syklus A.md` | 2 | `lenker/Embed-test.md`, `lenker/Syklus B.md` |
| `Oppgaver.base` | 6 | `Velkommen.md`, `lenker/Embed-test.md`, `lenker/Lenketest.md`, `teknisk/Bash-tips.md`, `templates/Oppgave-mal.md`, `templates/sprint/Sprint-oppgave-mal.md` |
| `README-QA.md` | 0 | |

Selvlenker (`[[#…]]`, `![[Selv-embed]]`) teller ikke som tilbakelenke. Lenker i kode/kommentarer teller ikke.

## 5. Embeds (Må: syklus-beskyttet)

| ID | Hvor | Forventet |
|----|------|-----------|
| QA-EMB-01 | `![[Consumer groups]]` | Hele notatet rendres innrammet, med tittel/lenke til kilden. Frontmatter vises ikke. |
| QA-EMB-02 | `![[Kafka-grunnleggende#Partisjoner]]` | Fra overskriften «Partisjoner» til neste overskrift på **samme eller høyere** nivå: inkluderer «Antall partisjoner», ikke «Offset». |
| QA-EMB-03 | `![[Kafka-grunnleggende#^offset-def]]` | Bare avsnittet med blokk-ID-en. Også brukt i `teknisk/Kafka/Consumer groups.md`. |
| QA-EMB-04 | `![[Kafka-grunnleggende#^liste-blokk]]` | Bare listepunktet. |
| QA-EMB-05 | `lenker/Syklus A.md` ↔ `lenker/Syklus B.md` | Åpne A: A viser B, B viser **ikke** A igjen men et diskret kort «Syklisk innbygging stoppet». Ingen uendelig løkke, ingen stack overflow, server svarer < 200 ms. Fra `lenker/Embed-test.md`: Embed-test → A → B → (stopp). |
| QA-EMB-06 | `lenker/Selv-embed.md` | Regel (PO-32, BE8): syklus = **samme fil + samme seksjon/anker** finnes allerede i embed-stakken. Det åpne notatet selv ligger i stakken som «hele fila». Derfor: (a) `![[Selv-embed]]` → syklus-kort. (b) `![[#Seksjon]]` står *før* overskriften «Seksjon» og er **lov**: seksjonen rendres innebygd, inkludert sin egen `![[#Annen seksjon]]`. (c) `![[#Annen seksjon]]` inne i «Seksjon» rendres. (d) Overskriften «Tredje seksjon» embedder seg selv med `![[#Tredje seksjon]]`: på toppnivå rendres embeden (seksjonen er ikke i stakken ennå), og *inne i* den innebygde seksjonen gir samme embed syklus-kort. Totalt: 2 syklus-kort, ingen uendelig løkke. |
| QA-EMB-07 | Kjede `Kjede 1 → Kjede 2 → Kjede 3#Innhold` | Tre nivåer rendres; «Ikke med»-seksjonen vises ikke. Maks embed-dybde er 5 (PO-15), deretter «for mange nivåer»-kort (`data-status="depth-limit"`). |
| QA-EMB-08 | `![[Finnes ikke]]`, `![[…#Seksjon som ikke finnes]]` | Diskret kort «Fant ikke …» (samme visuelle språk som brutte lenker). |
| QA-EMB-09 | `![[Oppgaver.base]]` | Basen rendres inline med alle tre views som faner (slice 3/4). |
| QA-EMB-10 | `![[Oppgaver.base#Kanban]]` | Bare Kanban-viewet (PO-12). `![[Oppgaver.base#Ukjent]]` → advarselskort «Viewet «Ukjent» finnes ikke» med liste over tilgjengelige views (PO-34; erstatter E2 «første view + advarsel»). Står i `lenker/Embed-test.md` (PO-42). |
| QA-EMB-11 | `![[Tomt notat]]` | Tomt innrammet kort / «Tomt notat», ingen krasj. |
| QA-EMB-12 | `![[Tegning.canvas]]` | «ikke støttet»-kort (Canvas). |
| QA-EMB-13 | `![[Domene.base]]` i `domene/_MOC.md` og `Velkommen.md` | Samme 12 rader som i `docs/test/bases-fasit.md`. |

## 6. Bilder (Bør)

Fil: `lenker/Bilder.md`.

| ID | Syntaks | Forventet |
|----|---------|-----------|
| QA-IMG-01 | `![[arkitektur.png]]` | 320×180-bilde, `alt` = filnavn. |
| QA-IMG-02 | `![[arkitektur.png\|160]]` | Bredde 160 px. |
| QA-IMG-03 | `![[arkitektur.png\|Arkitekturskisse\|200]]` | `alt` «Arkitekturskisse», bredde 200 px. |
| QA-IMG-04 | `![[attachments/logo.svg]]` | SVG vises som `<img>` (ikke inline-SVG i DOM). |
| QA-IMG-05 | `![[diagram med mellomrom.png]]` | Vises (mellomrom i filnavn). |
| QA-IMG-06 | `![[bred.png]]` (2400 px) | `max-width: 100%`; ingen horisontal sidescroll på 360 px (AK5). |
| QA-IMG-07 | `![…](../attachments/arkitektur.png)` | Relativ til notatets mappe. |
| QA-IMG-08 | `![…](attachments/logo.svg)` | Faller tilbake til vault-rot når relativ sti ikke finnes (BE7). |
| QA-IMG-09 | `![…](<../attachments/diagram med mellomrom.png>)` og `%20`-variant | Begge vises. |
| QA-IMG-10 | `![[mangler.png]]`, `![…](../attachments/mangler.png)` | Diskret plassholder «Bildet finnes ikke», ikke nettleserens knekt-bilde-ikon. |
| QA-IMG-11 | `![[domenemodell.svg]]` | Finnes i `domene/` – løses via filnavn. |
| QA-IMG-12 | `![[ondsinnet.svg]]` | Vises som `<img>`: ingen script kjører. Direkte URL til fila serveres med `Content-Security-Policy: sandbox; default-src 'none'; …` og `X-Content-Type-Options: nosniff` (AK20, ADR-005). |
| QA-IMG-13 | Eksternt bilde `https://example.com/sporingspiksel.png` | Lastes **ikke** (B10); vises som ekstern lenke med bildeikon (PO-13, `data-vr-external-image`). Ingen forespørsel til `example.com`. |

## 7. Callouts (Må)

Fil: `teknisk/Callouts.md`.

| ID | Forventet |
|----|-----------|
| QA-CAL-01 | Alle 13 typer + aliaser (`summary`/`tldr` → abstract, `hint`/`important` → tip, `check`/`done` → success, `help`/`faq` → question, `caution`/`attention` → warning, `fail`/`missing` → failure, `error` → danger, `cite` → quote) har riktig ikon og farge, AA-kontrast i alle temaer. |
| QA-CAL-02 | Uten tittel: norsk standardtittel (PO-14): `[!note]` → «Merk», ellers Sammendrag, Info, Gjøremål, Tips, Fullført, Spørsmål, Advarsel, Feilet, Fare, Feil, Eksempel, Sitat. Ukjent type uten tittel → typen med stor forbokstav. |
| QA-CAL-03 | `[!WARNING]` = warning. `[!egendefinert]` = note-utseende med tittel «Ukjent type». |
| QA-CAL-04 | Callout med bare tittel: ingen tom innholdsboks. |
| QA-CAL-05 | `[!tip]-`: lukket ved lasting. `[!tip]+`: åpen. Toggle med mus, Enter og Space; `aria-expanded` oppdateres; fokus synlig (AK19). Animasjon av når `prefers-reduced-motion`. |
| QA-CAL-06 | Nestet tre nivåer; innerste (`[!danger]-`) er lukket. Teksten «Mer tekst i ytre…» ligger i den ytre. |
| QA-CAL-07 | Kode i callout: highlighting, språkmerke og kopier-knapp som utenfor. Kopiert tekst inneholder **ikke** `> `. |
| QA-CAL-08 | Mermaid i callout rendres. |
| QA-CAL-09 | Oppgaveliste og tabell i callout rendres. |
| QA-CAL-10 | Vanlig blokksitat ser **ikke** ut som en callout. |
| QA-CAL-11 | `[!note]Mangler mellomrom etter ]` tolkes som callout med tittel «Mangler mellomrom etter ]». |

## 8. Kodeblokker (Må, AK14)

Fil: `teknisk/Kodeblokker – alle språk.md` (+ kode i mange andre notater).

| ID | Forventet |
|----|-----------|
| QA-KOD-01 | `java`, `json`, `bash`, `yaml`, `sql`, `typescript`, `ts`, `kotlin`, `xml`, `diff`, `html`, `sh`, `markdown` highlightes; tema-farger byttes ved lys/mørk uten reload. |
| QA-KOD-02 | Språkmerke vises (`ts` kan vises som «TypeScript»). |
| QA-KOD-03 | Kopier-knapp: kopierer eksakt innhold (inkl. innrykk/tab), gir «Kopiert»-tilbakemelding, tastaturtilgjengelig, har `aria-label`. |
| QA-KOD-04 | Ukjent språk `cobol-2077` og `promql` (`oppgaver/Lag dashboard i Grafana.md`): ren tekst, språkmerke med navnet, ingen krasj/konsollfeil. |
| QA-KOD-05 | Uten språk: ingen highlighting, ingen (eller nøytralt) språkmerke. Tab og innrykk bevart. |
| QA-KOD-06 | `~~~`-gjerde og fire-backtick-gjerde med ` ``` ` inni rendres korrekt. |
| QA-KOD-07 | Veldig lang linje: scroller horisontalt **inne i blokken**; `document.scrollingElement.scrollWidth <= innerWidth` på 360 px (AK5). |
| QA-KOD-08 | Kode i nummerert og nestet liste: riktig innrykk, listenummerering fortsetter (1, 2, 3). |
| QA-KOD-09 | Innrykket kodeblokk (4 mellomrom) vises som kode. |
| QA-KOD-10 | `html`-blokk med `<script>`: vises som tekst, kjøres aldri. |
| QA-KOD-11 | Tittel/filnavn: `teknisk/Spring/Spring Boot – konfigurasjon.md` har ` ```yaml title="src/main/resources/application.yaml"` og ` ```java title:OrdreProperties.java` → filnavn-merke på begge (R6). |
| QA-KOD-12 | `teknisk/Stor kodeblokk.md` (596 linjer): notatbytte < 200 ms (AK17), ingen hakking ved scroll, kopier gir alle linjene. Siste linje «Slutt på notatet…» vises. |
| QA-KOD-13 | ` ```sequenceDiagram` i `teknisk/Kafka/Consumer groups.md` er **ikke** mermaid – vises som kodeblokk med ukjent språk. |

## 9. Mermaid (Må, AK15)

Fil: `teknisk/Mermaid-galleri.md`, `teknisk/Stort mermaid-diagram.md`, samt diagrammer i `domene/Ordre.md`, `teknisk/Spring/Transaksjoner i Spring.md`, `teknisk/SQL/Indekser i PostgreSQL.md`, `teknisk/Java/Records og sealed interfaces.md`, `teknisk/Arkitektur/Hendelsesdrevet arkitektur.md`, `teknisk/Callouts.md`.

| ID | Forventet |
|----|-----------|
| QA-MER-01 | flowchart, sequenceDiagram, classDiagram, erDiagram, stateDiagram-v2, gantt og pie rendres som SVG. |
| QA-MER-02 | Temaet følger appens tema; ved bytte lys/mørk re-rendres diagrammene uten reload. |
| QA-MER-03 | Ugyldig diagram: feilkort i blokken med kildekoden synlig. Ingen «Syntax error»-bombe nederst i `<body>`, påfølgende diagram («pie») rendres. |
| QA-MER-04 | Stort diagram (62 noder): kan forstørres (fullskjerm/modal med zoom/pan), lukkes med Esc, fokus returnerer til knappen. På mobil scroller diagrammet internt. |
| QA-MER-05 | Mermaid kjøres med `securityLevel: 'strict'`: `click`-direktiver og HTML i etiketter i `edge/Sikkerhet – ondsinnet HTML.md` kjører ingen JS. |
| QA-MER-06 | Mermaid lastes lokalt (B10) og helst bare på sider som har diagrammer (ytelse). |

## 10. Markdown-elementer (Bør)

Fil: `teknisk/Markdown-elementer.md`.

| ID | Forventet |
|----|-----------|
| QA-MD-01 | `==markert==` → `<mark>`. `\==ikke markert\==` vises bokstavelig. `==markering med **fet** inni==`: kjent begrensning i v1 (arkitektens O10) – skal ikke krasje, men kan vises rått. |
| QA-MD-02 | `%%inline%%` og `%% … %%`-blokk vises **ikke**. Teksten «HEMMELIG-KOMMENTAR» finnes hverken i DOM eller i søkeresultater. |
| QA-MD-03 | Tabeller: justering (venstre/midt/høyre) respekteres; bred tabell scroller internt på mobil. |
| QA-MD-04 | Oppgavelister: `[ ]`, `[x]`, `[X]` som skrivebeskyttede avkrysningsbokser (`disabled`). `[/]` og `[-]` får egne ikoner (delvis/kansellert, R11; `li[data-task]`). Klikk endrer aldri fila (B1). |
| QA-MD-05 | Fotnoter `[^1]`, `[^navn]` og inline `^[…]`: hevet nummer, lenker begge veier. Fotnote med lenke og formatering fungerer. Bred skjerm: sidenoter i margen; smal skjerm/mobil: liste nederst med overskrift «Fotnoter» (PO-20, PO-30). |
| QA-MD-06 | Inline-tagger rendres som tagg-chips (klikkbare). |
| QA-MD-07 | Hard linjeskift med to mellomrom fungerer. Enkelt linjeskift blir `<br>` (Obsidian-standard, PO-14). |
| QA-MD-08 | Veldig langt ord/URL brytes (`overflow-wrap: anywhere`), ingen horisontal sidescroll. |
| QA-MD-09 | Ren URL (`https://spring.io`) og `<post@example.com>` blir lenker. |
| QA-MD-10 | Overskrifter H1–H6 har tydelig hierarki. PO-35: er notatets **første innholdsblokk** en H1, brukes den som visningstittel og fjernes fra brødteksten (siden har nøyaktig én H1). Ellers er tittelen filnavnet. Initialen (ornamentikk, PO-19) gjelder første avsnitt etter dette. |

## 11. Frontmatter og properties (Må)

Fil: `edge/Frontmatter-typer.md`.

| ID | Forventet |
|----|-----------|
| QA-FM-01 | Egenskapspanel viser tekst, tall (`42`, `3.14`), boolsk (avkrysning, deaktivert), dato (`05.11.2026` eller ISO – konsekvent), datotid, liste (chips), tom verdi (dempet «–»), `null`, nestet objekt (innrykket eller JSON), lenker (klikkbare; `[[Finnes ikke]]` brutt), URL (ekstern lenke). |
| QA-FM-02 | `tags` og `aliases` vises i egne dedikerte felt i header (chips), ikke som property-rader. `cssclasses`, `publish` og `position` vises **aldri** og sendes ikke fra serveren; ekstra skjulte nøkler via `hiddenProperties` i config (PO-22, PO-29). Ingress fra `description`, ellers `summary` (PO-21). Lesetid vises (PO-23). |
| QA-FM-03 | `edge/Sikkerhet – ondsinnet HTML.md`: `tittel` med `<img onerror>` vises som tekst; `lenke: "javascript:…"` blir **ikke** en klikkbar lenke. |
| QA-FM-04 | `edge/Ugyldig frontmatter.md`: API-et gir `frontmatterError` (norsk tekst), `properties` tom (PO-27). Gyldige notater: `frontmatterError: null`. |

## 12. Innholdsfortegnelse (AK16)

Fil: `edge/Veldig langt notat.md` (og `teknisk/Arkitektur/Hendelsesdrevet arkitektur.md`).

| ID | Forventet |
|----|-----------|
| QA-TOC-01 | TOC vises for notater med ≥ 3 overskrifter (PO-15, R9); skjules for korte notater. |
| QA-TOC-02 | Nivå 2–4 i TOC; nivå 5–6 utelates. |
| QA-TOC-03 | To overskrifter «Oppsummering» får unike ankre (`oppsummering`, `oppsummering-1`); klikk i TOC går til riktig. |
| QA-TOC-04 | Overskrift med `kode`, **fet** og lenke vises som ren tekst i TOC. |
| QA-TOC-05 | Scroll-spy på desktop markerer aktiv seksjon; på mobil er TOC sammenleggbar og tar ikke plass. |
| QA-TOC-06 | URL-hash oppdateres ved klikk i TOC; direkte URL med `#ankre` scroller dit ved lasting. |

## 13. HTML og sikkerhet (AK20)

Fil: `edge/Sikkerhet – ondsinnet HTML.md`.

| ID | Forventet |
|----|-----------|
| QA-SEC-01 | Ingen `alert`/dialog åpnes ved lasting, hover, klikk eller fokus (Playwright lytter på `page.on('dialog')` → test feiler). |
| QA-SEC-02 | `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>`, `<meta>`, `<base>`, `on*`-attributter, `javascript:`/`data:`-URL-er (inkl. blandet case og HTML-entiteter) fjernes. |
| QA-SEC-03 | Alle inline `style`-attributter fjernes (R7) – `position:fixed`-overlegget dekker ikke siden. |
| QA-SEC-04 | Ufarlig HTML (`<kbd>`, `<sub>`, `<sup>`, `<mark>`, `<details>/<summary>`) beholdes. `ontoggle` på `<details>` fjernes. |
| QA-SEC-05 | Ingen nettverksforespørsler til andre verter enn `127.0.0.1` under hele e2e-kjøringen (Playwright `page.on('request')`). |
| QA-SEC-06 | Server lytter kun på `127.0.0.1` (ikke `0.0.0.0`/`::`). Ingen `--host`-flagg (ukjent flagg gir feil). Opt-in `--lan` kommer i slice 6 med tydelig advarsel (PO-3). Host-header annet enn `127.0.0.1`/`localhost` → 403 (A16). |
| QA-SEC-07 | Responsene har `Content-Security-Policy` som forbyr inline-script og eksterne kilder (PO-16), samt `X-Content-Type-Options: nosniff` og `Referrer-Policy: no-referrer`. Kun `GET`/`HEAD`: andre metoder → 405 (B1). |

## 14. Ikke i scope (vises som «ikke støttet»)

Fil: `edge/Ikke støttet – dataview, LaTeX, canvas.md`.

| ID | Forventet |
|----|-----------|
| QA-NS-01 | ` ```dataview `, ` ```dataviewjs `, ` ```tasks `: diskret «ikke støttet»-kort med plugin-navn og mulighet for å se kildekoden. |
| QA-NS-02 | Inline dataview `` `= this.file.name` `` står i inline-kode og vises som kode. |
| QA-NS-03 | LaTeX inline `$x^2 + …$`: vises **rått** (med `$`) i monospace/dempet stil (PO-13). Blokk `$$ … $$`: «ikke støttet»-kort (LaTeX) med kilde. |
| QA-NS-04 | `Det koster $5 og $10` (i notatet) skal **ikke** tolkes som LaTeX eller forsvinne. |
| QA-NS-05 | `![[Tegning.canvas]]` og `![[Skisse.excalidraw]]`: «ikke støttet»-kort. |

## 15. Søk (AK13)

| ID | Søk | Forventet øverst blant treff |
|----|-----|------------------|
| QA-SOK-01 | `kafka grunn` | `Kafka-grunnleggende` (tittel) |
| QA-SOK-02 | `Bestilling` | `Ordre` (alias) |
| QA-SOK-03 | `særnorsk` / `Særnorsk` | `Æøå og mellomrom – særnorsk` |
| QA-SOK-04 | `aerendelogg` | `Ærendelogg` (diakritika-ufølsomt søk, R8) |
| QA-SOK-05 | `idempotensnøkler` | `Betaling` (innhold) |
| QA-SOK-06 | `HEMMELIG-KOMMENTAR` | **Ingen treff utenom `README-QA`** (PO-33: denne fila nevner selv ordet). Spesielt **ikke** `teknisk/Markdown-elementer` (kommentaren skal ikke indekseres). |
| QA-SOK-07 | `Slettet notat` | Ingen treff i `.trash/` (stien `.trash/Slettet notat` finnes aldri blant treffene). Notater som *nevner* teksten (f.eks. `Lenketest`, `README-QA`) kan treffes på innhold. |
| QA-SOK-08 | `<script>` | treff i Sikkerhet-notatet vises escapet, ingen kjøring |
| QA-SOK-09 | Tastatur | `⌘K`/`Ctrl+K` åpner, piltaster flytter, Enter åpner, Esc lukker og returnerer fokus. Snarveien vises som `⌘K` på macOS og `Ctrl K` ellers (PO-36). |

## 16. Baser

Se `docs/test/bases-fasit.md` for eksakte rader, rekkefølge, grupper og kolonner for `Domene.base`, `Oppgaver.base` (Huskeliste, Kanban, Arkiv) og de inline base-blokkene i `Sprintoversikt.md`.

Kort kontrollsum:

| Base / view | Antall rader/kort |
|-------------|-------------------|
| Domene | 12 |
| Oppgaver – Huskeliste | 13 (8 «Mine oppgaver» + 5 «Testgjengen») |
| Oppgaver – Kanban | 17 kort i 6 kolonner |
| Oppgaver – Arkiv | 4 |
| Sprintoversikt – Kritisk | 4 |
| Sprintoversikt – Team (kanban) | 5 kort i 3 kolonner |
| Sprintoversikt – Med feil | 18 + advarsel |
| Sprintoversikt – ugyldig YAML | feilkort |

---

## 17. Spørsmål til PO – alle avgjort

Alle forslag i tabellen er **godkjent** av PO slik de står (PO-7 til PO-17), med presiseringene i `docs/beslutninger.md`. Avvik fra forslaget er markert i raden.

| # | Spørsmål | QA foreslår |
|---|----------|-------------|
| L1 | Tvetydig `[[Kunde]]` – hvilket mål? | Samme mappe som kilden → korteste sti → alfabetisk. Vis diskret «tvetydig»-indikator med tooltip som lister alternativene. **Vedtatt (PO-8, PO-26).** |
| L2 | Teller lenker i properties (`relatert: "[[Kunde]]"`) som tilbakelenker? | Ja, merket «fra egenskap» (som Obsidian). |
| L3 | Overskrift/blokk finnes ikke, men notatet finnes – brutt? | Ikke brutt; naviger til notatet og vis kort hint. |
| L4 | Teller markdown-lenker `[x](../a.md)` som tilbakelenker? | Ja. |
| L5 | Skal `[[Alias]]` løses til notatet som har aliaset? Arkitekten (U1/O1) anbefaler nei, som Obsidian. Oppgaven til QA nevner «lenker via frontmatter-aliases». | QA støtter arkitekten (nei), men foreslår at en brutt lenke som **treffer et alias** får et hint «Mente du *Ordre*?» med lenke. Gir Obsidian-likhet uten blindvei. Testvaultet dekker begge utfall. |
| E1 | Maks embed-dybde? | 5 nivåer, deretter «for dypt»-kort. Syklus = samme fil + samme anker i stakken (PO-15, PO-32). **Vedtatt.** |
| E2 | `![[X.base#View]]` – bare ett view? | Ja, bare navngitt view (PO-12). **Endret av PO-34:** ukjent viewnavn → advarselskort «Viewet «X» finnes ikke» med liste over tilgjengelige views (ikke første view). |
| T1 | Er `hasTag`/tagger case-insensitive (`#Task`)? | Ja, som Obsidian. Visning beholder kildens skrivemåte. |
| T2 | Tagg-siden for `task` – inkluder `task/backend`? | Ja. |
| B1 | `file.inFolder("domene")` – rekursivt? | Ja (inkluderer `domene/delt/`), men ikke `domene-arkiv/`. |
| B2 | Sortering av tekst | `Intl.Collator('nb', { sensitivity: 'base', numeric: true })`: case-ufølsom, Æ < Ø < Å etter Z. |
| B3 | Manglende verdi i `sort` | Alltid sist, uansett retning. |
| B4 | `status != "done"` når `status` mangler | Sann (manglende ≠ «done»), dvs. notatet tas med. `status == "done"` er usann. |
| B5 | Kortrekkefølge i kanban uten `sort` | `file.name` stigende (nb-kollasjon). |
| B6 | Statusverdier som bare skiller på store/små bokstaver (`Todo` vs `todo`) | Case-sensitiv sammenligning (som Obsidian) → egen kolonne «Todo». |
| B7 | `groupOrder`-kolonne uten kort | Vises tom (med «0»), slik at tavla er stabil. Ikke-oppførte verdier vises bare når de har kort. |
| B8 | Ukjent funksjon i filter (`file.finnesIkke("x")`) | Leddet ignoreres (behandles som sann) + advarsel i viewet. Alternativ: hele viewet tomt + feilmelding. |
| B9 | Ukjent view-type (`gallery`) | Fane vises med «View-typen støttes ikke». |
| B10 | Visning av `file.mtime` og datoer | `dd.MM.yyyy HH:mm` i lokal tidssone (Europe/Oslo i test), `due` som `dd.MM.yyyy`. |
| B11 | `file.tags` i kanbankort | Tagg-chips uten `#`, i rekkefølge frontmatter → inline. |
| R1 | Inline LaTeX | Rå tekst i dempet monospace med tooltip «LaTeX støttes ikke». |
| R2 | Eksterne bilder (B10) | Ikke last automatisk; plassholder med lenke. |
| R3 | Enkelt linjeskift | `<br>` (Obsidian-standard). |
| R4 | Standardtitler i callouts | Norske («Merk», «Tips», «Advarsel» …). |
| R5 | Excalidraw-notater | «ikke støttet»-kort i stedet for rå drawing-tekst. |
| R6 | Kodeblokk-tittel | Støtt både `title="…"` og `title:…`. |
| R7 | Ufarlig inline `style` | Fjern alle `style`-attributter (enkelt og trygt). |
| R8 | Diakritika-ufølsomt søk (`aerendelogg` → `Ærendelogg`) | Ja for æ→ae, ø→o/oe, å→a/aa. |
| R9 | TOC-terskel | ≥ 3 overskrifter (H2–H4). |
| R10 | Scrollposisjon ved tilbake | Gjenopprettes. |
| R11 | `[/]` og `[-]` i oppgavelister | Egne ikoner (delvis/kansellert), fortsatt skrivebeskyttet. |

## 18. Endringslogg for fasiten

| Dato | Endring | Grunnlag |
|------|---------|----------|
| 2026-11-05 | QA-EMB-06 omskrevet: syklus = samme fil + samme seksjon. `![[#Seksjon]]` før seksjonen er lov. Ny seksjon «Tredje seksjon» i `lenker/Selv-embed.md` dekker ekte seksjons-selvembed. | PO-32 (BE-Q1) |
| 2026-11-05 | QA-SOK-06: «ingen treff utenom README-QA». QA-SOK-07 presisert. | PO-33 (BE-Q2) |
| 2026-11-05 | QA-EMB-10 / E2: ukjent view → advarselskort med liste over views. | PO-34 |
| 2026-11-06 | `![[Oppgaver.base#Ukjent]]` lagt inn i `lenker/Embed-test.md` (ingen endring i tilbakelenke-antall: Embed-test lenket allerede til `Oppgaver.base`). | PO-42 |
| 2026-11-05 | QA-MD-10: første H1 blir visningstittel og fjernes fra brødteksten. | PO-35 |
| 2026-11-05 | QA-SOK-09: snarvei vises som `⌘K` (macOS) / `Ctrl K` (ellers). | PO-36 |
| 2026-11-05 | Alias-hint (PO-7/PO-25), tvetydighetsindikator (PO-8/PO-26), property-backlinks (PO-9), tagger case-insensitive (PO-10), norske callout-titler og `<br>` (PO-14), embed-dybde 5 og TOC ≥ 3 (PO-15), CSP (PO-16), ingress/skjulte properties/lesetid (PO-21–23, PO-29), tags-endepunkt og 404 for ukjent API-rute (PO-24), `frontmatterError` (PO-27, ny QA-FM-04), «Lenket fra» på manglende notat (PO-28), «Fotnoter»/sidenoter (PO-20, PO-30). Alle **(PO?)**-merker fjernet. | PO-1–PO-31 |
| 2026-11-06 | Ny mappe `lesekomfort/` (11 notater) og §19 for v1.1: diskré embedding, folding, bredde, zen. QA-IDX-01: 80 → 91. Ingen tagger, ingen lenker til notater med fasit for tilbakelenker, ingen påvirkning på baser eller søkefasit. | v1.1, PO-53/54 |
| 2026-11-08 | Ny mappe `presentasjon/` (10 notater + 4 kilder) og §20 for v2: presentasjonsmodus. QA-IDX-01: 91 → 105. Ingen tagger, ingen lenker ut av mappa, ingen embed av `.base`-filer (kanban er en inline `base`-blokk), så tilbakelenke-, base- og søkefasiten er uendret. | v2 |

## 19. v1.1 – lesekomfort og tastatur

Testplan: `docs/test/testplan-v1.1.md`. Maskinlesbar fasit: `docs/test/v1.1-fasit.json` (testene leser den). Nivåregler: ADR-009 beslutning 3. Notatene i `lesekomfort/` har ingen tagger og lenker bare til hverandre, til `arkitektur.png` og til `Domene.base` (ingen av dem har tilbakelenke-fasit i §4).

| Notat | Formål |
|-------|--------|
| `lesekomfort/Kvartalsrapport.md` | Rapportnotat, nesten bare embeds: notat-, seksjons- og blokkembeds under H1, H2, H3, H5 og H6, nestet embed (`Leveranser` → `Plan`), manglende embed, syklus (`Sirkel A` ↔ `Sirkel B`), dybdegrense (`Trapp`, 7 trinn), bilde og base. Frontmatter har `diskret-embedding: true`, `lesebredde: full`, `zen: true` og `cssclasses` – **data, ikke visning** (P1). |
| `lesekomfort/kilder/*.md` | Kildene: `Sammendrag` (uten H1), `Driftsstatus` (med H1 = tittel, blokk `^oppetid`), `Leveranser`, `Plan`, `Risiko`, `Sirkel A`, `Sirkel B`, `Trapp`. |
| `lesekomfort/Dyp struktur.md` | Overskrifter H1–H6 (H1 i brødteksten: «Andre del»), en H2 som hopper rett til H4, blokk `^dyp-blokk` på nivå 6, interne lenker før første overskrift, et unikt søkeord i «Seksjon C». Hver seksjon har en markør («Markør A-2.» …). |
| `lesekomfort/Lang brødtekst.md` | Lange avsnitt for bredde og zen, ett veldig langt ord, properties (`lesebredde: full`, `zen: true` – P1) og lenker til de to andre. |

### 19.1 Rammevisning (standard, uendret fra v1)

| ID | Forventet |
|----|-----------|
| QA-V11-01 | `Kvartalsrapport` åpnes med **15** rammer («Innebygd fra»): 8 på toppnivå + `Plan` (nestet) + `Sirkel B` (nestet) + `Trapp` trinn 1–5. Frontmatter endrer ingenting (P1). |
| QA-V11-02 | Innholdsfortegnelse: `Nøkkeltall`, `Detaljer`, `Bilde og base`. §-nummer: §1 `Nøkkeltall`, §2 `Bilde og base`. Overskrifter i rammer foldes og nummereres ikke (PO-54). |
| QA-V11-03 | Feilkort: «Fant ikke «Finnes ikke i rapporten»», «Innbygging stoppet: syklus» (inne i `Sirkel B`), «Innbygging stoppet: for mange nivåer» (i stedet for `Trapp` trinn 6). «Bunnen av trappen.» vises aldri. |

### 19.2 Diskré embedding på `Kvartalsrapport`

Regel: tittelnivå `T = min(6, forrige + 1)`, der `forrige` er effektivt nivå på nærmeste foregående overskrift i verten; uten foregående overskrift `forrige = 1` (notatets tittel). Innebygde overskrifter flyttes med samme forskyvning og flates ut ved H6. Notat som begynner med H1: H1-teksten er tittelen, og vises **én** gang.

| ID | Overskrifter i rekkefølge (effektivt nivå) |
|----|------------------------------------------|
| QA-V11-10 | H2 Sammendrag · H3 Funn · H3 Konklusjon · **H1 Del I – Drift** · H2 Driftsstatus · H3 Hendelser · H4 Nattlige jobber · H3 Kapasitet · H4 Lagring · H3 Videre arbeid · **H2 Nøkkeltall** · H3 Kapasitet · H4 Lagring · (blokk `^oppetid`: ingen overskrift) · **H3 Detaljer** · H4 Leveranser · H5 Levert · H5 Planlagt · H6 Plan · H6 Steg · **H5 Fotnoter til detaljene** · H6 Konklusjon · **H6 Ytterste nivå** · H6 Risiko · H6 Tiltak · **H1 Del II – Feiltilstander** · (feilkort) · H2 Sirkel A · H3 Sirkel B · (syklus-kort) · H2 Trinn 1 · H3 Trinn 2 · H4 Trinn 3 · H5 Trinn 4 · H6 Trinn 5 · (dybde-kort) · **H2 Bilde og base**. Fet = vertsnotatets egne. |
| QA-V11-11 | Innholdsfortegnelse (nivå 2–4, 20 punkter): Sammendrag, Funn, Konklusjon, Driftsstatus, Hendelser, Nattlige jobber, Kapasitet, Lagring, Videre arbeid, Nøkkeltall, Kapasitet, Lagring, Detaljer, Leveranser, Sirkel A, Sirkel B, Trinn 1, Trinn 2, Trinn 3, Bilde og base. |
| QA-V11-12 | §-nummer (H2, sammenhengende, `data-vr-sec`): §1 Sammendrag, §2 Driftsstatus, §3 Nøkkeltall, §4 Sirkel A, §5 Trinn 1, §6 Bilde og base. Uendret når seksjoner foldes. |
| QA-V11-13 | Ingen ramme, etikett eller «Åpne notat»; kildelenke «Kilde: ‹tittel›» ved hover/fokus (seksjonsembed: «Kilde: Driftsstatus › Kapasitet»). Nestet `Plan` er også diskré. Feilkortene i QA-V11-03 er fortsatt synlige. Bildet og basen (12 rader) er uendret. |
| QA-V11-14 | Valget gjelder bare `Kvartalsrapport` og huskes etter reload. `lenker/Embed-test.md` og `lesekomfort/kilder/Driftsstatus.md` er upåvirket. |
| QA-V11-15 | Åpne punkter (testplanen Q-01/Q-02): nivå for embed uten foregående overskrift (her H2) og for nestet embed i et notat uten egne overskrifter (`Sirkel B` her H3, fordi `Sirkel A`s tittel er nærmeste foregående overskrift). |

### 19.3 Folding på `Dyp struktur`

| ID | Overskrift (nivå) | Skjuler | Forblir synlig |
|----|-------------------|---------|----------------|
| QA-V11-20 | Seksjon A (H2) | A-2, A-3, A-4, A-5, A-6, bunnavsnittet, A2-3 | B-2 |
| QA-V11-21 | Seksjon A.1 (H3) | A-3 … A-6, bunnavsnittet | A2-3 |
| QA-V11-22 | Seksjon A.1.1 (H4) | A-4, A-5, A-6, bunnavsnittet | A2-3 |
| QA-V11-23 | Seksjon A.1.1.1 (H5) | A-5, A-6, bunnavsnittet | A2-3 |
| QA-V11-24 | Nivå 6 – bunnen (H6) | A-6, bunnavsnittet | A2-3 |
| QA-V11-25 | Seksjon A.2 (H3) | A2-3 | B-2 |
| QA-V11-26 | Seksjon B (H2) | B-2, B-4 (H4-seksjonen under) | H1-2 |
| QA-V11-27 | Seksjon B hopper over H3 (H4) | B-4 | H1-2 |
| QA-V11-28 | Andre del (H1) | H1-2, Seksjon C og C-2 | – |
| QA-V11-29 | Seksjon C (H2) | C-2 | H1-2 |
| QA-V11-30 | Dyplenke «til blokken» etter «fold alle»: A, A.1, A.1.1, A.1.1.1 og Nivå 6 foldes ut; A.2, B og Andre del forblir foldet. Innholdet før første overskrift (lenkene) kan ikke foldes. TOC: A, A.1, A.1.1, A.2, B, B hopper over H3, C. |

### 19.4 Bredde og zen på `Lang brødtekst`

| ID | Forventet |
|----|-----------|
| QA-V11-40 | Åpnes leseoptimalisert og uten zen, selv om frontmatter sier `lesebredde: full` og `zen: true` (P1). Egenskapene vises som data. |
| QA-V11-41 | Full bredde ved 1440 px: avsnittene er minst 100 px bredere enn leseoptimalisert; panelene beholdes. 360 px: ingen horisontal sidescroll i noen tilstand (også med det lange ordet). |
| QA-V11-42 | Zen: tittel og egenskaper beholdes, paneler og krom skjules; lenken til `Dyp struktur` beholder zen. |

## 20. v2 – presentasjonsmodus

Testplan: `docs/test/testplan-v2.md`. Maskinlesbar fasit: `docs/test/v2-fasit.json` (testene leser den; TC-2-02-00 sjekker at fasiten stemmer med notatene). Notatene i `presentasjon/` har ingen tagger og lenker/embedder bare hverandre. Kanbantavlen i statusmøtet er en **inline** `base`-blokk med samme utvalg som Kanban-viewet i `Oppgaver.base` (17 kort i 6 kolonner, se `bases-fasit.md`), slik at tilbakelenkene til `Oppgaver.base` fortsatt er 6. Hvert lysbilde har en markør («Markør STATUS-A.» …) som testene leter etter.

Lysbildenotasjon under: **T** tittel · **A** agenda · **O(x)** overgang til agendapunkt x · **x [p/n]** innholdslysbilde med overskrift x og progresjon p/n innen agendapunktet. Standard lysbildenivå er H3 (agendanivå H2). Punkter merket (Q-nn) står i testplanen §8; de fleste er avgjort i ADR-010 / PO-84–91.

| Notat | Formål |
|-------|--------|
| `presentasjon/Statusmøte uke 45.md` | Eksempelnotatet fra spesifikasjonen: agendapunktene «Siden sist», «Jobbes med nå», «Relativt nær framtid»; lysbilder (H3) med liste, kode, kanban (inline base), Mermaid, tabell og fotnote. Frontmatter: `description` (ingress), properties, skjult `cssclasses` og **P1-feller**: `lysbildeniva: h4`, `agenda: av`, `presenter: { niva: 2, overganger: false }` – data, ikke visning. |
| `presentasjon/Månedsrapport oktober.md` + `presentasjon/kilder/*` | Rapport bygget av diskré embeds (S1): to agendapunkter er hele innebygde notater (`Siden sist`, `Jobbes med nå`, uten H1 → tittelen blir H2), ett er vertens egen H2 med to seksjonsembeds fra `Plan neste kvartal`. Nestet embed (`Leveranse søk`, H4) ligger inne i lysbildet «Leveranser». Seksjonen «Utenfor rapporten» skal aldri vises. P1-felle: `lysbildeniva: h4`. |
| `presentasjon/Delte lysbilder.md` | S5: `---` og `***` innen et lysbilde, `---` i en YAML-kodeblokk (deler ikke), `---` sist i en seksjon og to `---` på rad (ingen tomme lysbilder), agendaseksjon uten H3 delt med `---`. |
| `presentasjon/Mye innhold.md` | A2: «Lang gjennomgang» har 18 lange avsnitt og en liste med 20 punkter → krympes og fortsetter med «(forts.)». «Kort oppsummering» er kort. |
| `presentasjon/Stor kodeblokk.md` | A2 siste utvei: hvert lysbilde er én blokk som er for stor alene – kode (120 linjer), høyt Mermaid-diagram (25 steg), tabell (12 × 40). |
| `presentasjon/Uten overskrifter.md` | S7: ingen overskrifter, tre deler skilt med `---`. |
| `presentasjon/Innhold før agenda.md` | S6: kort avsnitt før første agendaoverskrift (får plass på tittellysbildet) + `description`. |
| `presentasjon/Langt innhold før agenda.md` | S6: fem lange avsnitt før første agendaoverskrift (eget lysbilde før agendaen); «Andre punkt» uten H3 (S3: ett lysbilde). |
| `presentasjon/Mange agendapunkter.md` | 8 agendapunkter med lange navn: avkortet agendalinje ved 1280×720. |
| `presentasjon/Lysbildenivå.md` | S4: H2/H3/H4 – testes med standard (h3), `:presenter h4` og `:presenter h2`; ugyldige og tomme nivåer. |

### 20.1 Lysbilderekkefølge

| ID | Notat | Forventet rekkefølge |
|----|-------|----------------------|
| QA-V2-01 | Statusmøte uke 45 | T · A · O(Siden sist) · Leveranse A – lesekomfort [1/2] · Leveranse B – tastaturmotor [2/2] · O(Jobbes med nå) · Oppgaver [1/2] · Flyt i presentasjonen [2/2] · O(Relativt nær framtid) · Plan Q1 [1/1] = **10** |
| QA-V2-02 | Månedsrapport oktober | T · A · O(Siden sist) · Driftsstabilitet [1/2] · Leveranser [2/2] · O(Jobbes med nå) · Jobbes med nå [1/3] (innledningen, Q-01) · Ytelse [2/3] · Presentasjonsmodus [3/3] · O(Relativt nær framtid) · Milepæler [1/2] · Risiko og tiltak [2/2] = **12** |
| QA-V2-03 | Delte lysbilder | T · A · O(Del én) · Arkitektur [1/4] · Arkitektur (forts.) [2/4] · Arkitektur (forts.) [3/4] · Grensesnitt [4/4] · O(Del to) · Del to [1/2] · Del to (forts.) [2/2] = **10** («(forts.)» teller i progresjonen, Q-02) |
| QA-V2-04 | Mye innhold | T · A · O(Bakgrunn) · Lang gjennomgang · Lang gjennomgang (forts.) × ≥ 1 · Kort oppsummering [N/N]. Antall deler avhenger av layout; alle markører `MYE-01..18`, `MYE-L01..20`, `MYE-SLUTT` nøyaktig én gang, i rekkefølge; ingen listepunkt delt. |
| QA-V2-05 | Stor kodeblokk | T · A · O(Enkeltblokker) · Lang kode [1/3] · Høyt diagram [2/3] · Bred tabell [3/3] = **6**. Ingen «(forts.)». Kode og tabell: minimumsskrift + intern rulling; diagrammet skaleres ned. |
| QA-V2-06 | Uten overskrifter | T · (UTEN-1) · (UTEN-2) · (UTEN-3) = **4**. Ingen agenda, ingen overganger, ingen agendalinje, innholdslysbildene uten overskrift (Q-03). |
| QA-V2-07 | Innhold før agenda | T (med ingress og FØR-KORT) · A · O(Første punkt) · Lysbilde én [1/1] · O(Andre punkt) · Lysbilde to [1/1] = **6** |
| QA-V2-08 | Langt innhold før agenda | T · (LANGFØR-1..5, eget lysbilde uten agendalinje, Q-03) · A · O(Første punkt) · Lysbilde én [1/1] · O(Andre punkt) · Andre punkt [1/1] = **7** |
| QA-V2-09 | Mange agendapunkter | T · A (alle 8) · 8 × (O(punkt) · Status n [1/1]) = **18** |
| QA-V2-10 | Lysbildenivå, h3 | T · A · O(Område A) · Tema A1 [1/2] (med Detalj A1a/A1b som innhold) · Tema A2 [2/2] · O(Område B) · Tema B1 [1/1] = **7** |
| QA-V2-11 | Lysbildenivå, `:presenter h4` | T · A (Tema A1, Tema A2, Tema B1) · O(Tema A1) · Tema A1 [1/3] (innledningen, Q-01) · Detalj A1a [2/3] · Detalj A1b [3/3] · O(Tema A2) · Detalj A2a [1/1] · O(Tema B1) · Detalj B1a [1/1] = **10**. «Område A/B» (over agendanivået) blir ikke lysbilder (Q-05). |
| QA-V2-12 | Lysbildenivå, `:presenter h2` | T · Område A · Område B = **3**. Agendanivået ville vært H1, som ikke finnes i brødteksten → ingen agenda (Q-04). |
| QA-V2-13 | Lysbildenivå, ugyldig/tomt | `h1`, `h7`, `hx`, `4` → feilkode (E…) + norsk forklaring, ingen presentasjon. `h5`, `h6` (finnes ikke i notatet) og `h4` i statusmøtet → feilkode «tomt nivå». Et feilet valg huskes ikke. |

### 20.2 Tittel, agenda, agendalinje og live

| ID | Forventet |
|----|-----------|
| QA-V2-20 | Tagger vises aldri på tittellysbildet (PO-90; sjekkes på `oppgaver/Refaktorer logging`, tagg `task`). Tittellysbildet i statusmøtet: «Statusmøte uke 45», ingressen «Status for leseren og presentasjonsmodus, uke 45.», properties (`møteleder`: Kari Nordmann, `dato`, `deltakere`, P1-fellene som data), **ikke** `cssclasses`, endringsdato 2026-11-01 (fixture-mtime). Ingen agendalinje. |
| QA-V2-21 | Agendalinjen på innholdslysbildene i statusmøtet viser alle tre punkter, gjeldende uthevet, med progresjon (`1/2`, `2/2`, `1/2`, `2/2`, `1/1`). Skjult på T, A og O. |
| QA-V2-22 | «Mange agendapunkter» ved 1280×720: Status 1 → Økonomi og budsjettoppfølging · Rekruttering og bemanning …; Status 5 → … Sikkerhet og personvern · **Arkitektur og teknisk gjeld** · Kundetilbakemeldinger og support …; Status 8 → … Leverandører og avtaler · **Opplæring og kompetanseheving**. |
| QA-V2-23 | `:agenda av` i statusmøtet: de 3 overgangene forsvinner (7 lysbilder), gjeldende lysbilde beholdes. Ny presentasjon (og reload, Q-09) har overgangene igjen. |
| QA-V2-24 | Live (i en vault-kopi): `## Jobbes med nå` → `## Pågår nå` mens «Oppgaver» (7) vises → agendalinjen viser «Pågår nå», fortsatt lysbilde 7. Sletting av «Leveranse B» mens den vises → overgangen til «Jobbes med nå», 5 / 9 (nærmeste nabo, etterfølger før forgjenger, ADR-010 §5). `oppgaver/Refaktorer logging.md` `status: todo` → `doing` → kortet flytter kolonne på «Oppgaver». |
| QA-V2-25 | Start fra leseposisjon i statusmøtet: toppen → 1, «Jobbes med nå» → 6 (overgangen), «Oppgaver» → 7, «Plan Q1» → 10. `Esc` går til seksjonen for gjeldende lysbilde (PO-87). |
| QA-V2-26 | URL (ADR-010 §4): `?lysbilde=<id>` med id-er `tittel`, `agenda`, `overgang.siden-sist` (3), `overgang.jobbes-med-nå` (6), `oppgaver` (7), `plan-q1` (10); i «Delte lysbilder» `arkitektur` (4), `arkitektur.del2` (5), `arkitektur.del3` (6). Ukjent id ved ny lasting → tittellysbildet (PO-91). Lenken «Månedsrapport oktober» på «Plan Q1» forlater presentasjonen; Tilbake går inn igjen (PO-89). |
