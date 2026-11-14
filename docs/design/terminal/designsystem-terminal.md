# Designsystem – terminalpresentasjon (v3)

Eier: UX/webdesign. Bindende grunnlag: `docs/produkt/v3-spesifikasjon.md` (T1–T7, AK-3-01–13), ADR-011
(terminalpresentasjon), AR-3-* og PO-107–109 i `docs/beslutninger.md`. Bygger på `../designsystem.md` §12 (v2).

**Kort fortalt:** Terminalen er samme særtrykk som v2, satt med tegn i stedet for typer. Kolumnetittelen blir en
vim-tabline, folioen blir statuslinjens `7/10`, booktabs blir tunge og lette streker, og «du er her» blir vims
cursorline. Mermaid og kanban vises bare som en stille plassholder (T3). Alt er tegnet for et delt Ghostty-vindu i
Teams/Zoom: få, tydelige flater, massive figlet-piksler, ingen hårstreker som bærer mening og ingen farge som står
alene.

## Filer i `docs/design/terminal/`

| Fil | Hva |
|---|---|
| `designsystem-terminal.md` | Dette dokumentet: alle regler for terminalen |
| `farger.json` | **Kanonisk** fargekilde for terminalen: roller per palett × modus (truecolor) og ANSI-16-kart. Generert, ikke rediger for hånd. |
| `lag-farger.mjs` | `node docs/design/terminal/lag-farger.mjs` lager `farger.json` fra `../tokens.css` |
| `kontrast-terminal.mjs` | `node docs/design/terminal/kontrast-terminal.mjs [--json]`: WCAG-kontroll av alle truecolor-par, exit 1 ved brudd |
| `figlet/vr-blokk.flf`, `figlet/vr-smal.flf` | Figlet-fontene (ADR-011 §5), standard FIGlet-format. Kopieres til `src/terminal/features/figlet/fonts/`. |
| `lag-figlet.py` | `python3 docs/design/terminal/lag-figlet.py`: fontene som punktgrafikk, så `.flf` |
| `lag-mockups.py` | Designreferanse: en lesbar implementasjon av reglene i dette dokumentet. Skriver `mockups/*.ans`. |
| `mockups/*.ans` | ANSI-mockups (truecolor eller 16 farger, OSC 8). Vis i Ghostty med `cat`, i et vindu med samme størrelse som i filnavnet. |
| `ans-til-html.mjs` | `node docs/design/terminal/ans-til-html.mjs [prefiks …]`: `.ans` → HTML → PNG i `../skjermbilder/v3/` (Playwright, JetBrains Mono fra `node_modules`) |

Filnavn: `NN-innhold-<kol>x<rader>-<palett>-<lys|mork>.ans`. Alle skjermbilder er tatt i **samme vindusbredde
(1440 px)**, slik et delt vindu ser ut. 80 kolonner gir derfor stor skrift og 200 kolonner liten (se §1.4).

---

## 1. Rutenett og marger

Terminalen har bare én skriftstørrelse. Hierarki lages med **posisjon, luft, vekt (fet), form (tegn) og en sparsom
aksent**, aldri med små tekster.

### 1.1 Kolonner

| Regel | Verdi |
|---|---|
| Marg (venstre = høyre) | `max(4, round(kol × 0,067))`, samme 6,7 % som v2-lerretet |
| Sats (innholdsbredde) | `kol − 2 × marg`, men **maks 160**. Bredere terminal: satsen sentreres og margen vokser. |
| **Målbredde** (brødtekst, lister, sitater, callouts, plassholdere, ingress) | `min(sats, 72)` tegn |
| Figurer (kode, tabell, Bases) | Kode bruker hele satsen. Tabeller har naturlig bredde (maks satsen). |
| Hengende elementer | Listemarkøren `–` og rammen i callouts og plassholdere står **2 kolonner ut i margen**, så teksten flukter med satsens venstrekant |
| Marginalia (§4.8) | Når `sats − mål − 6 ≥ 34`: fotnoter i høyre spalte, 6 kolonner etter målbredden, maks 48 bred |

| Terminal | Marg | Sats | Mål | Merknad |
|---|---|---|---|---|
| **80 × 24** | 5 | 70 | 70 | Minimum. Statuslinjen viser bare `? hjelp`. |
| **120 × 36** | 8 | 104 | 72 | **Anbefalt presentasjonsstørrelse** (≈ 1:1 med v2s 1920-lerret i lesbarhet) |
| **200 × 50** | 20 | 160 (sentrert) | 72 | Fotnoter som marginalia. Oversikten får forhåndsvisning. |

Satsen er venstrejustert i margen (som v2-lerretet), ikke midtstilt per linje. Midtstilling brukes bare til meldingen
«for liten» (§5.7) og flytevinduer.

### 1.2 Rader

| Sone | Rad(er) |
|---|---|
| Agendalinje (tabline) | rad 0, kant i kant (bare innholdslysbilder) |
| Luft over | `luft = ⌊(rader − 24) / 12⌋` → 0 / 1 / 2 ved 24 / 36 / 50 |
| Topp (første innholdsrad) | `2 + luft` (rad 2, 3 eller 4) |
| Bunn (siste rad innhold kan bruke) | `rader − 3 − ⌊(rader − 24) / 24⌋` (21 / 32 / 46) |
| Statuslinje | siste rad, kant i kant |

Innholdslysbilde: `02 /` på toppraden, tittelen under, én tom rad, kroppen, (fotnoter), luft, statuslinje.
Tilgjengelige rader for kroppen er `bunn − topp − 2` (17 / 28 / 40).

Tittelsiden står **optisk midtstilt**: start = `max(topp, round((rader − blokkhøyde) × 0,38))`. Agenda og overgang er
topptilpasset (samme plass som lysbildetitler, som i v2).

### 1.3 Ingen tekst krymper, bare luften

ADR-011 lar UX velge tetthetstrinn. **Beslutning: `TERMINAL_FIT_STEPS = [1]`**, altså bare deling og ingen tett
modus. Begrunnelse:

- Den tomme raden mellom blokker er det eneste typografiske virkemiddelet terminalen har for gruppering. Uten den
  flyter avsnitt, liste og tabell sammen, særlig i komprimert video der skillene allerede er svakere.
- En tett variant ville gi to visuelle «typesett» som veksler fra lysbilde til lysbilde, avhengig av mengde. v2
  krymper hele kroppen jevnt. Her ville bare noen lysbilder miste luften, og det ser ut som en feil.
- Deling er billig og ærlig: «(forts.)», progresjonen `2/3` i agendalinjen og enkeregelen (§2.6) gjør den lesbar.
- Listepunkter og avsnittslinjer har allerede ingen tomme rader *innenfor* blokken, så `0.5` ville bare fjerne
  luften *mellom* blokker.

