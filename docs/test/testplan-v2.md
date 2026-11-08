# Testplan v2 – presentasjonsmodus

Eier: QA. Grunnlag: `docs/produkt/v2-spesifikasjon.md` (AK-2-01 til -14, S1–S8, L1–L4, A1–A5), `docs/test/teststrategi.md`,
`docs/test/testplan-v1.1.md` og ADR-007/008/009. Fasit: `test-vault/README-QA.md` §20 og `docs/test/v2-fasit.json`
(testene leser JSON-fila; endres vaultet, endres begge i samme commit).

## 1. Arbeidsform (TDD)

- Akseptansetestene ligger i `e2e/v2-*.spec.ts` og kjører mot den **ekte** serveren og en temp-kopi av testvaultet
  (globalSetup, PO-17), i prosjektene `desktop` (1440 px) og `mobil` (360 px, touch). Ytelse i `perf`.
- Alt som krever ny funksjonalitet er `test.fixme('TC-2-…', …)` med AK-ID i fil/describe. **Frontend fjerner `.fixme`**
  for testene som hører til en funksjon i samme commit som funksjonen leveres (B5). En test som fortsatt feiler etter
  levering er en bug – ikke en grunn til å endre testen uten QA.
- Aktiv nå (grønn): **TC-2-02-00** – fasiten (`v2-fasit.json`) stemmer med `test-vault/presentasjon/` (overskrifter og
  markører finnes, progresjon `n/N` er konsistent, én overgang per agendapunkt).
- Tester som endrer vaultet under presentasjon (AK-2-07, TC-2-09-05) bruker `liveTest` fra `e2e/support/v2.ts`: **egen
  vault-kopi og egen server per test** (PO-76-mønsteret fra `ak12-live-reload.spec.ts`), aldri den delte kopien.
- Hjelpere og selektorer: `e2e/support/v2.ts` (bygger på `guards.ts` og `v11.ts`).
- Kjøring: `E2E_PORT=4720 npx playwright test e2e/v2-` (bare v2), hele suiten uten filter, ytelse med
  `PERF_VAULT=<sti> E2E_PORT=4720 npx playwright test --project=perf`. Kjør **aldri** `playwright install`.

## 2. Testdata (nytt i testvaultet)

| Notat (`presentasjon/`) | Brukes til | Fasit |
|---|---|---|
| `Statusmøte uke 45` | Eksempelnotatet: 3 agendapunkter, H3-lysbilder med liste, kode, kanban (inline `base`), Mermaid, tabell, fotnote; ingress, properties, skjult `cssclasses`; P1-feller (`lysbildeniva`, `agenda: av`, `presenter:`) | QA-V2-01, -20..25 |
| `Månedsrapport oktober` + `kilder/*` (4) | Rapport av diskré embeds: agendapunkter fra hele notatembeds og fra vertens H2 med seksjonsembeds; nestet embed; seksjon som aldri skal vises; P1-felle | QA-V2-02 |
| `Delte lysbilder` | `---`/`***`, `---` i kodeblokk, `---` sist i seksjon og to på rad, agendaseksjon uten H3 | QA-V2-03 |
| `Mye innhold` | Krymping + «(forts.)», 39 markører, liste som bare kan deles mellom punkter | QA-V2-04 |
| `Stor kodeblokk` | Én for stor blokk per lysbilde: kode (120 linjer), høyt diagram, bred tabell | QA-V2-05 |
| `Uten overskrifter` | S7 | QA-V2-06 |
| `Innhold før agenda` / `Langt innhold før agenda` | S6: på tittellysbildet / eget lysbilde | QA-V2-07, -08 |
| `Mange agendapunkter` | 8 punkter, avkortet agendalinje | QA-V2-09, -22 |
| `Lysbildenivå` | S4: h3 (standard), h4, h2, ugyldige og tomme nivåer | QA-V2-10..13 |

Konsekvens: QA-IDX-01 er nå **105** notater (91 + 14). Oppdatert i `README-QA.md`, `e2e/ak01-vault-indeks.spec.ts`,
`src/server/app/create-app.test.ts` og `src/server/features/vault-index/vault-snapshot.test.ts` (godkjent av PO i oppdraget).
Ingen av de nye notatene har tagger, lenker ut av mappa eller embed av `.base`-filer: tilbakelenke-, base- og søkefasiten er
uendret (`Oppgaver.base` har fortsatt 6 tilbakelenker, se Q-17). Ytelsestesten (AK-2-13) genererer sitt eget vault.

