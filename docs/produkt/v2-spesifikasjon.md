# v2 – Presentasjonsmodus

Status: **Godkjent av kunden 2026-11-08**. Eier: PO. Bygger på v1 og v1.1.

## Formål

Kunden holder jevnlige statusmøter basert på rapportnotater (ofte satt sammen av embeds og baser). v2 lar et notat presenteres som lysbilder direkte fra leseren – i Teams/Zoom (skjermdeling) og på projektor/ekstern skjerm – uten å endre notatet og uten å bytte verktøy.

## Prinsipper (bindende)

- **P1 videreføres:** Ingen presentasjonsdata i frontmatter. Lysbilder utledes av notatets struktur (overskrifter, og `---` som vanlig markdown). Alle valg gjøres i leseren og huskes eventuelt i nettleseren.
- **P2 videreføres:** Alle nye handlinger registreres i kommandoregisteret (palett, `?`, README genereres).
- **P3 videreføres:** Presentasjon er en egen **modus** i tastaturmotoren (`present`) med egne bindinger. Reserverte taster (P4) og ⌥-forbud (P5) gjelder også her.
- **Live:** Presentasjonen bygges fra samme dokument som lesevisningen. Endringer i vaultet (live reload) slår gjennom under presentasjonen – inkludert agendaen og Bases-data.

## Struktur: fra notat til lysbilder

Eksempel:

```
# Statusmøte uke 45            → tittellysbilde
## Siden sist                  → agendapunkt
### Leveranse A                → lysbilde
### Leveranse B                → lysbilde
## Jobbes med nå               → agendapunkt
### Oppgaver (kanban-base)     → lysbilde (live)
## Relativt nær framtid        → agendapunkt
### Plan Q1                    → lysbilde
```

Rekkefølge: Tittel → Agenda → Overgang «Siden sist» → Leveranse A → Leveranse B → Overgang «Jobbes med nå» → Oppgaver → Overgang «Relativt nær framtid» → Plan Q1.

### Regler
- **S1 Overskrifter etter diskré-utflating:** Presentasjonen bygger på disposisjonen med **diskré embedding alltid på** (F2 fra v1.1): innebygde notaters titler og overskrifter teller som vanlige overskrifter.
- **S2 Agendanivå** = øverste overskriftsnivå i brødteksten (under notattittel), typisk H2.
- **S3 Lysbildenivå** = agendanivå + 1, typisk H3. En agendaseksjon uten underoverskrifter på lysbildenivå blir **ett** lysbilde.
- **S4 Valgfritt nivå:** `:presenter h<n>` setter lysbildenivået; agendanivået blir nærmeste nivå over. Valget huskes **per notat i nettleseren** (ikke i notatet). Ugyldig/tomt nivå gir forklarende melding (vim-stil feilkode + norsk tekst).
- **S5 `---`** (tematisk skille) deler et lysbilde i flere lysbilder innenfor samme agendapunkt. Første del beholder overskriften; påfølgende deler viser overskriften med «(forts.)».
- **S6 Innhold før første agendaoverskrift** (etter tittel) vises på tittellysbildet hvis det får plass, ellers som eget lysbilde før agendaen.
- **S7 Notat uten overskrifter:** tittellysbilde + innhold delt kun på `---` og automatisk overflyt (A2). Ingen agenda.
- **S8 Foldetilstand ignoreres** – alt presenteres.

## Lysbildetyper

- **L1 Tittellysbilde:** notattittel, ingress (`description`/`summary`, jf. PO-21), properties som i notat-headeren (respekterer skjulte properties), endringsdato. Agendalinje vises **ikke**.
- **L2 Agenda:** liste over alle agendapunkter. Vises rett etter tittellysbildet.
- **L3 Overgang:** agendaen med gjeldende punkt uthevet og tidligere punkter dempet («du er her»). Vises **alltid** før hver agendaseksjon. Kan slås av for gjeldende presentasjon med `:agenda av` (huskes ikke).
- **L4 Innhold:** overskrift + innhold for ett lysbilde.

## Agendalinjen

- Diskré linje øverst på alle **innholdslysbilder**: «Siden sist · **Jobbes med nå** · Relativt nær framtid», gjeldende punkt uthevet, med progresjon innen punktet (f.eks. `2/3`).
- Skjult på tittel-, agenda- og overgangslysbilder.
- Får den ikke plass: vis forrige · **nåværende** · neste med «…» før/etter.
- Oppdateres live når overskrifter endres.

## Layout og tilpasning

- **A1 Lerret:** 16:9-lerret skalert til vinduet (letterbox ved annet forhold). Typografi skalert opp for avstand/skjermdeling i alle typesett og paletter. WCAG AA i alle 24 kombinasjoner.
- **A2 For mye innhold:** skriftstørrelsen krympes ned til et definert lesbart minimum; får innholdet fortsatt ikke plass, fortsetter det på et nytt lysbilde merket «(forts.)». Splitting skjer **mellom blokker**, aldri inne i en kodeblokk, tabell, liste-element, Mermaid-diagram eller base. En enkelt blokk som er for stor alene, skaleres (diagram/bilde) eller får minimum skrift og intern rulling som siste utvei (kode/tabell).
- **A3 Bases** (tabell/kanban) og **Mermaid** tilpasses lerretet; kanban viser alle kolonner om mulig. Live data oppdateres under presentasjonen.
- **A4 Fotnoter** vises som små noter nederst på lysbildet de hører til.
- **A5 Fremdrift:** diskré fremdriftslinje nederst + lysbildenummer («7 / 12»).