### 1.4 Video og skriftstørrelse

Et delt Ghostty-vindu i Teams/Zoom komprimeres og vises ofte i 720p. Lesbarheten avhenger av **piksler per celle**,
ikke av kolonnetallet.

- Anbefaling til presentatøren: 100–130 kolonner i vinduet som deles (`Ctrl +`/`Ctrl -` i Ghostty). Ved 120 × 36 i
  et 1920-vindu er cellen ≈ 16 × 30 px. Det tilsvarer v2s minstegrad (24 lp).
- Ved bredde > 160 kolonner viser **tittelsidens statuslinje** et hint: «200 × 50: **Ctrl +** gir større tekst i
  Teams og Zoom» (`60-01`). Hintet står bare på tittelsiden, så publikum ikke ser det midt i møtet.
- **Fet** for alt som må leses på avstand: titler, agendapunkter, tastene i hint, tall i folioen og etiketter.
- **Farge bærer aldri små ting alene** (krominans halveres i video): gjeldende agendapunkt er fet og tekstfarget, med
  aksentstrek under. Status i tabeller har form (`● ◐ ○`). Feil har koden `E475` i tekst.
- **Ingen informasjon i hårstreker.** Lette streker (`─ │ ╌ ┆`) er bare dekor eller rammer. Der en strek skal sees
  (tabellens topp og bunn, ferdig fremdrift), brukes tunge streker (`━`). Ghostty tegner streker med minst 1 px, men
  1 px forsvinner i 720p.
- Figlet-hodet er massive halvblokker uten skygge (§3): ingen tynne skyggestreker som flimrer.
- Ingen blink, ingen animasjon, ingen mønstre (prikkede ledere har minst én tom celle mellom prikkene).

---

## 2. Lysbildetypene og kromet

Samme rekkefølge og modell som v2 (tittel → agenda → overgang → innhold → «(forts.)»). Referanse ved 120 × 36:
`01-` til `10-`.

### 2.1 Tittel (`01-`, `30-`, `36-`, `50-01`, `60-01`)

1. Sti: `~/` i fet aksent, så `rapporter / statusmøter` dempet.
2. **Figlet-hode** av notattittelen i `hode` (§3). Kjeden velger font og antall linjer.
3. Ingress i *kursiv*, dempet, i målbredde.
4. Innhold før første agendapunkt (S6) som vanlig brødtekst, med lenker.
5. Egenskaper som nøkkel/verdi: en loddrett strek `│` i `dekor` i margen, nøkkel dempet (fast bredde), verdi i
   tekstfarge. Lenker og status (`◐ i rute` i kulør) som i leseren. Skjulte felt følger leseren. Ingen tagger
   (PO-90). Egenskapene droppes hvis de ikke får plass (80 × 24 med lang ingress).
6. «Endret 6. nov. 2026, 14.20» dempet.
7. **Ingen agendalinje, folio eller fremdrift** (PO-95). Statuslinjen viser bare starthintet: **Presentasjon** til
   venstre og `→ neste · o oversikt · ? taster · q avslutt` til høyre.

### 2.2 Agenda (`02-`, `50-02`, `60-02`)

- Overlinje (dempet): «Statusmøte uke 45 · 3 punkter».
- Figlet-hode «AGENDA» (alltid samme ord, aldri oversatt).
- Kolonneetikett «lysbilde» dempet over tallkolonnen.
- Hvert punkt: `01` i fet aksent · navn i fet tekstfarge · prikkede ledere `·` i `dekor` (annenhver celle, justert
  til samme kolonneparitet på alle rader, så prikkene står i kolonner) · lysbildenummeret der seksjonen starter, dempet
  og høyrejustert. Listen er `mål + 8` bred.
- Én tom rad mellom punktene når rader ≥ 30. Ved 24 rader er det ingen tom rad.

### 2.3 Overgang med «du er her» (`03-`, `07-`, `09-`, `32-`, `40-`, `50-11`, `60-03`)

Samme side som agendaen. Bare tre ting er endret:

1. Overlinjen sier `02 / 03` i fet aksent og «du er her» dempet.
2. Figlet-hodet er **seksjonens navn** («JOBBES MED NÅ»), ikke «AGENDA». Seksjonsnavnet er det publikum skal huske.
   Agendalisten under viser hvor i møtet vi er.
3. Agendalisten har tre tilstander:

| Tilstand | Tegning |
|---|---|
| tidligere | nummer og navn dempet, ikke fet |
| **gjeldende** | **invertert rad** (vims cursorline): `invertert_tekst` på `invertert_bg` fra 2 kolonner i margen til 2 kolonner etter tallet. Fet nummer, navn og lysbildetall. Under: lysbildene i seksjonen som tre (`├── `, `└── ` i `dekor`, titler dempet, uten «(forts.)»). |
| kommende | som på agendaen (fet tekst, nummer i aksent) |

Formen (invertering og tre) bærer tilstanden, ikke fargen (WCAG 1.4.1). I ansi16 er inverteringen SGR 7.

### 2.4 Innhold (`04-`, `05-`, `08-`, `10-`)

- Toppraden: `02 /` i fet aksent (agendapunktets nummer, to sifre). Uten agendapunkt (S7) er det ingen nummerlinje.
- Tittelen i **fet tekstfarge**, brutt ved `sats − 12`, etterfulgt av en **tittelstrek** `─` i `dekor` ut til satsens
  høyre kant. Streken gir tittelen tyngde uten større skrift og markerer hvor innholdet starter.
- «(forts.)» står dempet og ikke fet etter tittelen, før streken (`06-`).
- Én tom rad, deretter kroppen.
- Aldri figlet på innholdslysbilder (T5).

### 2.5 Agendalinjen = vim-tabline (`04-`–`10-`)

```
 1 Siden sist │ 2 Jobbes med nå 1/1 │ 3 Relativt nær framtid
```

- Rad 0 over hele bredden på `linje_bg` (vims `TabLineFill`). Teksten starter ved `marg − 1`, så første fane
  flukter med satsen.
- Andre punkter: ` n Navn ` i dempet. Skillet `│` i `dekor`.
- **Gjeldende punkt** (`TabLineSel`): fanen får **lerretets bakgrunn** (den «henger sammen» med siden under), nummer i
  fet aksent, navn fet i tekstfarge med **understrek i aksent** (SGR 4 + 58), og progresjonen `2/3` dempet rett etter
  navnet.