## 3. Sporbarhet AK → testcaser

| AK | Fil | Testcaser |
|---|---|---|
| AK-2-01 Start/avslutt | `v2-ak01-start-avslutt.spec.ts` | TC-2-01-01 `Space p` fra toppen → tittel; -02 fra leseposisjon (topp/agendaoverskrift/lysbilde/siste, QA-V2-25); -03 `:presenter`; -04 `Esc` uten navigasjon → samme sted, `j` virker; -05 `Esc` etter navigasjon (Q-07); -06 `Esc` lukker oversikt/palett først; -07 `Space p` uten which-key, `Space` alene starter ikke; -08 `.base` deaktivert; -09 ingen ny henting av dokumentet |
| AK-2-02 Rekkefølge | `v2-ak02-04-struktur.spec.ts` | **TC-2-02-00 fasitsjekk (aktiv)**; -01 rekkefølge for 8 notater (statusmøte, rapport, delinger, store blokker, S7, S6 kort/lang, 8 punkter); -02 markører på riktig lysbilde; -03 diskré alltid i presentasjon, lesevisning urørt; -04 seksjonsembed avgrenset; -05 foldetilstand ignoreres (S8) |
| AK-2-03 Lysbildenivå | samme | TC-2-03-01 standard h3; -02 `:presenter h4` / `h2`; -03 huskes per notat (ny start, reload, annet notat upåvirket); -04 bare localStorage, ikke URL/notat, bare GET/HEAD, sjekksum; -05 `h3` tilbakestiller; -06 ugyldig (`h1` `h7` `hx` `4`) → feilkode; -07 tomt (`h5` `h6`) → feilkode, huskes ikke |
| AK-2-04 `---` | samme | TC-2-04-01 `---`/`***` med «(forts.)»; -02 `---` i kodeblokk deler ikke, ingen `<hr>`; -03 ingen tomme lysbilder; -04 S7 |
| AK-2-05 Tittel/agenda/overgang | `v2-ak05-07-agenda.spec.ts` | TC-2-05-01 tittellysbilde (ingress, properties, skjulte, dato, ingen agendalinje); -02/-03 S6; -04 agenda; -05 overganger med utheving og demping; -06 `:agenda av` beholder lysbildet; -07 huskes ikke (ny start, reload, Q-09); -08 S7 uten agenda |
| AK-2-06 Agendalinjen | samme | TC-2-06-01 på alle innholdslysbilder, utheving + progresjon, skjult ellers; -02 diskré (øverst, mindre); -03 avkorting ved 1280×720 (QA-V2-22); -04 agendalysbildet uavkortet; -05 rapport |
| AK-2-07 Live | samme (`liveTest`) | TC-2-07-01 endret agendaoverskrift; -02 **sletting av lysbildet man står på** (Q-06); -03 nytt lysbilde før gjeldende; -04 endret innhold; -05 notatet slettes |
| AK-2-08 For mye innhold | `v2-ak08-09-tilpasning.spec.ts` | TC-2-08-01 krymping + «(forts.)», alle markører én gang i rekkefølge, progresjon; -02 krymping før splitting; -03 listepunkt deles aldri; -04 for stor kode (intern rulling, fokuserbar); -05 høyt diagram skaleres; -06 for stor tabell; -07 ingen avkutting i noe fasitnotat |
| AK-2-09 Bases/Mermaid | samme | TC-2-09-01 kanban: 6 kolonner, 17 kort innenfor lerretet; -02 Mermaid; -03 tabeller; -04 fotnoter (A4); -05 **live kanban** (`liveTest`) |
| AK-2-10 Taster | `v2-ak10-11-taster-url.spec.ts` | TC-2-10-01/-02 hver neste/forrige-tast + grenser; -03 `gg`/`G`; -04 **klikker-taster**; -05 **Space i present-modus mot leader**; -06 svart skjerm; -07 oversikt med piler/hjkl/Enter/Esc; -08 oversikt med mus; -09 **temabytte under presentasjon** (`:tema`, `:mørk`, `Ctrl .`); -10 `:` på norsk tastatur; -11 `?` viser present-taster; -12 fremdrift (A5); -13 `g Esc`; -20 registeret har present-modus for hele tabellen; -21 P4 (normal), P5 (alle), konflikter, Esc = lukk; -22 paletten; -30/-31 touch trykk/sveip; -32 avslutt uten tastatur |
| AK-2-11 Fullskjerm/URL | samme | TC-2-11-01 fullskjerm inn/ut; -02 **fullskjerm avvist** (rejected promise); -03 fullskjerm utilgjengelig (iframe/Teams); -04 nettleseren går ut av fullskjerm (Q-10); -10 **reload med lysbilde i URL-en**; -11 dyplenke i ny fane; -12 historikk (Q-12); -13 ugyldig lysbilde i URL; -14 reload etter avslutning |
| AK-2-12 Lerret/WCAG | `v2-ak12-lerret-a11y.spec.ts`, `v2-ak12-axe-matrise.spec.ts` | TC-2-12-01 1280×720, 1440×900, 1920×1080 (desktop) og 390×844 (mobil): 16:9, letterbox, ingen sidescroll, ingen avkutting; -02 **vindusstørrelse endres**; -03/-04 typografi skalert (Q-08); -10 kunngjøring; -11 semantikk; -12 fokus; -13 toning / redusert bevegelse; -14 axe 390×844; **-20 axe-matrise 3 × 4 × 2 = 24** (tittel, agenda, overgang, innhold, kanban, Mermaid, tabell, oversikt, palett, `?`, «(forts.)») |
| AK-2-13 Ytelse | `v2-ak13-presentasjon-perf.spec.ts` (perf) | TC-2-13-01 start for rapport med 20 embeds < 500 ms (median av 5, maks rapporteres); -02 lysbildebytte p95 < 100 ms (80 bytter, `j`/`k`/`gg`/`G`) |
| AK-2-14 Regresjon | hele suiten + `v2-ak14-p1-regresjon.spec.ts` | §5; TC-2-14-01 lesevisningens tilstand (diskré, folding, zen) urørt; -02 `?` viser normal-taster igjen; -03 `Space p` i palett med primær tast |
| P1 | `v2-ak14-p1-regresjon.spec.ts` | TC-2-P1-01/-02 frontmatter-feller ignoreres; -03 fellene vises som data; -04 **alt i bruk → ingenting skrives** (sjekksum + mtime av `presentasjon/`, bare GET/HEAD) |