## Navigasjon og kontroll (modus `present`)

| Taster | Handling |
|---|---|
| `Space p` / `:presenter` (normal-modus) | Start presentasjon fra seksjonen ved leseposisjon |
| `:presenter h<n>` | Start med valgt lysbildenivå (huskes per notat) |
| `j` `→` `n` `Space` `PageDown` | Neste lysbilde |
| `k` `←` `p` `PageUp` | Forrige lysbilde |
| `gg` / `G` | Første / siste lysbilde |
| `o` | Oversikt over alle lysbilder (rutenett, gjeldende uthevet; piltaster/`hjkl` + `↵` hopper) |
| `b` / `.` | Svart skjerm av/på |
| `:` | Kommandopalett (f.eks. `:agenda av`, `:tema`) |
| `?` | Hurtigtaster (viser present-modusens taster) |
| `Esc` | Lukk oversikt/palett; ellers avslutt presentasjon og gå til seksjonen for gjeldende lysbilde i notatet |
| `f` | Fullskjerm av/på |

- `Space`, `PageDown`/`PageUp` og `.`/`b` dekker vanlige presentasjonsklikkere.
- **Fullskjerm:** presentasjon starter nettleserens fullskjerm (når tillatt); avslutning går ut av fullskjerm. Fungerer også uten fullskjerm (f.eks. delt vindu i Teams).
- **URL:** gjeldende lysbilde står i URL-en, slik at reload/live reload holder posisjonen. Ved live reload beholdes lysbildet identifisert ved overskrift; forsvinner det, vises nærmeste.
- **Touch:** sveip/trykk venstre-høyre for forrige/neste (enkel støtte).
- **Overganger:** diskret toning; ingen ved `prefers-reduced-motion`.
- **Tilgjengelighet:** lysbildebytte annonseres for skjermleser («Lysbilde 7 av 12: Leveranse B»).

## Utenfor scope (v2)

Presentatørvisning, talernotater, PDF-eksport (senere), egen projektorpalett, laserpeker/tegning, skrivemodus.

## Akseptansekriterier

- **AK-2-01** `Space p` og `:presenter` starter presentasjon fra seksjonen ved leseposisjon; `Esc` avslutter tilbake til samme sted.
- **AK-2-02** Lysbilderekkefølgen følger S1–S7 for eksempelnotatet og for et rapportnotat bygget av embeds (fasit fra QA).
- **AK-2-03** `:presenter h<n>` endrer lysbildenivå, huskes per notat i nettleseren, og ingenting skrives til notatet.
- **AK-2-04** `---` deler lysbilder innen samme agendapunkt med «(forts.)».
- **AK-2-05** Tittel-, agenda- og overgangslysbilder vises som beskrevet; overganger alltid, `:agenda av` slår dem av for gjeldende presentasjon.
- **AK-2-06** Agendalinjen vises på alle innholdslysbilder med riktig utheving og progresjon, skjules på tittel/agenda/overgang, og avkortes til forrige·nåværende·neste ved plassmangel.
- **AK-2-07** Endring av en agendaoverskrift i vaultet under presentasjon oppdaterer agenda og agendalinje uten å miste posisjonen.
- **AK-2-08** For mye innhold: krymping til minimum, deretter «(forts.)»-lysbilder; ingen splitting inne i kode/tabell/diagram/base; ingen innhold kuttes usynlig.
- **AK-2-09** Bases (tabell/kanban) og Mermaid vises tilpasset lerretet; kanbanendringer i vaultet oppdateres live.
- **AK-2-10** Alle taster i tabellen virker; `?` viser present-modusens taster; reserverte/⌥-taster er ikke bundet (test mot registeret).
- **AK-2-11** Fullskjerm startes/avsluttes; reload beholder lysbildet via URL.
- **AK-2-12** 16:9-lerret uten horisontal sidescroll ved 1280×720, 1440×900, 1920×1080 og 390×844; WCAG AA i alle 24 temakombinasjoner (axe 0 brudd).
- **AK-2-13** Lysbildebytte < 100 ms (p95) etter at presentasjonen er bygget; start av presentasjon for et rapportnotat med 20 embeds < 500 ms.
- **AK-2-14** Full regresjon av v1 og v1.1 er grønn.

## Leveranseplan (forslag)

| Slice | Innhold |
|---|---|
| 2-a | Lysbildemodell (ren funksjon: disposisjon → lysbilder etter S1–S8), present-modus i tastaturmotoren, start/avslutt, navigasjon, URL, fullskjerm |
| 2-b | 16:9-lerret, typografiskala, automatisk tilpasning og «(forts.)», Bases/Mermaid/fotnoter |
| 2-c | Tittel-, agenda- og overgangslysbilder, agendalinjen, oversikt (`o`), svart skjerm, live oppdatering |
| 2-d | QA-regresjon og akseptanse |