- **Avkorting** (Q-3-02), første som får plass i satsen:
  1. alle punkter
  2. forrige · **nåværende** · neste, med ` … ` foran og/eller bak når noe er skjult
  3. som 2, med naboene forkortet til 14 tegn med `…`
  4. naboene forkortet til 8 tegn og nåværende til ⅓ av satsen
  5. bare nåværende, forkortet til `sats − 16`
  Progresjonen vises alltid. `…` er aldri uthevet.
- Skjult på tittel, agenda og overgang, og på lysbilder uten agendapunkt.

### 2.6 Deling, «(forts.)» og rulling (A2, samme `fitDraft`/`packUnits`)

1. Tetthetstrinn `[1]` (§1.3): én tom rad mellom blokker, alltid.
2. Får blokkene ikke plass, deles det **mellom blokker** til «(forts.)». Fotnoter følger delen der henvisningen står.
3. **Foreldreløs-regel** (PO-93): en blokk som er for høy *også alene* (`overflow: scroll`) blir stående på lysbildet
   og ruller internt. To rullende blokker deler aldri lysbilde.
4. **Enkeregel (ny):** blir den siste delen lavere enn ¼ av tilgjengelig høyde, flyttes blokken foran over til den,
   men bare hvis delen foran fortsatt er minst ¼ og begge delene får plass. Uten regelen ble «Outbox-mønsteret
   (forts.)» ett ensomt avsnitt (se §11, spørsmål 3).
5. Mermaid, kanban og bilder er plassholdere med fast høyde og deles eller rulles aldri.
6. Lysbildeantallet avhenger av størrelsen. Statusmøtet har 12 lysbilder ved 80 × 24, 10 ved 120 × 36 og 9 ved
   200 × 50 (= v2-modellen). Det samsvarer med QAs fasit (eksakt ved 200 × 50, «modulo forts.» under).

### 2.7 Statuslinjen = vim-statusline (alle unntatt tittel)

```
 Statusmøte uke 45            j k blar · o oversikt · : kommando · ? hjelp   ━━━ ━━━━ ━─ ──   7/10
```

- Siste rad over hele bredden på `linje_bg` (vims `StatusLine`), innholdet innenfor satsen.
- Venstre: notattittelen, dempet.
- Høyre, i denne rekkefølgen:
  - **Tastehint**: tast fet i tekstfarge, forklaring dempet, skilt med ` · `. Ved sats ≥ 100 vises
    `j k blar · o oversikt · : kommando · ? hjelp`, ellers bare `? hjelp`. Hintet droppes før noe annet hvis plassen
    tar slutt.
  - **Fremdrift**: ett tegn per lysbilde, `━` (fet strek, `fremdrift`) for lysbilder til og med gjeldende og `─`
    (`fremdrift_spor`, dekor) for resten. Ett mellomrom mellom seksjoner (tittel og agenda er første gruppe). Form, ikke
    bare farge, skiller ferdig fra gjenstående.
  - **Folio** `7/10` sist på raden og høyrejustert mot satsen: gjeldende tall fet i tekstfarge, `/10` dempet.
- I modus (oversikt) står et merke helt til venstre: ` OVERSIKT ` fet, `invertert_tekst` på `aksent` (som vims modus).
- Kommandolinjen erstatter statuslinjen (som `cmdheight=0`, §5.3).

---

## 3. Figlet-hodet (T5, ADR-011 §5)

### 3.1 Fontene

Egne fonter i FIGlet-format, tegnet som punktgrafikk av UX (`lag-figlet.py`). Prosjektet eier lisensen. Hver
tekstrad bærer **to kvadratiske piksler** i høyden med halvblokkene `▀ ▄ █`.

| Font | Piksler | Rader | Versalhøyde | Bredde per tegn | «STATUSMØTE UKE 45» |
|---|---|---|---|---|---|
| `vr-blokk` | 8 | 4 | 7 px (rad 1–7) | 6 kolonner (5 + 1 luft), I/1 4, M/W 6, Æ 8 | 99 kolonner |
| `vr-smal` | 6 | 3 | 5 px (rad 1–5) | 4 kolonner (3 + 1 luft), M/W/Æ 6, N/Ø 5 | 68 kolonner |

- Pikselrad 0 er luft over versalhøyden. Bare Å bruker den, til ringen.
- **Ingen skygge.** Massive blokker er det som overlever 4:2:0-komprimering best. ANSI Shadow-varianten jeg prøvde
  først hadde dobbeltstreker som flimret og ble støy ved 720p. Den hadde dessuten uklar lisens, og ADR-011 valgte egne
  fonter.
- **ÆØÅ:** Æ deler stammen mellom A og E. **Ø** er O med en diagonal på tre piksler, mens **0 er smalere (4 px) og
  uten strek**, så de aldri forveksles. Det skjedde med ANSI Shadow, som har skråstrek-null. I `vr-smal` har Ø fire
  kolonner med diagonal og O tre. **Å** har ringen i pikselrad 0–2 og en kortere A under i `vr-blokk`, og en prikk over
  en flat A i `vr-smal`.
- Glyfsett: A–Z, ÆØÅ, 0–9, mellomrom og `. , : ; ! ? - – / & ( ) ' " # % +`. Små bokstaver er kopier av versalene.
  Tegn med bredde 0 i fila = mangler. `Ä Ö Ü ä ö ü ß` står tomme fordi leseren fjerner aksenter (NFD) først (ADR).
- `.flf`-formatet: `flf2a$ <h> <h> <maks> -1 4 0 0 7`, «full width», endemerke `@`/`@@`, kodemerkede tegn for
  `Æ Ø Å æ ø å –` etter de påkrevde tegnene. `lag-mockups.py` inneholder en leser på 30 linjer som bekrefter formatet.

### 3.2 Fallback-kjeden (AR-3-20)

Bredde = satsen. Høyde ≤ ⅓ av radene (og det plassen på siden tillater).

1. `vr-blokk` på én linje
2. `vr-blokk` brutt mellom ord, ≤ 2 linjer (≤ 3 på tittelsiden ved ≥ 36 rader). Én tom rad mellom linjene.
3. `vr-smal` ≤ 2 linjer
4. **Fet tekst** i `aksent`, brutt mellom ord (hardt i ord som er lengre enn satsen), med en tung strek `━` i `aksent`
   under, like bred som den lengste linjen (maks satsen).

Ord brytes aldri inne i figlet. Mangler fonten et tegn (emoji, CJK), hopper kjeden rett til trinn 4 for **hele**
hodet, aldri blandet.