## 4. Kanttilfeller

| Kanttilfelle | Forventet | Test |
|---|---|---|
| Live endring av en agendaoverskrift under presentasjon | Agenda, overganger og agendalinje får nytt navn; samme lysbilde (identifisert ved overskrift) og nummer; ingen full sidelasting | TC-2-07-01 |
| Sletting av lysbildet man står på | Nærmeste vises: **forrige gjenværende** (Q-06); antall og progresjon oppdateres | TC-2-07-02 |
| Nytt lysbilde før gjeldende | Samme overskrift vises, nummeret øker | TC-2-07-03 |
| Notatet slettes/omdøpes under presentasjon | Presentasjonen avsluttes med forklaring («ikke skrevet ennå») – ingen hvit side | TC-2-07-05 |
| Reload med lysbilde i URL-en | Presentasjonen gjenopptas på samme lysbilde | TC-2-11-10, -11 |
| Ugyldig lysbilde i URL-en | Nærmeste (for stort tall → siste), ingen feil | TC-2-11-13 |
| Fullskjerm avvist / utilgjengelig | Presentasjonen virker i vinduet; ingen `pageerror`/`console.error` (vaktene); ingen forsøk når `fullscreenEnabled` er false | TC-2-11-02, -03 |
| Esc i fullskjerm | Nettleseren sluker Esc (går ut av fullskjerm). Se Q-10 | TC-2-11-04 + manuelt |
| Klikker-taster | `PageDown`/`PageUp`, `.`/`b` virker uten fokus på noe bestemt; `Space`/`→`/`←` som fallback | TC-2-10-04, -01/-02 |
| Klikker som sender `F5`/`Shift+F5` | Nettleseren laster siden på nytt → URL-en holder lysbildet (reload-testen dekker det) | TC-2-11-10 |
| Space i present-modus mot leader | `Space` = neste umiddelbart (ingen 400 ms which-key); `Space p` i present = neste + forrige; normal-modusens `Space w`/`z M` gjør ingenting | TC-2-10-05 |
| `Space p` i normal-modus | Starter uten which-key-hint; `Space` alene starter ikke | TC-2-01-07 |
| Temabytte under presentasjon | `:tema`, `:mørk`, `Ctrl .`/`⌘.` endrer tema; samme lysbilde, fortsatt 16:9 | TC-2-10-09, axe-matrisen |
| Vindusstørrelse endres | Lerretet tilpasses (letterbox), lysbildet beholdes, ingen sidescroll; også ekstreme forhold (900×900, 1600×500) | TC-2-12-02 |
| Lysbildenivå huskes per notat | Ny start og reload bruker valget; andre notater upåvirket; bare localStorage; `h3` tilbakestiller; feilet valg huskes ikke | TC-2-03-03..07 |
| P1: frontmatter | `lysbildeniva`, `agenda: av`, `presenter:` leses ikke; ingenting skrives (sjekksum + mtime), bare GET/HEAD | TC-2-P1-01..04, TC-2-03-04 |
| `:agenda av` | Bare gjeldende presentasjon; reload = ny presentasjon (Q-09) | TC-2-05-06, -07 |
| Foldet notat | Foldetilstand ignoreres i presentasjonen, er urørt etterpå | TC-2-02-05, TC-2-14-01 |
| Diskré av i lesevisningen | Presentasjonen bruker alltid diskré; lesevisningen er urørt etterpå | TC-2-02-03, TC-2-14-01 |
| `---` i kodeblokk / to `---` på rad / `---` sist i seksjon | Ingen deling / ingen tomt lysbilde | TC-2-04-02, -03 |
| `***` og `___` | Også tematiske skiller (samme som `---`) – Q-14 | TC-2-04-01 (`***`) |
| Setext-overskrift (`tekst` + `---` uten tom linje) | Er en H2, ikke et skille (CommonMark). Testvaultet har tomme linjer rundt alle skiller | Ikke testet (parseren eier dette) |
| Innhold mellom agenda- og første lysbildeoverskrift | Eget innholdslysbilde med agendapunktets navn (Q-01) | Rapport «Jobbes med nå», `:presenter h4` «Tema A1» |
| Overskrifter over agendanivået (h4: H2) | Blir ikke lysbilder (Q-05) | TC-2-03-02 |
| `:presenter h2` uten H1 i brødteksten | Ingen agenda; lysbilder på H2 (Q-04) | TC-2-03-02 |
| Listepunkt, kode, tabell, Mermaid, base | Deles aldri; for stor alene → skaleres (diagram) / minimumsskrift + intern rulling (kode/tabell), rullbar flate kan fokuseres | TC-2-08-03..06 |
| Ingenting kuttes usynlig | Alle blokker innenfor lerretet; innholdsflaten flyter ikke over (unntak: intern rulling) | `kuttetInnhold()` i TC-2-08-*, -12-01 |
| 8 agendapunkter | Agendalinjen: forrige · **nåværende** · neste med «…» der det er avkortet; agendalysbildet viser alle | TC-2-06-03, -04 |
| Ett agendapunkt | Agenda med ett punkt, overgang vises likevel («alltid») | `Mye innhold`, `Stor kodeblokk` i TC-2-02-01 |
| Presentasjon på `.base`-side | Deaktivert med forklaring (Q-19) | TC-2-01-08 |
| Bilder/diagrammer som lastes sent | Tilpasning skjer når de er lastet (Mermaid venter i testene på `svg`) | TC-2-08-05, -09-02 |
| Redusert bevegelse | Ingen toning; ellers kort toning (≤ 400 ms) | TC-2-12-13 |
| Touch | Trykk høyre/venstre, sveip, «Avslutt presentasjon» uten tastatur (P6) | TC-2-10-30..32 |
| Nettleser-tilbake | Lysbildebytte lager ikke historikkoppføringer (Q-12) | TC-2-11-12 |
| Privat modus / blokkert lagring | Nivåvalg gjelder økten, ingen feil | Enhetstest (view-settings); manuelt |

