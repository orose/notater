# v3 – Presentasjon i terminalen

Status: **Til godkjenning hos kunden**. Eier: PO. Bygger på v2 (presentasjonsmodus).

## Formål

Kunden vil kunne holde statusmøter direkte fra terminalen (Ghostty), f.eks. ved å dele terminalvinduet. Samme rapportnotater, samme lysbildelogikk som v2 – tegnet med tegn og ANSI-farger, med et tydelig, farget ASCII-hode.

## Beslutninger fra kunden

| # | Beslutning |
|---|---|
| T1 | **Kun presentasjon** i v3 (ingen terminal-leser for vanlig lesing/navigasjon mellom notater). |
| T2 | Primær terminal: **Ghostty** (truecolor, Kitty-grafikkprotokoll, Unicode). Skal degradere pent i andre terminaler. |
| T3 | **Mermaid som bilde** via Kitty-grafikkprotokoll der terminalen støtter det; ellers kildekode med syntaksfarger. |
| T4 | **Farger:** våre paletter (truecolor) som standard, med valg om å bruke terminalens egne farger (16-fargers ANSI). |
| T5 | **ASCII-hode** (figlet-stil, i aksentfarge) på tittel-, agenda- og overgangslysbilder – ikke på innholdslysbilder. |
| T6 | **Agendalinjen alltid synlig** øverst på innholdslysbilder, diskret, med gjeldende punkt uthevet og progresjon. |
| T7 | **Frittstående:** krever ikke at web-serveren kjører. Leser vaultet direkte. |

## Prinsipper (bindende)

- **P1 videreføres:** ingen presentasjonsdata i frontmatter; valg huskes eventuelt lokalt (ikke i vaultet).
- **Én lysbildemodell:** terminalen bruker **samme** indeks, rendering og lysbildemodell (S1–S8, agenda, overganger, `---`, `:presenter h<n>`, `:agenda av`) som v2. Logikk dupliseres ikke; den flyttes ved behov til delt kode.
- **Read-only:** terminalvarianten skriver aldri til vaultet.

## Funksjoner

### Start
- `npm run present -- "<notat>"` (navn, alias eller sti; fuzzy-treff). Uten argument: søkbar liste over notater.
- Flagg/konfig som web-leseren: `--vault`, `--config`, `--vault-id`. I tillegg `--niva h<n>`, `--palett <navn>`, `--farger terminal`, `--uten-agenda`.
- Start < 3 s for et vault med 2000 notater (indeksering inkludert).

### Lysbilder
- Samme rekkefølge og typer som v2: tittel → agenda → overgang → innhold, «(forts.)».
- **Tittel/agenda/overgang:** stort figlet-hode i aksentfarge (fallback til vanlig fet tekst hvis bredden ikke rekker), agenda som innholdsfortegnelse med prikkede ledere, «du er her»-markering.
- **Innhold:** overskrift (nummerert, f.eks. `02 /`), brødtekst med reflow til terminalbredden, lister, sitater, callouts (ramme + ikon/etikett), kode med Shiki-farger (ANSI truecolor), tabeller med rammetegn, Bases-tabell og kanban med rammetegn, bilder via Kitty-protokoll (ellers `[bilde: navn]`), Mermaid som bilde (T3), fotnoter nederst på lysbildet, lenker som OSC 8-hyperlenker der støttet.
- **Agendalinje** øverst (T6), avkortes til forrige · nåværende · neste ved plassmangel; skjult på tittel/agenda/overgang.
- **Statuslinje** nederst: notattittel, diskré tastehint, lysbildenummer `7/10`.

### Tilpasning
- Lysbildet tegnes for gjeldende kolonner × rader og tegnes på nytt ved endret vindus- eller skriftstørrelse.
- For mye innhold: del i «(forts.)» mellom blokker; en blokk som er for stor alene ruller internt (`↑`/`↓`) med hint.
- Minimum terminalstørrelse 80×24; mindre gir en tydelig melding i stedet for ødelagt tegning.