| Hode | 80 × 24 | 120 × 36 | 200 × 50 |
|---|---|---|---|
| Statusmøte uke 45 (tittel) | `vr-smal`, 1 linje (`vr-blokk` på 2 linjer = 9 rader > 8) | `vr-blokk`, 1 linje | `vr-blokk`, 1 linje |
| Agenda | `vr-blokk` | `vr-blokk` | `vr-blokk` |
| Relativt nær framtid | `vr-blokk`, 2 linjer | `vr-blokk`, 1 linje | `vr-blokk`, 1 linje |
| Donaudampf…gesellschaft (80 tegn) | fet tekst, brutt hardt | fet tekst | fet tekst |

### 3.3 Farger

Tegn i `█ ▀ ▄ ▌ ▐` får `hode` (= aksent, ≥ 4,5 mot bg i alle paletter). Andre tegn får `hode_skygge`. Rollen finnes
for fremtidige fonter, men `vr-blokk` og `vr-smal` bruker den ikke.

---

## 4. Tegning av innhold

### 4.1 Brødtekst og inline

- Reflow i målbredde. Bryting skjer på mellomrom. Et «ord» er alt mellom to mellomrom, **på tvers av stiler**, så
  `` (`pg_advisory_lock`). `` aldri skilles fra parentesen. NBSP bryter ikke. Ord lengre enn linjen deles hardt
  mellom grafemer, uten bindestrek.
- **Fet** SGR 1 · *kursiv* SGR 3 · ~~gjennomstreket~~ SGR 9 · `==markering==` på `treff_bg`.
- **Inline-kode:** tekstfarge på `flate_bg` (= `linje_bg`), uten luft rundt. `kode_bg` ligger for nær lerretet i mørke
  paletter (Fosfor mørk `#070806` mot `#0b0d0a`) og ble usynlig. I ansi16: `kode.string`, uten bakgrunn.
- Tagger: `#tagg` i `aksent2`.

### 4.2 Lister og sitater

- Punkt: `–` dempet, **hengende i margen** (2 kolonner til venstre for satsen), teksten flukter med brødteksten.
  Nummerert: `1.` høyrejustert i samme marg. Nivå 2: 4 kolonner inn, markør `·`. Oppgaver: `☐` / `☒`.
- Ingen tomme rader mellom punkter.
- Sitat: `▎` i `aksent2` i satsens kolonne 0, teksten *kursiv* 3 kolonner inn, kilde `– ADR-016` dempet på egen linje.
  (ADR-011 foreslo `│ ` i `strek`. `▎` er tydeligere i video, se §8.)

### 4.3 Callouts (ramme og etikett)

```
╭─ ? Spørsmål ───────────────────────────────────────────────────────────╮
  Hvor lenge beholder vi ordrehistorikk?                     (fet tekst)
  Juridisk anbefaler fem år …                                (tekst)
╰────────────────────────────────────────────────────────────────────────╯
```

- **Runde hjørner** `╭╮╰╯` og `─ │` i typens kulør. Rammen henger 2 kolonner i margen, så innholdet flukter med
  brødteksten. Bredde = mål + 4.
- Etiketten står **i toppstreken**: ` tegn Navn ` fet i kulør. Callout-tittelen er første linje inni, fet i
  tekstfarge. Innholdet er reflowet. Ingen bakgrunnsfarge: rammen bærer kuløren, og tint ville gi en flekk i video.
- Kulør, tegn og etikett (tegn med bredde 1, ingen emoji):

| Type | Kulør | Tegn | Etikett |
|---|---|---|---|
| note, info | blue | `i` | Merk, Info |
| todo | blue | `☐` | Gjøremål |
| tip, abstract | teal | `*`, `≡` | Tips, Sammendrag |
| success | green | `✓` | Ferdig |
| question | amber | `?` | Spørsmål |
| warning | orange | `!` | Advarsel |
| danger, bug | red | `‼`, `✗` | Fare, Feil |
| example | plum | `≡` | Eksempel |
| quote | grey | `”` | Sitat |

  Egen tittel i Obsidian (`> [!warning] Advarsel med æøå`) erstatter etiketten. Foldet callout: bare toppstreken med
  `▸` etter etiketten.

### 4.4 Kode (`04-`, `10-`, `28-`)

- Flate på `kode_bg` i **hele satsens bredde**, uten ramme.
- Hode (rad 1): `●` i aksent, filnavn eller tittel fet, språk dempet høyrejustert. Rad 2: `╌` i `dekor` (stiplet
  skille). Deretter én kodelinje per rad.
- Linjenumre dempet og høyrejustert i en renne på `len(antall linjer)` kolonner + 2 mellomrom.
- Fargene kommer fra Shiki-HAST: `var(--shiki-token-X)` blir `kode.X`, og kommentarer er i kursiv.
- **Lange linjer** brytes mykt på mellomrom innenfor flaten, med `↪` i rennen (dempet) på fortsettelseslinjene
  (vims `showbreak`). Ingenting kuttes (Q-3-04).
- Tab = 4 mellomrom.

### 4.5 Rullehint for for store blokker (`10-`, `28-`, `50-12`)

- Blokken fyller resten av lysbildet. Siste rad i flaten er **hintlinjen**: `↓ 34 linjer til` fet i tekstfarge,
  ` · ↑ ↓ ruller` dempet og `15–32 av 52` dempet høyrejustert. Ved slutten: `Slutt · 52 linjer`.
- **Rullefelt** i flatens høyre kolonne: spor `│` i `dekor`, tommel `┃` dempet, med høyde proporsjonal med andelen
  som vises.
- Hintet er synlig for publikum (PO-97).
- Gjelder kode, tabell, Bases, callout og sitat (`overflow: scroll`). Plassholdere ruller aldri.

### 4.6 Tabeller: booktabs med tunge og lette streker (`06-`, `08-`, `33-`)

**Valg av tegnsett:** ingen loddrette streker, som booktabs i leseren og v2. Det er det som gjør at tabellen ser
*utgitt* ut og ikke ut som et regneark i en TUI.

```
Målinger i staging¹                       ← tittel/caption: kursiv, dempet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ← toppstrek: tung, `strek`
Måling                       Før   Etter  ← hode: fet, dempet
───────────────────────────────────────   ← midtstrek: lett, `strek`
Ordre per minutt, p95      1 900   2 400  ← celler: tekstfarge, tall høyrejustert
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ← bunnstrek: tung
```

- Kolonneavstand 3. Tabellen har naturlig bredde, og strekene er nøyaktig like brede som tabellen.
- Justering fra `align`. Tall og datoer høyrejustert.
- **For bred tabell**, trinn for trinn (AR-3-15):
  1. avstand 3 → 2
  2. avstand 1 med lett `│` i `dekor` mellom kolonnene (smal avstand trenger et synlig skille)
  3. krymp de bredeste tekstkolonnene proporsjonalt ned mot minimum (lengste ord, maks 12, min 6) og bryt
     celletekst
  4. **kortvisning**: hver rad som en blokk med `Kolonne  verdi` (nøkkel dempet, fast bredde), adskilt av en lett strek
     `─` i `dekor`. Horisontal overflyt deler aldri et lysbilde.