## 5. Regresjonsomfang (AK-2-14)

Hele den eksisterende suiten kjøres uendret ved hver slice: Vitest (enhet + integrasjon) og Playwright `desktop`, `mobil`,
`mock-desktop`, `mock-mobil`, samt `perf` før 2-d. Endringer QA har gjort i eksisterende tester for v2:

| Test | Endring | Hvorfor |
|---|---|---|
| `ak01-vault-indeks.spec.ts`, `create-app.test.ts`, `vault-snapshot.test.ts` | 91 → 105 notater | Nye notater i `presentasjon/` |
| `v1.1-ak08-register.spec.ts` TC-08-09 | Tillater modusen `present` i tillegg til `normal` (ingen andre), og gruppen «Presentasjon» (fra `v2-fasit.json`) | P3: present-modus er ny i v2. Fortsatt grønn i dag |

Spesielt utsatt:

| Område | Hvorfor | Tester |
|---|---|---|
| `?`-oversikten og README (TC-07-07/-08) | Present-kommandoer kommer inn i registeret; normal-modusens kort og README-tabellen teller rader | `v1.1-ak06-07-palett-oversikt.spec.ts` (se Q-16) |
| Tastaturmotoren (F7, P7) | Ny modus; `Esc`, `Space` og `:` får ny betydning i `present` | `v1.1-ak09-tastatur.spec.ts`, TC-2-10-05 |
| Disposisjon/diskré (AK-1.1-03) | Lysbildemodellen bygger på samme disposisjon | `v1.1-ak02-03-diskret.spec.ts` |
| Live reload (AK12) | Presentasjonen abonnerer på samme hendelser | `ak12-live-reload.spec.ts`, TC-2-07-* |
| Layout 360 px (AK5) | Nye notater, f.eks. lang kode og bred tabell i lesevisningen | `ak05-layout.spec.ts` (alle notater) |
| Ytelse (AK17, folding) | Lysbildemodellen må ikke beregnes ved hver lesevisning | `perf.spec.ts`, `v1.1-folding-perf.spec.ts` |
| WCAG (AK19, AK-1.1-12) | Nye farger (svart skjerm, demping) | axe-matrisene |