### Navigasjon (samme som v2 der det gir mening)
| Taster | Handling |
|---|---|
| `j` `→` `n` `Space` `PageDown` | Neste |
| `k` `←` `p` `PageUp` | Forrige |
| `gg` / `G` | Første / siste |
| `o` | Oversikt (liste/rutenett over lysbilder, `↵` hopper) |
| `b` / `.` | Svart skjerm |
| `↑` / `↓` | Rull en for stor blokk |
| `:` | Kommandolinje: `:presenter h<n>`, `:agenda av`, `:palett <navn>`, `:farger terminal`, `:q` |
| `?` | Hurtigtaster |
| `q` / `Esc` / `Ctrl c` | Avslutt (gjenoppretter terminalen) |

### Live
- Endringer i vaultet (Obsidian) oppdaterer presentasjonen; posisjonen beholdes via lysbilde-id (som v2).

### Terminalhygiene
- Alternativ skjermbuffer; markøren skjules; terminalen gjenopprettes alltid ved avslutning, også ved krasj/`Ctrl c`.
- Fungerer uten mus. Ingen nettverkskall ut (B10).

## Utenfor scope (v3)

Terminal-leser for vanlig lesing, presentatørvisning, PDF-eksport, skriving, Windows-terminaler.

## Akseptansekriterier

- **AK-3-01** `npm run present -- "<notat>"` starter presentasjonen; uten argument vises en søkbar notatliste. Frittstående (web-serveren kjører ikke).
- **AK-3-02** Lysbilderekkefølgen er identisk med v2 for alle notater i `test-vault/presentasjon/` (samme fasit, `docs/test/v2-fasit.json`).
- **AK-3-03** Figlet-hode i aksentfarge på tittel/agenda/overgang; fallback når bredden ikke rekker; ikke på innholdslysbilder.
- **AK-3-04** Agendalinjen vises på alle innholdslysbilder med riktig utheving og progresjon, og avkortes ved plassmangel.
- **AK-3-05** Kode, tabeller, callouts, Bases-tabell og kanban tegnes lesbart med farger og rammetegn ved 80×24, 120×36 og 200×50.
- **AK-3-06** Mermaid og bilder vises som grafikk i Ghostty (Kitty-protokoll) og som kildekode/plassholder ellers.
- **AK-3-07** For mye innhold deles i «(forts.)»; for stor blokk ruller internt; intet innhold kuttes usynlig; endret terminalstørrelse tegnes riktig på nytt.
- **AK-3-08** Alle taster i tabellen virker; `?` viser dem; `:`-kommandoene virker med vim-feilkoder (E475/E486) ved feil.
- **AK-3-09** Våre paletter i truecolor som standard; `--farger terminal`/`:farger terminal` bruker terminalens 16 farger. Lesbar kontrast i alle paletter (lys/mørk).
- **AK-3-10** Live endring av overskrift/kanbanstatus i vaultet oppdaterer presentasjonen uten å miste posisjonen.
- **AK-3-11** Terminalen gjenopprettes alltid ved avslutning (normal, `Ctrl c`, ukjent feil). Under 80×24 vises en melding.
- **AK-3-12** Start < 3 s med 2000-notatsvault; lysbildebytte < 50 ms.
- **AK-3-13** Full regresjon av v1, v1.1 og v2 er grønn.

## Leveranseplan (forslag)

| Slice | Innhold |
|---|---|
| 3-a | Delt kjerne: lysbildemodell og HAST tilgjengelig i Node uten DOM; CLI-oppstart, notatvalg, terminalhygiene, navigasjon |
| 3-b | Tegning: tekst-reflow, kode, tabeller, callouts, Bases/kanban, agendalinje, statuslinje, figlet-hode, paletter |
| 3-c | Tilpasning og «(forts.)», intern rulling, resize, oversikt, svart skjerm, `:`-kommandoer, live oppdatering |
| 3-d | Grafikk (Kitty-protokoll for Mermaid/bilder), QA og akseptanse |