- Tom celle: tom. Bases «ikke satt»: *kursiv*, dempet.

### 4.7 Bases-tabell (`08-`, `33-`, `41-`, `50-09`)

- Hode over tabellen: `Tjenester.base` fet · ` › ` dempet · view-navnet *kursiv* · `·  6 tjenester` dempet og
  `● live` til høyre (`●` i `ok`, «live» dempet), høyrejustert mot tabellens høyre kant. Har basen flere views, står
  en fanelinje under hodet med samme form som agendalinjen (§2.5), og første view er valgt.
- Én tom rad, så tabellen som §4.6. Er hodet bredere enn tabellen, går overskuddet til første kolonne, så strekene
  alltid følger innholdet.
- Status har både form og farge: `● done` (`ok`), `◐ doing` (kulør amber), `○ todo` (dempet).
- Filnavn er lenker (§4.9). Datoer `dd.MM.yyyy`, avkrysning `✓`/`–`.
- Live: ved endring står «oppdatert 14.02» i stedet for «live» i 10 s. Det tilsvarer `--hint-linger` i v2. Det er
  ingen glød.

### 4.8 Fotnoter

- Henvisning: hevet siffer `¹ ²` i fet aksent (bredde 1).
- Nederst (sats < mål + 40): en kort strek `────────` (8) i `dekor` på raden over, og noter på `¹ tekst` dempet, med
  hengende innrykk på 2 og reflow i målbredde. Blokken står kant i kant med bunnraden.
- **Marginalia** (200 × 50, `60-05`): noten står i høyre spalte, ved siden av blokken med henvisningen, med `│` i
  `dekor` foran og sifferet i aksent. Det er samme idé som marginalia i leseren. Marginalia tar ingen høyde fra
  lysbildet.

### 4.9 Lenker (OSC 8)

- Intern lenke (wikilenke): `lenke` med understrek (SGR 4, understrekfarge 58 = `lenke`). **OSC 8 til
  `obsidian://open?vault=<vault>&file=<sti uten .md, URL-kodet>`** (PO-109), så Cmd-klikk i Ghostty åpner notatet i
  Obsidian.
- Brutt lenke: `lenke_brutt` med **prikket understrek** (SGR 4:4). Fallback er vanlig understrek. Ingen OSC 8.
- Ekstern lenke: som intern, med OSC 8 til URL-en. Teksten vises som skrevet. En lang URL brytes hardt, og OSC 8 dekker
  alle delene.
- Uten OSC 8-støtte: samme utseende, uten mål.

### 4.10 Plassholdere (T3, `05-`, `08-`)

```
┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
┆ Mermaid-diagram – vises i web-leseren            ┆   ← fet, dempet (fast tekst)
┆ flowchart LR · 7 noder · «Ordre-API → … Kafka»   ┆   ← valgfri detaljlinje, dempet
└╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
```

- **Stiplet ramme** (`┌ ┐ └ ┘ ╌ ┆`) i `strek`, mål + 4 bred, hengende 2 kolonner i margen. Alltid 3 eller 4 rader.
  Stiplingen sier «her er noe som ikke vises». Det er den eneste stiplede rammen i systemet.
- Tekst nøyaktig som spesifikasjonen: «Mermaid-diagram – vises i web-leseren», «Kanban: ‹view› – vises i web-leseren».
- Detaljlinje (valgfri, §11 spørsmål 1): Mermaid gir diagramtype og antall noder. Kanban gir base og antall kort per
  kolonne. Aldri kortenes titler, og aldri Mermaid-kilden (QA sjekker dette).
- Bilde: én linje `[bilde: navn.png]` dempet, med alt-tekst eller bildetekst etter to mellomrom i *kursiv* dempet. Ingen
  ramme, for bilder er ofte inline.

### 4.11 Særtegn og bredde (AR-3-13)

- Bredde per grafemklynge. Emoji, ZWJ og flagg = 2, CJK = 2, kombinerende = 0, rammetegn og blokktegn = 1.
- **Alle tegn i systemets eget krom har bredde 1** og er valgt fra JetBrains Mono, som Ghostty bruker som
  standardfont: `─━│┃┌┐└┘├└╭╮╰╯╌┆▀▄█▌▐▎●◐○·…›→↑↓↵↪✓✗‼≡”☐☒¹²³`. Ingen emoji i kromet.
- Et bredt tegn som ikke får plass i siste kolonne, går til neste linje. Det deles aldri.

---

## 5. Overlegg og tilstander

### 5.1 Oversikt `o` (`20-`, `61-`)

En **liste**, ikke et rutenett av miniatyrer. Terminalen kan ikke skalere et lysbilde, og en innholdsfortegnelse er
mer nyttig i et møte («vi hopper til 9»).

- Overskrift «Oversikt» fet og «10 lysbilder · 3 punkter» dempet.
- Rader: nummer høyrejustert i fet aksent. Tittel og agenda fet. Overgang som `01  Siden sist` fet. Innhold med `│`
  i `dekor` og 4 kolonner innrykk, med «(forts.)» der det hører hjemme. Høyre side: hva lysbildet inneholder
  (`kode · tabell · plassholder`), dempet. Tom rad før hver seksjon (rader ≥ 30).
- **Nå**: merket ` NÅ ` (fet, `invertert_tekst` på `aksent`) etter tittelen.
- **Markør**: hele raden på `markor_bg` og **ensfarget** i `markor_tekst` (sti, type og nummer er da også tekstfarget,
  fordi dempet mot `markor_bg` gir under 4,5). Halvblokk `▌` i `fokus` i margen. Nå og markør kan sees samtidig.
- **Forhåndsvisning** når det er minst 60 kolonner ledig til høyre for listen (200 × 50): flytevindu
  «Forhåndsvisning · lysbilde 7» med **det ekte lysbildet** (samme deling og nummer) lagt ut i rutens bredde, uten
  agendalinje og statuslinje, og klippet nederst. Ruten pagineres aldri på nytt, for da ville tallene vært feil.
- Taster: `j`/`k`/piler, `gg`/`G`, `↵` hopper, `Esc`/`o` lukker. Statuslinjen har merket ` OVERSIKT ` og hintet
  `j k flytter · ↵ hopper · Esc lukker`.

### 5.2 Svart skjerm `b` / `.` (`25-`)

Alle celler `#000000` i truecolor. I ansi16: SGR 40 (indeks 0). Markøren er skjult, og ingenting annet vises. Bare
`b`, `.` og `Esc` slår av. Andre taster ignoreres.