## 6. Selektorer og testid-er (kontrakt mot frontend)

Testene bruker rolle + navn der spesifikasjonen gir dem, ellers `data-testid`. Hjelperne ligger i `e2e/support/v2.ts`.
Avvik avtales med QA før de implementeres.

| Hva | Selektor | Merknad |
|---|---|---|
| Presentasjonen | `role=region` navn «Presentasjon», `aria-roledescription="lysbildeserie"`; `html[data-present="on"]` mens den vises | Lesevisningen bak er `inert` (ute av a11y-treet) |
| Lerretet | `data-testid="lerret"` (16:9, letterbox) | Testene måler forhold og at det fyller vinduet i én retning |
| Gjeldende lysbilde | `data-testid="lysbilde"` (bare ett synlig), `data-slide-type="tittel\|agenda\|overgang\|innhold"`, `data-slide-index="<n>"` (1-basert), `role=group`, `aria-roledescription="lysbilde"`, `aria-label="7 av 12: Leveranse B"` | APG-karusellmønsteret |
| Overskrift | `data-testid="lysbilde-overskrift"` (heading); «(forts.)» som tekst: «Arkitektur (forts.)» | Tittellysbildet: notattittelen |
| Innholdsflate | `data-testid="lysbilde-innhold"` – den skalerte flaten med blokkene som direkte barn | Brukes til «ingen avkutting» og minimumsskrift |
| Agendalinjen | `<ol data-testid="agendalinje" aria-label="Agenda">`, ett `<li>` per synlig punkt, gjeldende `aria-current="step"`, progresjon `data-testid="agenda-progresjon"` («2/3») i gjeldende punkt | Skjult (ikke rendret eller `hidden`) på T/A/O |
| Avkorting | `data-testid="agenda-ellipse"` med `data-side="før"\|"etter"` («…», `aria-hidden`), skjulte punkter ikke rendret eller `hidden` | |
| Agenda-/overgangsliste | `<ol data-testid="agendaliste">` i lysbildet; overgang: gjeldende `aria-current="step"`, tidligere `data-state="tidligere"` (dempet, lavere opasitet) | |
| Fremdrift | `role=progressbar` navn «Fremdrift», `aria-valuenow`, `aria-valuemax`; nummer `data-testid="lysbildenummer"` («7 / 12») | A5 |
| Kunngjøring | `data-testid="lysbilde-kunngjoring"`, `role=status` (`aria-live=polite`), tekst «Lysbilde 7 av 12: Leveranse B» | Agenda: «…: Agenda»; overgang: «…: ‹agendapunkt›» (Q-20) |
| Oversikt | `role=dialog` navn «Lysbildeoversikt»; hvert lysbilde `data-testid="oversikt-lysbilde"` (knapp), gjeldende `aria-current="true"`, roving fokus (piler/`hjkl`), `Enter`/klikk hopper | Fokus på gjeldende ved åpning |
| Svart skjerm | `data-testid="svart-skjerm"`, `background-color: rgb(0, 0, 0)` i alle temaer | Q-18 |
| Feilmelding | `role=status` med vim-stil kode (`E` + 3 sifre) og norsk tekst som nevner nivået, i paletten (som E475/E492) eller varselsonen | S4 |
| Avslutt med mus/touch | `role=button` «Avslutt presentasjon» | P6, Q-15 |
| Kanban på lysbildet | Som v1: `role=region` «Kanban: ‹view›», `section.lane`, `.lane-head .label`, `a.card` | `e2e/bases.spec.ts` |
| Kommandoer | Registeret: modus `present` i `catalogBindings()`; gruppe «Presentasjon»; palett: `:presenter`, `:presenter h<n>` (argument), `:agenda av` | P2, Q-16 |