### 5.3 Kommandolinjen `:` (`22-`, `23-`, `24-`)

- **Erstatter statuslinjen** (vims `cmdheight=0`): `:` i fet aksent i margen (`marg − 1`), teksten i tekstfarge og en
  **statisk** blokkmarkør (cellen invertert, ingen blink). Lysbildet over står urørt.
- **Fullføring** (wildmenu) mens man skriver: flytevindu (§5.4) rett over linjen, ved `:`. Tittelen er «Kommandoer»
  og «Tab» står til høyre. Rader `palett   fosfor, signal, papir, cyanotypi`, med kommando fet og argumenthint
  dempet. Valgt rad står på `markor_bg`.
- **Feil** (E475/E486/E492), vim-stil på to rader nederst. Over dem ligger en lett strek `─` i `dekor` over hele
  bredden. Raden ovenfor viser **`E475:`** fet i `feil` og kortmeldingen i tekstfarge. Nederste rad viser
  forklaringen dempet, med kommandoer som inline-kode, og «trykk en tast» dempet til høyre. Neste tast fjerner
  meldingen og utføres også, som i vim med korte meldinger (PO-135). Tekstene er de samme som i web (AR-3-24):
  - «**E475:** Ugyldig argument: «h9»» / «Skriv `:presenter h2` til `:presenter h6`. Notatet har overskrifter på nivå h2 og h3.»
  - «**E486:** Ingen overskrifter på nivå h5 i notatet» / «Lysbildene deles ikke annerledes. Notatet har overskrifter på nivå h2 og h3. Valget er ikke lagret.»
- Gyldig kommando: kort bekreftelse i kommandolinjen, dempet i 2 s («Lysbildenivå h3 · ikke lagret», PO-107).

### 5.4 Flytevinduer og hjelpen `?` (`21-`)

- Flytevindu = nvim-float: **runde hjørner** i `strek`, flate i `flate_bg`, tittel fet i toppstreken og hint dempet
  til høyre i toppstreken («? lukker»). Cellene under tømmes.
- `?`: midtstilt vindu. **Lysbildet bak dempes** (all tekst i `dekor` på lerretet), så vinduet står alene, også i
  video. Grupper (Blaing, Visning, Kommandoer, Avslutt) står i fet aksent. Taster fet i tekstfarge, forklaring dempet.
  Innholdet kommer fra katalogens `?`-grupper for flaten «terminal» (AR-3-22).

### 5.5 Notatlisten ved oppstart (`26-`)

- Overlinje: `~/` i fet aksent, vaultnavnet dempet og «· velg notatet du vil presentere».
- Søkefelt med **`/` som ledetekst** (vims søk), søket fet og blokkmarkør. Til høyre `7 / 214` dempet. Lett strek `─`
  i `dekor` under.
- Rader: navn · sti (dempet, fast kolonne) · endret dato (dempet, høyrejustert). Nyeste først. Markørraden er som i
  oversikten (ensfarget, `▌` i `fokus`).
- **Fuzzy-treff:** tegnene som traff er fet og understreket i aksent (understrekfarge 58). På markørraden er de fet og
  understreket i `markor_tekst`, aldri aksent på `markor_bg`.
- Statuslinje: «Notater» · `↑ ↓ flytter · ↵ presenterer · Esc avslutter`. `Ctrl-n`/`Ctrl-p` virker også (vim), men
  vises ikke.

### 5.6 Oppstart og live

- Oppstartsskjerm (AR-3-07 M3) med indeksering: én linje midt på, `Leser vaultet …  1 240 / 2 000` dempet, og tallet i
  tekstfarge. Ingen spinner.
- Live endring: lysbildet tegnes på nytt uten blink (bare endrede celler). Ble det aktive lysbildet slettet:
  kommandolinjen viser «Lysbildet finnes ikke lenger. Du står ved «Outbox-mønsteret».» dempet i 4 s.

### 5.7 For liten terminal (`27-`, Q-3-05)

Midtstilt, uten krom:

```
Terminalen er for liten                                  (fet)

79 × 23  –  presentasjonen trenger minst 80 × 24          (målet som er for lite i `feil`, fet)

Gjør vinduet større eller skriften mindre (Ctrl -).
Lysbildet tegnes straks det er plass.  q avslutter
```

- Er terminalen smalere enn 40 kolonner, vises bare de to første linjene, brutt. Under 20 kolonner vises bare
  `80×24`.
- Tastene virker fortsatt (`q`, `Esc`, `Ctrl c`). Posisjonen beholdes, og lysbildet tegnes straks størrelsen holder.

---

## 6. Farger

### 6.1 Roller (truecolor)

Alle roller er avledet av paletten i `tokens.css`. Den eneste nye råverdien er `#000000` (svart skjerm). Verdiene
per palett × modus står i `farger.json › truecolor.<palett>.<light|dark>`.

| Rolle | Kilde | Brukes til |
|---|---|---|
| `bg` | `color-bg` | Lerretet. **Hele** terminalen males, også margene. Terminalens egen bakgrunn vises aldri. |
| `tekst` | `color-text` | Brødtekst, titler, verdier |
| `dempet` | `color-muted` | Sekundærtekst, tidligere agendapunkter, hint, linjenumre (≥ 4,5) |
| `dekor` | `color-faint` | **Bare dekor:** ledere, tittelstrek, `│` i trær, rullespor. Aldri tekst. |
| `strek` | `color-rule-strong` | Rammer på tabeller, plassholdere og flytevinduer (≥ 3) |
| `aksent`, `aksent2` | `color-accent(2)` | `02 /`, agendanummer, `~/`, sitatstrek (aksent2) |
| `lenke`, `lenke_brutt` | `color-link(-broken)` | Lenker |
| `linje_bg` | tekst 8 % (mørk) / 7 % (lys) i bg, oklab | Tabline og statuslinje |
| `flate_bg` | = `linje_bg` | Flytevinduer og inline-kode (egen rolle fordi ansi16 skiller dem) |
| `kode_bg`, `kode_tekst` | `shiki-background/-foreground` | Kodeflaten |
| `kode.*` | `shiki-token-*` (14) | Kodetokens |
| `kulor.*` | `hue-*` (8) | Callouts og status |
| `invertert_bg` / `invertert_tekst` | `color-text` / `color-bg` | «Du er her», merkene NÅ og OVERSIKT (`invertert_tekst` på `aksent`) |
| `markor_bg` / `markor_tekst` | `color-selection` / `color-text` | Markørrad i oversikt, notatliste og wildmenu |
| `treff_bg` | `color-mark` | `==markering==` |
| `fokus` | `color-focus` | Halvblokken `▌` ved markøren |
| `hode` / `hode_skygge` | aksent / aksent 45 % i bg | Figlet (skygge brukes ikke av vr-fontene) |
| `fremdrift` / `fremdrift_spor` | aksent / `color-faint` | `━` ferdig / `─` gjenstår (sporet er dekor, formen bærer) |
| `feil`, `ok` | `hue-red`, `hue-green` | Feilkoder, `● live`, `● done` |
| `svart` | `#000000` | Svart skjerm |

Stilregler som hører til fargene:

- **Markørraden er ensfarget** (`markor_tekst`). Dempet på `color-selection` gir 3,4–4,5 i mørke paletter.
- Aksentfarget tekst er alltid **fet**, unntatt lenker, som i stedet har understrek.

### 6.2 Kontrast, verifisert med skript

`node docs/design/terminal/kontrast-terminal.mjs` gir **368 kontroller** (49 per kombinasjon × 4 paletter × 2 moduser)
**og 0 brudd**. Krav: tekst ≥ 4,5, ikke-tekst ≥ 3, og dekor rapporteres uten krav.

| Laveste verdier | | |
|---|---|---|
| Kommentar i kode / `kode_bg` | 4,59 | Papir lys |
| `aksent` / `linje_bg` (tabline-nummer) | 4,92 | Signal lys |
| `kode.keyword`, `kode.operator` / `kode_bg` | 4,99 | Signal lys |
| `lenke_brutt` / bg | 4,99 | Papir lys |
| `dempet` / `linje_bg` (statuslinje) | 5,35 | Cyanotypi lys |
| `invertert_tekst` / `aksent` (NÅ) | 5,78 | Signal lys |
| `strek` / bg (rammer, ikke-tekst) | 3,04 | Cyanotypi lys |
| `fokus` / bg | 4,56 | Cyanotypi lys |

Første kjøring fant to reelle problemer, som begge er løst som designregler: dempet tekst på markørraden (3,40 i
Fosfor mørk), som nå er ensfarget, og fremdriftssporet mot `linje_bg` (2,60), som nå er dekor der formen `━`/`─` bærer
informasjonen, som `--color-progress-track` i v2.

### 6.3 «Terminalens egne farger» (16 ANSI-farger, `--farger terminal`)

Brukerens tema eier fargene, så kontrasten kan ikke kontrolleres. Designet lener seg derfor mest på **form og
vekt**. Lys eller mørk bestemmes av terminalens bakgrunn (OSC 11), ellers mørk (AR-3-11). Kartet står i
`farger.json › ansi16.{dark,light}`.

| Rolle | Mørk | Lys | Merknad |
|---|---|---|---|
| `bg` / `tekst` | default (49/39) | default | Terminalens egne |
| `dempet` | 7 | 8 | Lys grå på mørk, mørk grå på lys |
| `dekor`, `strek` | 8 | 7 / 8 | |
| `aksent`, `lenke`, `hode`, `fremdrift` | palettens indeks: papir 9/1, cyanotypi 12/4, fosfor 10/2, signal 11/1 | | `--palett` betyr fortsatt noe |
| `aksent2` | 14 | 6 | |
| `linje_bg` (tabline, statuslinje) | **SGR 7 (revers)** | revers | Som vims standard `StatusLine`/`TabLineFill`. Valgt fane uten revers. |
| `flate_bg` (flytevinduer) | default | default | Bare rammen. Inline-kode blir `kode.string` uten bakgrunn. |
| `invertert_*`, `markor_*` | SGR 7 | SGR 7 | «Du er her», markørrader |
| `kode_bg` | default | default | Kodeflaten skilles av hodet og `╌`-streken |
| `kode.keyword`/`operator` | 13 | 5 | Kode følger vim-tradisjonen |
| `kode.string` | 10 | 2 | |
| `kode.comment` | 8 + kursiv | 8 + kursiv | |
| `kode.constant`/`number` | 11 | 3 | |
| `kode.function`/`property`/`link` | 12 | 4 | |
| `kode.type`/`string-expression` | 14 | 6 | |
| `kode.punctuation` | 7 | 8 | |
| kulører blue/teal/green/amber/orange/red/plum/grey | 12/14/10/11/11/9/13/7 | 4/6/2/3/3/1/5/8 | |
| `feil` / `ok` / `fokus` | 9 / 10 / 11 | 1 / 2 / 3 | |
| `svart` | 0 (SGR 40) | 0 | |

`NO_COLOR` gir ingen farger, bare fet, kursiv, understrek og revers. Strukturen står seg (form og vekt bærer alt).
256 farger: nærmeste farge til truecolor-verdien (AR-3-11).

---

## 7. Tegnsett, oppsummert

| Bruk | Tegn | Vekt |
|---|---|---|
| Tabeller | `━` topp/bunn, `─` under hodet, `│` bare i smal modus | booktabs |
| Callouts og flytevinduer | `╭ ╮ ╰ ╯ ─ │` | lett, runde hjørner |
| Plassholdere | `┌ ┐ └ ┘ ╌ ┆` | lett, stiplet |
| Kode | ingen ramme; `╌` under hodet, `↪` ved bryting, `│┃` rullefelt | |
| Trær og skiller | `├── └──`, `│`, `─` (tittelstrek, fotnotestrek) | lett, `dekor` |
| Figlet | `▀ ▄ █` | massiv |
| Markører | `●◐○` status, `▌` fokus, `▎` sitat, `–` liste, `·` ledere og skille, `…` avkorting, `›` sti | |
| **Aldri** | doble streker `═║╔╗` (DOS-preg), powerline-pilene (krever Nerd Font), emoji i krom, blinkende markør | |

---

## 8. Forhold til ADR-011 (til arkitekten)

Reglene over er UX' fasit. Der de presiserer eller avviker fra tabellene i ADR-011, gjelder dette dokumentet. Si fra
hvis noe er dyrt.