## 7. Ytelse (AK-2-13)

Eget generert vault (rapport med 20 notatembeds med liste, kode og tabell + kanban med 30 oppgaver), egen server
(`E2E_PORT + 11`), 1920×1080. Måles i nettleseren fra `keydown` (capture) til nytt lysbilde er i DOM + to
animasjonsrammer (malt), som folding-perf. Start måles fra `Enter` i paletten (`:presenter`), så leader-sekvensen ikke er
med. «Etter at presentasjonen er bygget» = målingen av bytter starter etter at første lysbilde vises.

## 8. Spørsmål til PO (med forslag)

| # | Spørsmål | QA foreslår |
|---|---|---|
| Q-01 | Innhold mellom en agendaoverskrift og første lysbildeoverskrift (rapportens «Jobbes med nå»-innledning; «Tema A1» ved h4). S3 dekker bare seksjoner **uten** underoverskrifter. | Eget innholdslysbilde med agendapunktets navn som overskrift, først i punktet, og det teller i progresjonen. Alternativ: vis det på overgangslysbildet (da blir overgangen ikke «alltid lik»). Fasiten er skrevet med forslaget. |
| Q-02 | Teller «(forts.)»-lysbilder i progresjonen (`2/3`)? | Ja – progresjonen teller alle innholdslysbilder i punktet. Ellers står publikum på «2/3» i flere lysbilder. |
| Q-03 | Innholdslysbilder uten overskrift (S7, og S6 «eget lysbilde før agendaen»): hva står øverst? | Ingen overskrift og ingen agendalinje; kunngjøringen bruker notattittelen. |
| Q-04 | `:presenter h2` når brødteksten ikke har H1 (agendanivået ville vært H1 = notattittelen) | Gyldig: ingen agenda/overganger, lysbilder på H2. Har brødteksten H1-er, blir de agendapunkter. |
| Q-05 | Overskrifter **over** agendanivået (h4 i et notat med H2/H3/H4) | Blir ikke egne lysbilder; innhold rett under dem følger Q-01-regelen. Alternativ: vises som en egen overgang – men det gir to nivåer agenda, som spesifikasjonen ikke har. |
| Q-06 | Hvilket lysbilde er «nærmeste» når det gjeldende forsvinner ved live reload? | Forrige gjenværende i rekkefølgen (ikke hopp fram til innhold publikum ikke har sett); finnes ingen, første. |
| Q-07 | `Esc` «tilbake til samme sted i notatet»: stedet man startet, eller seksjonen til lysbildet man sto på? | Seksjonen til lysbildet man sto på (= startstedet hvis man ikke har navigert); tittellysbildet → toppen. Leselinjen (30 %, PO-53) legges på overskriften. |
| Q-08 | Typografi: hvor stor er brødteksten, og hva er «lesbart minimum»? Skal oppdeling i «(forts.)» avhenge av vindusstørrelsen? | Lerretet har en fast logisk størrelse (f.eks. 1600 × 900) som skaleres som helhet. Da blir oppdelingen identisk i alle vinduer, endres ikke ved resize, og fasiten er deterministisk. Brødtekst = høyde/27, minimum = høyde/45 (40/24 px ved 1080p). Ved 390 × 844 blir lerretet bare 219 px høyt. Det aksepteres, fordi letterbox er spesifisert og mobil ikke er projektor. UX bekrefter tallene. |
| Q-09 | `:agenda av` og reload: «gjeldende presentasjon»? | Reload = ny presentasjon, så overgangene kommer tilbake (lysbildet gjenopprettes via URL). |
| Q-10 | `Esc` i fullskjerm sluker nettleseren (den går ut av fullskjerm og sender ikke tasten til siden). Da virker ikke «Esc lukker oversikten først». | Chromium: `navigator.keyboard.lock(['Escape'])` i fullskjerm, så `Esc` når appen (langt trykk går ut). Safari/Firefox: når nettleseren går ut av fullskjerm, fortsetter presentasjonen i vinduet, og neste `Esc` følger tabellen. Manuell test på Mac. |
| Q-11 | Virker `⌘.`/`Ctrl .` og `⌘K` i present-modus? | `⌘.` ja (global). `⌘K` åpner paletten; åpner man et annet notat derfra, avsluttes presentasjonen. |
| Q-12 | Nettleserhistorikk: får hvert lysbilde en oppføring? | Nei: start = `pushState` (Tilbake avslutter presentasjonen), lysbildebytte = `replaceState`. |
| Q-13 | Lesevisningens tilstand (folding, diskré, bredde, zen) etter presentasjon | Urørt. Presentasjonen leser disposisjonen, men endrer ikke lesevisningen. |
| Q-14 | Er `***` og `___` også lysbildeskiller (S5 sier `---`)? | Ja, alle tematiske skiller (de er like i markdown). Testvaultet har `***`. |
| Q-15 | P6 (mus/touch): hvordan startes og avsluttes presentasjonen uten tastatur? | «Presenter» i Utseende (eller notat-headeren), og en dempet knapp «Avslutt presentasjon» som er synlig på touch og ved musebevegelse, som «Avslutt zen». Diskrete «forrige/neste»-knapper ved musebevegelse. |
| Q-16 | Hvor vises present-tastene i README og i normal-modusens `?`? | Egen gruppe «Presentasjon» i `?` i present-modus. README får en egen tabell mellom `<!-- hurtigtaster-present:start/end -->`, så TC-07-08 (radtelling i normal-tabellen) ikke brytes. I normal-modus vises bare `Space p`. |
| Q-17 | Statusmøtets kanban er en **inline** `base`-blokk (samme utvalg som `Oppgaver.base#Kanban`), ikke `![[Oppgaver.base#Kanban]]`, for ikke å endre tilbakelenke-fasiten (6) i `ak07-11-navigasjon.spec.ts`. Ønsker PO en ekte embed? | Ja, på sikt – kunden embedder baser. Krever at QA får endre 6 → 7 i `ak07-11` og README-QA §4. QA lager i så fall også et lysbilde med `![[Oppgaver.base#Kanban]]`. |
| Q-18 | Svart skjerm: helt svart i lys modus også? Hva gjør andre taster mens den er svart? | Helt svart (`#000`) i alle temaer. Navigasjon er ignorert mens skjermen er svart, og `Esc` slår den av før den avslutter. |
| Q-19 | Presentasjon av `.base`-sider og Canvas | Deaktivert med forklaring («Bare notater kan presenteres»), som diskré på `.base`. |
| Q-20 | Tekst i kunngjøringen for agenda og overgang | «Lysbilde 2 av 10: Agenda» og «Lysbilde 3 av 10: Siden sist». |
| Q-21 | En kort tekst og en blokk som er for stor alene på samme lysbilde (avsnitt + 120 linjer kode) | Del mellom blokkene: teksten på første del og blokken alene på «(forts.)» med minimumsskrift og rulling. Testvaultet unngår tilfellet til det er avgjort. |
| Q-22 | Lenker på lysbilder (wikilinks, kort i kanban) | Klikkbare. Lenke til et annet notat avslutter presentasjonen og åpner målet (Tilbake gir lesevisningen). |
| Q-23 | AK-2-13 «start < 500 ms»: median eller hver gang? | Median av 5 (som AK17), og maks rapporteres. |

## 9. Manuelt

- Fullskjerm og `Esc` i ekte Chrome, Safari og Firefox på Mac (Q-10); presentasjonsklikker (Logitech/Kensington) mot
  `PageDown`/`PageUp`/`b`/`.`/`F5`.
- Skjermdeling i Teams/Zoom (delt vindu uten fullskjerm) og ekstern skjerm/projektor, 1920 × 1080.
- VoiceOver: kunngjøring ved lysbildebytte, oversikten, agendalinjen (`aria-current`).
- PO/kunde: skjermbilder av statusmøtet (tittel, agenda, overgang, kanban, Mermaid) i lys/mørk × Tidsskrift/Terminal.