| ADR-011 sier | UX bestemmer | Hvorfor |
|---|---|---|
| Tabell: `┌─┬─┐ │ ├─┼─┤ └─┴─┘` | Booktabs uten loddrette streker (`━ ─ ━`). `│` bare i smal modus (§4.6 trinn 2). Kortvisning som ADR. | Samme uttrykk som leseren og v2. Et fullt rutenett ser ut som en generisk TUI. QAs `rammetegn`-sjekk treffer `─`. |
| Sitat: `│ ` i `strek` | `▎` i `aksent2` | Tydelig i video, og skiller seg fra tabellens `│`. |
| Overskrift: fet `aksent` | `02 /` i fet aksent på egen rad, tittelen fet i **tekstfarge** med tittelstrek | Som v2 Terminal (`02 /` over tittelen). Lang tittel i aksent er tyngre å lese. |
| Plassholder: stiplet ramme i `dekor`, 1–3 rader | Stiplet ramme i `strek`, 3–4 rader, valgfri detaljlinje | `dekor` er under 3:1. Detaljlinjen er et spørsmål til PO (§11). |
| Fotnoter nederst | Nederst, eller som **marginalia** ved ≥ 200 kolonner (§4.8) | Bruker bredden, og samsvarer med leseren |
| `TERMINAL_FIT_STEPS = [1, 0.5]` | **`[1]`** | §1.3 |
| `vr-blokk` med `▌▐` | Bare `▀ ▄ █` (kvadratiske piksler) | `▌▐` gir halve kolonner og ujevne strektykkelser |
| Inline-kode `kode_bg` | `flate_bg` (= `linje_bg`) | `kode_bg` er nær usynlig mot bg i mørke paletter |
| OSC 8 bare eksternt | Også interne lenker, til `obsidian://` | PO-109 |

Ny rolle i `farger.json`: `flate_bg`. ADR nevner `hode_skygge` med `░▒▓`; rollen finnes, men vr-fontene bruker den
ikke.

---

## 9. Mockups og skjermbilder

Statusmøtet («Statusmøte uke 45», samme innhold som v2-prototypen) er tegnet med reglene over. Det har **10 lysbilder
ved 120 × 36**. Lys/mørk og palett står i filnavnet. `skjermbilder/v3/<samme navn>.png`.

| Fil | Viser |
|---|---|
| `01`–`10` (Fosfor mørk, 120 × 36) | Hele møtet: tittel, agenda, overgang ×3, kode, plassholdere + sitat + bilde, «(forts.)» med tabell og fotnoter, Bases + kanban, callout + rullende kode |
| `20` oversikt · `21` hjelp · `22` `:` med fullføring · `23` E475 · `24` E486 · `25` svart · `26` notatliste · `27` for liten (79 × 23) · `28` rullet kodeblokk | Tilstander |
| `30` Signal mørk · `31` Papir lys · `32` Cyanotypi lys · `33` Signal lys · `34` Cyanotypi mørk · `35` Papir mørk · `36` Fosfor lys | Palettene |
| `40`–`42` | Terminalens egne farger (eksempeltema mørkt og lyst) |
| `50-*` (80 × 24) | Tittel med `vr-smal`, agenda uten luft, «(forts.)» der kode flyttes, Bases, kanban alene, rullende kode med `↪` |
| `60-*`, `61` (200 × 50) | Tittel med Ctrl +-hint, agenda, overgang, marginalia, oversikt med forhåndsvisning |

**Kritisk gjennomgang underveis**, med endringene designet fikk:

1. ANSI Shadow-skyggen ble støy, og Ø lignet 0. Den ble erstattet av egne massive pikselfonter.
2. Tittelen på innholdslysbilder var for svak og fikk tittelstreken.
3. Inline-kode var usynlig i Fosfor mørk og brøt fra parentesen. Løst med `flate_bg` og ordregelen.
4. «(forts.)» med ett avsnitt. Løst med enkeregelen.
5. Bases-strekene var lengre enn innholdet.
6. Hjelpen blandet seg med lysbildet. Løst med demping bak flytevinduet.
7. ansi16 manglet bånd. Løst med vim-revers.
8. Forhåndsvisningen pagineres ikke på nytt.

---

## 10. Sjekkliste for frontend og QA (v3)

- [ ] Hele terminalen males med `bg` (også margene). Ingen celle står med terminalens standardbakgrunn i truecolor.
- [ ] Rutenett etter §1.1–1.2. Målbredde 72, satsmaks 160, hengende markører og rammer i margen.
- [ ] Figlet-kjeden er `vr-blokk` 1 → `vr-blokk` ≤ 2 (3) → `vr-smal` ≤ 2 → fet. Høyde ≤ ⅓, aldri blandet, aldri på innhold.
- [ ] Agendalinje: valgt fane på `bg`, understrek i aksent, `n/m` alltid, avkortingstrinn §2.5.
- [ ] Statuslinje: `n/N` sist og høyrejustert mot satsen. Hintet droppes først. Tittelsiden viser bare starthintet.
- [ ] Deling: `[1]`, foreldreløs-regel, enkeregel, fotnoter med delen sin. 200 × 50 = v2-rekkefølgen.
- [ ] Kode: `↪` ved bryting, rullehint og rullefelt, ingenting kuttes.
- [ ] Tabeller: booktabs. Bredde → avstand 2 → `│` → krymp og bryt → kortvisning.
- [ ] Plassholdere: nøyaktig spesifikasjonstekst. Aldri Mermaid-kilde eller korttitler.
- [ ] OSC 8: interne lenker til `obsidian://`, eksterne til URL-en, brutte uten.
- [ ] Markørrader ensfarget. Fuzzy-treff fet + understrek.
- [ ] Svart skjerm `#000`. Bare `b`, `.` og `Esc` slår av.
- [ ] `node docs/design/terminal/kontrast-terminal.mjs` gir 0 brudd etter alle fargeendringer.
- [ ] ansi16: revers på statuslinje og tabline, ingen bakgrunnsfarger ellers.

## 11. Åpne spørsmål

1. **Detaljlinjen i plassholderne** («flowchart LR · 7 noder», «Oppgaver.base · 11 kort: todo 3 · doing 3 …»). Den er
   nyttig i et statusmøte og billig, men går litt lenger enn «diskret plassholder». **PO:** beholde, eller bare den
   faste teksten? Designet virker med begge.
2. **Overgangens figlet-hode viser seksjonsnavnet**, ikke «AGENDA». v2-prinsippet «samme side» ivaretas av listen.
   QA-fasiten forutsetter seksjonsnavnet. **PO:** bekreft.
3. **Enkeregelen** (§2.6.4) er en ny presisering av A2. Den bør også gjelde i web (ADR-010) for å holde én modell.
   **Arkitekt/PO:** godkjenne for begge flatene?
4. **Hintet om `Ctrl +` ved > 160 kolonner** på tittelsiden. **PO:** OK at det vises for publikum?
5. **Vaultnavn i `obsidian://`-lenker:** Obsidian identifiserer vaultet ved navn (mappenavn) eller id. **Arkitekt:**
   hvilken verdi har vi i `resolveConfig` (`--vault-id`?).
6. **Tetthet `[1]`** er valgt. Med ekte rapportnotater ved 80 × 24 kan det gi mange «(forts.)». **QA:** si fra hvis
   et notat i testvaultet får mer enn dobbelt så mange lysbilder ved 80 × 24 som ved 200 × 50.
