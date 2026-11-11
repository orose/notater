# ADR-010: Presentasjonsmodus – lysbildemodell, automatisk tilpasning, present-modus, URL og live reload

- Status: Vedtatt (arkitekt), 2026-11-08. Gjelder v2 (`docs/produkt/v2-spesifikasjon.md`, P1–P3, S1–S8, L1–L4, A1–A5, AK-2-01–14).
- Bygger på ADR-002 (HAST fra serveren), ADR-007 (register og tastaturmotor), ADR-008 (visningstilstand) og ADR-009 (disposisjon).
- Skjelett: `src/web/features/presentation/` (typer, id-er, posisjon, lagring, URL, fullskjerm – kompilerer, har tester).
- Beslutningene er logget som AR-2-01 … AR-2-25 i `docs/beslutninger.md`.

## Kontekst

v2 skal vise et notat som lysbilder uten å endre notatet (P1), med alle handlinger i registeret (P2) og en egen
tastaturmodus (P3). Det meste vi trenger finnes allerede i klienten:

| Behov | Finnes |
|---|---|
| Overskrifter etter diskré-utflating (S1) | `buildOutline(content, toc, discreet = true)` – flyten med diskré embeds gjennomsiktige (ADR-009 §5) |
| Rendering av HAST, callouts, kode, Mermaid, embeds, Bases | `HastContent` + komponent-mappingen i `note-view` |
| Live data (notat, embeds, Bases) | `useDocument` (TanStack Query) invalideres av live reload; `doc.bases` følger dokumentet |
| Tema | `data-type`/`data-palette`/`data-mode` på `<html>`, CSS-variabler, Mermaid leser variablene |
| Tastatur | `createKeyEngine` er nøklet på modus (`KEY_MODES`), katalogen har `bindings` per modus |
| Lagring per notat | Mønsteret fra diskré embedding (ADR-008) |

To ting i dagens kode krever tiltak (se §8): `buildOutline` eksponerer ikke flyten, og `useDocumentScroll`
ruller til toppen ved *hver* `location.key`-endring – også når bare query-strengen endres.

## Beslutning 1: Lysbildemodellen – to rene trinn rundt én DOM-måling

```
NoteDocument ─ splitLeadingTitle ─ prepareContent ─ buildOutline(discreet=true) ─ outline.flow
                                                                                   │
           buildSlideDrafts(source, { slideLevel })   ← ren, S1–S8 ────────────────┘
                     │  SlideDraftDeck (struktur, `---`, agenda; uavhengig av layout)
           målelerret (DOM, §2) → DeckFit (skala + bruddpunkter per utkast)
                     │
           finalizeDeck(drafts, fit, { transitions })   ← ren, A2-fortsettelser, nummer, progresjon, id-er
                     │  SlideDeck
                   Stage / SlideView
```

Typene står i `presentation/model/slide-types.ts`. Begge trinn er rene og testes uten DOM; bare målingen
trenger layout. `buildSlideDrafts` memoiseres på `(outline, slideLevel)`, `finalizeDeck` på `(drafts, fit, transitions)`.

**Inndata.** `SlideSource = { title, flow: FlowBlock[] }`, der `FlowBlock = { node, heading, thematicBreak }` er
disposisjonens toppnivåflyt (rotens barn, diskré embeds gjennomsiktige, uten fotnotelisten og blanke tekstnoder).
Presentasjonen bygger alltid sin **egen** disposisjon med `discreet = true` (S1), uavhengig av lesevisningens valg,
og bruker `outline.content` uten `applyFolds` (S8: foldetilstand ignoreres).

### Regler (S2–S7)

Nivåene `L` = settet av overskriftsnivåer i flyten.

1. **Nivåer (S2–S4).** Automatisk: agendanivå `A = min(L)`, lysbildenivå `S = A + 1`. Med `:presenter h<n>`:
   `S = n`, `A = max{ l ∈ L | l < n }` (nærmeste nivå *som finnes* over; finnes ingen, er det ingen agenda).
   `h<n>` er gyldig når `n ∈ L` (`validLevels`); ellers feilmelding (§3). Uten overskrifter: S7.
2. **Agendapunkter** = overskriftene på nivå `A`. Overskrifter **over** agendanivået (bare mulig ved overstyring,
   f.eks. H2 når `A = 3`) blir verken agendapunkter eller egne lysbilder (QA Q-05, fasit `niva.h4`); de avslutter
   gjeldende agendaseksjon. Har en slik overskrift eget innhold før neste agendapunkt, blir innholdet et
   innholdslysbilde med den overskriften, uten agendapunkt (agendalinjen vises uten utheving og progresjon). Står det
   før første agendapunkt, er det innledning (S6).
3. **Innledning (S6)** = blokkene før første agendapunkt. Den prøves på tittellysbildet (måles, §2); får den ikke
   plass, blir den egne lysbilder (`innledning`) mellom tittel og agenda. `---` deler den som ellers (S5).
4. **Agendaseksjon** = agendapunktet og blokkene frem til neste agendapunkt:
   - Har den underoverskrifter på nivå `S`: blokkene før første underoverskrift (punktets innledning) blir et
     innholdslysbilde med agendapunktets overskrift; deretter ett lysbilde per underoverskrift (overskrift + blokker
     frem til neste overskrift med nivå ≤ `S`). Dypere overskrifter er innhold.
   - Ellers: hele seksjonen er **ett** lysbilde (S3).
   - Tom seksjon (ingen blokker): bare overgangen; med `:agenda av` et lysbilde med kun overskriften, så punktet ikke
     forsvinner.
5. **`---` (S5)** deler et utkast i deler innen samme agendapunkt; del ≥ 2 får overskriften med «(forts.)». Tomme
   deler (skille først/sist, to skiller etter hverandre) forkastes. `hr`-elementet vises ikke.
6. **Uten agenda (S7, eller `h<n>` uten nivå over):** tittel + innhold delt på `S`-overskrifter (finnes de), `---` og A2.
   Ingen agenda, overganger eller agendalinje.
7. **Rekkefølge:** tittel → [innledning] → agenda → for hvert punkt: overgang → innhold. `finalizeDeck` dropper
   overgangene når `transitions = false` (`:agenda av`, huskes ikke). Agendalysbildet (L2) vises uansett.

### Utkastenes innhold

- **Enheter (`SlideUnit`)**: hver blokk er én enhet; en liste på toppnivå (`ul`/`ol`) deles i listepunkter med felles
  `listKey`, slik at tilpasningen kan bryte *mellom* punkter, aldri inne i ett (A2). `finalizeDeck` setter punktene
  sammen igjen til én liste per lysbilde (`ol` får `start`).
- **Oppførsel ved overstørrelse** (`UnitOverflow`): `scale` for `img`, `figure` og `vr-mermaid` (skaleres til boksen);
  `scroll` for `vr-code`, `table`, `vr-base`, `vr-callout`, `blockquote` og feilkort (minste skrift + intern rulling som
  siste utvei); `flow` for resten (avsnitt, listepunkter). Et avsnitt som alene er større enn et lysbilde på minste
  skrift, får også intern rulling – ingenting kuttes usynlig (AK-2-08).
- **Id-er fjernes** fra alle noder i enhetene. Lesevisningen er fortsatt montert (§6); like id-er ville gitt
  `getElementById`-feil og axe-brudd. Fotnotereferanser (`sup > a[data-footnote-ref]`) rendres uten lenke.
- **Fotnoter (A4):** `prepareContent` har allerede lagt `vr-sidenote` ved hver referanse. `finalizeDeck` samler
  sidenotene i lysbildets enheter til `Slide.footnotes`; `SlideView` viser dem nederst og skjuler de innebygde.

### Lysbildetyper og agendalinjen

| Type | Innhold | Agendalinje |
|---|---|---|
| `title` (L1) | Tittel, ingress (PO-21), `PropertyList` som i headeren (skjulte properties er allerede filtrert på serveren, PO-29), endringsdato; evt. innledningen (S6) | Nei |
| `agenda` (L2) | Alle punkter | Nei |
| `transition` (L3) | Agendaen, gjeldende punkt uthevet, tidligere dempet | Nei |
| `content` (L4) | Overskrift (+ «(forts.)») og enheter | Ja: punktene, gjeldende uthevet, `index/count` innen punktet |

`progress.count` teller alle innholdslysbilder i punktet, også `---`-deler og A2-fortsettelser. Agendalinjen avkortes
til forrige · **nåværende** · neste med «…» når den ikke får plass; det måles én gang per kortstokk (§2,
`DeckFit.compactAgendaLine`), ikke per lysbilde.

## Beslutning 2: Automatisk tilpasning (A2) – skjult målelerret, logisk 16:9, diskrete skalatrinn

### Logisk lerret

Lerretet har fast **logisk** størrelse `CANVAS = 1920 × 1080` CSS-piksler. Visningen skaleres til vinduet med
`transform: scale(k)`, `k = min(bredde / 1920, høyde / 1080)`, sentrert med letterbox (A1). `k` settes som
`--stage-scale` fra en `ResizeObserver`. UX' tokens er i logiske piksler (`--lp = 100cqw / 1920`, lerretet har
`container-type: size`): siden lerretet *alltid* er 1920 bredt før transformen, er `1lp = 1px` både i visning og måling.
Miniatyrer i oversikten kan bruke container-enhetene direkte (mindre container) – der kreves ikke identisk layout.
Vurdert og forkastet for selve lerretet: bare container-enheter uten transform. Da ville lerretet vært 1280 px bredt i et
1280-vindu, og avrunding (bl.a. `max(1px, …)`-strekene og fontens hinting) kunne gitt andre linjebrudd enn i
målingen – tilpasningen måtte vært gjort per vindusstørrelse.

Konsekvens: **layout – og dermed tilpasningen – er uavhengig av vindusstørrelsen.** Endret vindu, delt vindu i
Teams, projektor med annen oppløsning og 390×844 gir samme lysbilder, bare skalert. Ingen ny måling ved resize.
Mermaid tegnes med rammens bredde, som er logisk og dermed lik i måling og visning.

### Når og hvor det måles

Tilpasningen skjer **ved bygging av kortstokken, før lysbildet vises**, i et skjult målelerret
(`MeasureCanvas`): en portal i presentasjonslaget med `visibility: hidden`, `position: absolute` langt utenfor
skjermen, `contain: strict`, `aria-hidden` og `inert`. Det rendrer **samme** `SlideView`-komponent med samme CSS som
visningen, i logisk størrelse og uten transform – så målt og vist layout er identisk per konstruksjon.

Hvert utkast rendres med hver enhet i sin egen `div.slide-unit[data-unit=i]` (også i visningen), slik at
blokkhøyder kan leses uten å kjenne komponentenes egne DOM-elementer. Innholdsområdet er `flex: 1; min-height: 0`;
i måling har kolonnen inni naturlig høyde, så én render gir både tilgjengelig høyde og hver enhets topp/bunn.

**Mermaid måles ikke.** Enheter med `overflow = 'scale'` får i måling en fast minstehøyde (token
`--slide-figure-min`) og vokser i visningen inn i ledig plass (`flex: 1 1 auto`); SVG-en skaleres med `viewBox`.
I målelerret erstattes `vr-mermaid` med en tom plassholder av den høyden. Da trenger målingen verken Mermaid-
biblioteket eller asynkron rendering. Bilder har `width`/`height` fra serveren (PO-71) og behandles likt.
Bases er synkrone (`doc.bases`) og måles som de er.

### Algoritmen (per utkast, alle utkast i samme pass)

1. **Pass 1 – skala 1:** rendre alle uavklarte utkast; les `scrollHeight > clientHeight` for innholdsområdet (én
   layout for alle). Passer det: `{ scale: 1, breaks: [] }`.
2. **Trinnene** er `fontScaleSteps(step, min)` (`fit/fit-types.ts`): fra 1 ned til minimum i steg på
   `--slide-fit-step` (UX: 0,025), minimum = `--slide-text-min-lp / --slide-body-lp` **for gjeldende typesett** (UX:
   30/40 = 0,75 for Tidsskrift, ≈ 0,78 for Terminal og Klartekst) – lest fra CSS i målelerret, reserveverdier i koden.
   Kode, tabell og kanban har eget gulv (`--slide-mono-min-lp`), som CSS håndhever. Mål på minste trinn; passer det,
   finn den største skalaen som får plass på ett lysbilde ved binærsøk over trinnene (≤ 4 pass for ~11–17 trinn).
   Passer ikke minimum:
3. **Splitting mellom enheter:** på minste skala, grådig pakking av enhetene etter målte topp/bunn i tilgjengelig
   høyde → minste antall deler `n`. Deretter den største skalaen som fortsatt gir `n` deler (binærsøk, samme
   pass-mønster). Alle deler av et utkast bruker samme skala (lik typografi på «(forts.)»-lysbildene).
4. **Enhet større enn ett lysbilde alene** (på minste skala): `scale` → skaleres til boksen; ellers `scrollUnits`
   (minste skrift, intern rulling, `tabindex=0` + `role=region` med etikett slik `ContentTable` gjør).
5. **Kontrollpass:** delene rendres ferdig (med «(forts.)»-overskrift og egne fotnoter); en del som likevel flyter
   over, flytter siste enhet til neste del. Høyst ett slikt pass; deretter intern rulling.

Kanban på lerretet: kolonnene deler bredden (`minmax(0, 1fr)`) så alle vises om mulig; blir de for smale (UX
setter minstebredde), ruller basen horisontalt internt – horisontal overflyt er aldri grunn til å splitte.

### Ytelse (AK-2-13)

- Modellen er lineær i flyten (< 20 ms for et rapportnotat med 20 embeds). Dokumentet ligger allerede i
  query-cachen når man presenterer fra lesevisningen – ingen nettverk.
- **Prioritet:** start-lysbildets utkast og naboene måles først (1–3 utkast, ≤ 5 små pass) – deretter vises
  presentasjonen. Resten måles i bakgrunnen i biter (maks ca. 8 utkast eller ~40 ms per bit, `requestIdleCallback`
  med `setTimeout`-reserve, `startTransition`). Mens det pågår er `DeckFit.complete = false`: nummer og antall er
  foreløpige («7 / 12» kan bli «7 / 13»), oversikten (`o`) viser en kort ventetilstand, og skjermleseren annonserer
  ikke antallet før det er ferdig. Hopper man til et umålt lysbilde, måles det synkront først.
- **Lysbildebytte < 100 ms:** målingen er ferdig og cachet; gjeldende lysbilde og naboene er montert på forhånd
  (naboene med `visibility: hidden` i samme lerret, så Mermaid allerede er tegnet). Et bytte er én tilstandsendring;
  URL-en oppdateres etterpå (§4), utenfor den kritiske stien.
- QA måler begge i `perf`-spesifikasjonen (fasitnotat med 20 embeds). Hvis start likevel passerer 500 ms, er neste
  steg å vise start-lysbildet *før* naboene er målt; algoritmen endres ikke.

### Cache og invalidering

`FitCache` (i `PresentationProvider`, lever så lenge vaultet er åpent, LRU ~500 utkast) med nøkkel `FitKey`:

| Del av nøkkelen | Hvorfor |
|---|---|
| `content` = hash (cyrb53) av utkastets enheter som JSON + overskrift + `BaseResult`-ene enhetene viser (`data-base-id`) | Live reload gir nye objekter; innhold som ikke er endret, treffer cachen. Kanbanendring endrer bare lysbildet med basen. |
| `typeset` (`data-type`) | Fontmetrikk. |
| `layoutVersion` (byggkonstant) | Endret lysbilde-CSS. |

| Hendelse | Effekt |
|---|---|
| Live reload | Nye utkast → nye hasher → bare endrede utkast måles (gjeldende først). Forrige kortstokk vises til gjeldende lysbilde er målt (ingen blink). |
| Bytte av typesett | Alle nøkler bommer → gjeldende måles straks, resten i bakgrunnen. |
| Bytte av palett / lys-mørk | Ingenting (påvirker ikke layout – regel for UX: paletter og modus kan ikke endre fontvekt, størrelse eller avstand). |
| Endret vindusstørrelse, fullskjerm inn/ut | Ingenting (logisk lerret); bare `--stage-scale`. |
| `document.fonts` `loadingdone` | `clear()` – første måling venter uansett på `document.fonts.ready`. |
| `:presenter h<n>`, `:agenda av` | Nye utkast/ny kortstokk; uendrede utkast treffer cachen (`:agenda av` måler ingenting). |

## Beslutning 3: Present-modus i tastaturmotoren (P3)

- `KEY_MODES = ['normal', 'present']`. `CommandProvider` kaller `engine.setMode(active ? 'present' : 'normal')` når
  presentasjonens status endres, og `CommandContext.mode` gjenspeiler modusen (i dag hardkodet `'normal'`).
- Ny gruppe `presentasjon` i `COMMAND_GROUPS`. Nye kommandoer i katalogen:

| Id | Navn | Normal | Present | Palett (`:`) |
|---|---|---|---|---|
| `present.start` | Presenter | `Leader p` | – | `presenter`, argument `nivå`: `auto`, `h1`–`h6` (kun gyldige) |
| `present.next` / `present.previous` (par) | Neste / forrige lysbilde | – | `j` `ArrowRight` `n` `Space` `PageDown` / `k` `ArrowLeft` `p` `PageUp` | ja |
| `present.first` / `present.last` (par) | Første / siste lysbilde | – | `g g` / `G` | ja |
| `present.overview` | Oversikt | – | `o` | `oversikt` |
| `present.blackout` | Svart skjerm | – | `b` `.` | `svart` |
| `present.agenda` | Overganger | – | – | `agenda`, argument `av`/`på` (uten argument: veksle) |
| `present.fullscreen` | Fullskjerm av/på | – | – | `fullskjerm` |
| `present.stop` | Avslutt presentasjon | – | – (Esc via `system.escape`) | `avslutt` |

  Eksisterende kommandoer får present-bindinger: `palette.commands` `:`, `help.shortcuts` `?`, `system.escape`
  `Escape`. `j`/`k`/piltaster har `repeat: true`; resten ikke.
- **`Space` er neste lysbilde, ikke leader.** I present-modus finnes ingen `Leader`-bindinger; `Space` er en vanlig
  enkelttast. Entydighetsregelen (ingen sekvens er prefiks av en annen i samme modus) gjør det umulig å legge til en
  `Space x`-binding i present ved en feil, og which-key vises aldri (motoren starter aldri en ventende sekvens på
  `Space`). DOM-adapterens regel om Space på aktiverbare elementer (AR-1.1-10 trinn 4) gjelder fortsatt: står fokus
  på en knapp/fane i lysbildet, aktiverer Space den. Presentasjonen setter fokus tilbake på lerretet (`tabIndex=-1`)
  ved hvert lysbildebytte og ved klikk på ikke-interaktive flater.
- **Reserverte taster.** P5 (ingen ⌥, hvitelisten) og P4-Esc (`Escape` kun for `system.escape`) gjelder i alle modi
  og testes for present. P4s bokstavliste (`i a o e … p … r`) gjelder etter AR-1.1-07 **første akkord i normal-modus**
  – den er reservert for fremtidig redigering, som starter fra normal-modus. Spesifikasjonens egen tabell binder `p` og
  `o` i present; det er i tråd med AR-1.1-07. `validateBindings` trenger derfor ingen endring; katalogtesten utvides
  til å kjøre policyen per modus og låse present-tabellen. *(Bekreftes av PO, se spørsmål.)*
- **`:` og `?` i present.** Paletten og `?`-kortet er modale (`dialog`): motoren er inaktiv mens de er åpne (P7), og
  de vises over lerretet fordi fullskjerm gjelder hele dokumentet (§4). `?` viser present-modusens taster:
  `shortcutGroups(platform, mode)` får modus som parameter (standard `normal`); README får en egen tabell
  «I presentasjon» generert fra samme funksjon (`npm run docs:shortcuts`, sync-testen utvides).
- **Kommandoer i feil modus.** `isEnabled` får begrunnelser: i present er lese-kommandoer (rulling, folding,
  bredde, diskré, zen, søk, historikk) deaktivert med «Ikke under presentasjon»; tema-, palett-, utseende-, `?`- og
  `present.*`-kommandoene virker. Utenfor present er `present.next` osv. deaktivert med «Bare under presentasjon».
  `present.start` krever `route.kind === 'note'` («Gjelder bare notater»).
- **Feilmelding for nivå (S4).** `CommandHandler` får en valgfri `argumentError(ctx, name, input) → string | null`
  som paletten viser i stedet for den generiske E475-teksten: `E475 Ugyldig nivå «h9» – bruk auto eller h1–h6.` og
  `E475 Ingen overskrifter på nivå h5 i dette notatet. Gyldige nivåer: h2, h3, h4.` Argumentlisten viser bare gyldige
  nivåer, med f.eks. «agenda h2 · 9 lysbilder» som beskrivelse.
  *Oppdatert etter PO-101:* `E475` brukes bare for ugyldig argument (`h9`, `hx`, `4`); et nivå uten overskrifter i notatet (`h5`, `h1`) gir `E486 Ingen overskrifter på nivå h5 i notatet. … Gyldige nivåer: h2, h3 og h4.`
- **Oversikten (`o`)** er en modal `dialog` med rutenett (ARIA grid). Den eier selv piltaster, `hjkl`, `↵`, `o` og
  Esc (står som `KEY_HINTS` for present, AR-1.1-11). Miniatyrene er samme `SlideView` skalert ned; Mermaid i
  miniatyrer bruker allerede tegnet SVG når den finnes, ellers en plassholder.
- **Svart skjerm** er et lag i lerretet (ikke modal); `b`/`.` veksler. Neste/forrige mens svart: skjermen kommer
  tilbake uten å bla (som i PowerPoint). Avslutning nullstiller.
- **Esc** (`system.escape` i present) → `presentation.escape()`: lukk oversikten hvis åpen (normalt lukker dialogen
  seg selv før motoren ser tasten), ellers avslutt. `system.escape` sin normal-modus-oppførsel (avslutt zen) er uendret.

## Beslutning 4: URL-tilstand, historikk og fullskjerm

### URL

- **Overlegg på notatets egen rute**, ingen ny rute: `/v/:vaultId/<DocPath>?lysbilde=<id>`. Parameteren finnes ⇔
  presentasjonen vises. `SLIDE_PARAM`, `slideParam` og `withSlideParam` i `presentation-url.ts`.
- **Id-grammatikk** (`slide-id.ts`): `tittel`, `agenda`, `innledning`, `overgang.<agendanøkkel>`, `<nøkkel>`,
  `<id>.del<k>` (S5), `<id>.forts<m>` (A2). Nøkler er **slug av overskriftsteksten** med github-slugger (allerede en
  avhengighet; samme slugging som serverens overskrift-id-er), forhåndsmatet med de faste id-ene og med `-1`, `-2`
  ved duplikater i dokumentrekkefølge. Ikke disposisjonens id: `~e<n>-<i>` er posisjonell og endres når et embed
  legges til foran. `.` forekommer aldri i en slug, så suffiksene er entydige.
- **Start:** `present.start` legger `?lysbilde=` (tom verdi) på historikken (*push*, med `state.presentationFrom`) –
  tom verdi betyr «start ved leseposisjonen». Laget finner start-lysbildet og bytter til ekte id med *replace*.
  Leseposisjonen er overskriften `headingAtReadingPosition` gir for `#innhold .prose h1–h6[id]` (samme leselinje som
  `za`/TOC, PO-53). Treffer den et agendapunkt: overgangen (eller første innhold med `:agenda av`); en annen
  overskrift: første utkast med id-en i `sourceHeadingIds`; ingen: tittellysbildet. Lesevisningen kan være uten diskré
  embedding – da finnes bare vertsoverskriftene, som har samme id i begge disposisjoner.
- **Bla:** lysbildet er React-tilstand i laget (sannheten under økten); URL-en synkroniseres med *replace* i en
  effekt etter at lysbildet er vist. Historikken fylles ikke av lysbilder: **Tilbake** i nettleseren avslutter
  presentasjonen (og Frem går inn i den igjen, på samme lysbilde).
- **Avslutt (Esc, `:avslutt`):** finnes `state.presentationFrom`, `navigate(-1)` (POP – `useDocumentScroll`
  gjenoppretter lagret rulleposisjon for oppføringen); ellers (åpnet fra lenke/reload) *replace* uten parameteren og
  rull til lagret anker. Begge veier ender «samme sted i notatet» (AK-2-01).
- **Reload / delt lenke:** laget leser id-en og bruker `resolveSlide` (§5). `:agenda av` og svart skjerm huskes ikke;
  lysbildenivået er lagret per notat (§7) og gir samme kortstokk.
- `?lysbilde` på en `.base`- eller vedleggs-URL ignoreres (siden vises som vanlig).

### Fullskjerm

- `enterPresentationFullscreen()` kaller `document.documentElement.requestFullscreen({ navigationUI: 'hide' })` –
  **hele dokumentet**, ikke lerretet. Da vises paletten, `?`-kortet, varselsonen (toast) og live-statusen fortsatt;
  på element-fullskjerm ville alt utenfor lerretet forsvunnet.
- Kallet gjøres **synkront i brukergesten**: i `present.start` sin `run`, før navigasjonen. Fra tastaturet er det
  i `keydown`; fra paletten kjøres kommandoen i neste animasjonsramme etter Enter (AR-1.1-12), innenfor nettleserens
  vindu for forbigående brukeraktivering (Chrome/Firefox ~5 s, Safari ~1 s).
- **Avvist / ikke støttet** (Safari på iPhone, innebygd nettleser, policy, reload uten gest): presentasjonen går
  videre i vinduet, uten feil. Ved reload vises en kort toast: «Fullskjerm av – `:fullskjerm` slår den på».
  `present.fullscreen` (`:fullskjerm`) er en vanlig kommando og dermed en ny brukergest.
- **Esc i fullskjerm.** Nettleseren bruker Esc til å forlate fullskjerm og leverer normalt ikke tasten til siden. Der
  Keyboard Lock finnes (Chromium), låses `Escape` etter at fullskjerm er gitt: Esc kommer da til siden og følger
  spesifikasjonen (lukk oversikt, ellers avslutt). Ellers tolkes en `fullscreenchange` ut av fullskjerm som vi ikke ba
  om, som Esc: er oversikten åpen, lukkes den og presentasjonen fortsetter i vinduet; ellers avsluttes presentasjonen.
- Avslutning går alltid ut av fullskjerm (`exitPresentationFullscreen`) og låser opp tastaturet.

## Beslutning 5: Live reload under presentasjon

- Laget bruker samme `useDocument(vaultId, docPath)` som lesevisningen. Live reload invaliderer spørringen
  (ADR-004); nytt dokument ⇒ ny disposisjon ⇒ nye utkast ⇒ tilpasning bare for endrede utkast (§2) ⇒ ny kortstokk.
  Agenda, agendalinje og Bases-data oppdateres dermed uten egen kode (AK-2-07, AK-2-09).
- **Posisjonen** holdes med `resolveSlide(next, currentId, previous)` (`model/resolve-slide.ts`, testet):
  1. eksakt id; 2. samme id med kortere suffiks (`x.del2.forts3` → `x.del2` → `x`); 3. samme strukturelle adresse
  (`SlideAddress`: type, agendapunkt, nummer, del, fortsettelse) – dekker omdøpt overskrift eller agendapunkt;
  4. nærmeste nabo fra forrige kortstokk som fortsatt finnes, etterfølgere før forgjengere; 5. samme indeks, begrenset.
  Endret id ⇒ URL-en byttes med *replace*.
- **Dobbel buffer:** forrige kortstokk vises til gjeldende lysbilde i den nye er målt; byttet skjer i én commit.
  Byttes lysbildet *innhold* (samme id), annonseres det ikke på nytt for skjermleseren.
- **Notatet slettes/omdøpes:** 404 avslutter presentasjonen og viser lesevisningens «finnes ikke» (BUG-006). Omdøping
  (`renamed`) flytter det lagrede nivået (§7); selve presentasjonen avsluttes (ny URL), som i lesevisningen.

## Beslutning 6: Gjenbruk og rutearkitektur

### Overlegg, ikke egen rute

`PresentationLayer` monteres av `VaultLayout` (app-laget) når `?lysbilde` finnes og dokumentet er et notat, som
søsken til `.app` innenfor `LiveReloadProvider`. Lesevisningen **forblir montert**: `<html data-presenting>` gir
`.app`, `.topbar` og hopp-lenken `visibility: hidden` (bevarer layout og rulleposisjon) og `inert`; `<html>` får
`overflow: hidden`. Laget er `position: fixed; inset: 0`.

Hvorfor overlegg: (1) avslutning er umiddelbar og tilbake på samme sted – ingen ny montering og rulling av et stort
notat; (2) samme dokumentspørring, live reload, palett, kommandoer, toast og tema uten ny plumbing; (3) ingen ny
rute å parse (`docPathFromPathname` er uendret), ingen serverendring for SPA-fallback. Vurdert og forkastet: egen rute
`/v/:vaultId/presenter/<DocPath>` – den måtte avmontert lesevisningen (rulleposisjon og fold tapt, treg avslutning)
og duplisert dokumentsidens tilstandshåndtering.

### Avhengighetsretning (web)

```
app ─→ presentation ─→ note-view (HastContent) ─→ callout, code-block, mermaid, embed, bases
  │          ├──────→ outline (buildOutline, headingAtReadingPosition)
  │          ├──────→ properties (PropertyList, ingressOf)
  │          └──────→ shared/api (useDocument)
  └─→ commands ─→ presentation (kun usePresentationControl + typer), keyboard
```

`presentation` importerer ikke `commands`, og `note-view`/`outline` importerer ikke `presentation` (ingen sykler).
`PresentationProvider` monteres i `VaultLayout` over `CommandProvider` (som `OutlineHost`).

### Uten duplisering

- **HAST-rendering:** `HastContent` får en valgfri prop `components` (overstyringer flettes over standard-mappingen).
  Presentasjonen overstyrer bare: `h1`–`h6` (`SlideHeading`: retagget relativt til lysbildet – lysbildeoverskriften
  er `h2`, dypere nivåer følger etter; ingen anker, ingen fold-pil), `vr-sidenote` (ingenting inline, A4),
  `sup` med fotnotereferanse (uten lenke) og – kun i målelerret – `vr-mermaid` (plassholder). Callouts, kode, embeds,
  bilder, tabeller og Bases går gjennom de vanlige komponentene. Siden laget ikke ligger under `FoldingProvider`, gir
  `useHeadingFold` uansett `null`.
- **Bases:** `BaseBlock`/`BaseTable`/`BaseKanban` uendret; lerret-tilpasning er CSS i `presentation.css` under
  `.slide` (kolonnebredder, skrift via tilpasningsskalaen, intern rulling). Fane-tastene (←→ Home End) håndteres av basen
  selv og kaller `preventDefault` – motoren ser dem ikke, som i dag.
- **Mermaid:** `MermaidDiagram` uendret – tegnes med rammens (logiske) bredde og tegnes på nytt ved temabytte som i
  dag. «Forstørr» skjules i lysbilder (CSS); diagrammet skaleres til boksen.
- **Tema:** ingen ny palett (utenfor scope). Lysbildene bruker eksisterende tokens + nye `--slide-*`-tokens (UX,
  `tokens.css`, allerede påbegynt): `--lp`, `--slide-step-*`, `--slide-body-lp`, `--slide-text-min-lp`,
  `--slide-fit-step`, `--slide-mono-min-lp`, farger for agenda/fremdrift/letterbox. Arkitekturen trenger i tillegg
  `--slide-figure-min` (minstehøyde for figurer i måling) og at tilpasningsskalaen settes som én variabel per lysbilde
  (`--slide-fit`, satt av `SlideView` fra `Slide.scale`) som brødtekst-tokenene multipliseres med. Kontrast verifiseres av UX for alle 24 kombinasjoner (AK-2-12).
- **Tittellysbildet:** `PropertyList` fra `properties`; `ingress()` flyttes fra `NoteHeader` til `properties` som
  `ingressOf(properties)` (andre bruker). `formatDateTime` for endringsdato.

### Tilgjengelighet

Laget: `role="region"`, `aria-label="Presentasjon"`, `aria-roledescription="lysbildeserie"`; gjeldende lysbilde:
`role="group"`, `aria-roledescription="lysbilde"`, `aria-label` = `Slide.label` (WAI-ARIA-mønsteret for karusell).
QAs `data-testid`-er i `e2e/support/v2.ts` (`lysbilde`, `data-slide-type`, `data-slide-index`, `agendalinje`,
`agendaliste`, `lysbildenummer`, `lysbilde-kunngjoring`, `oversikt-lysbilde` …) er kontrakten frontend følger. En skjult `h1` med
notattittelen står alltid i laget (heading-order/page-has-heading-one på innholdslysbilder). `role="status"` annonserer
«Lysbilde 7 av 12: Leveranse B» etter hvert bytte. Overgang: `opacity` 150 ms, ingen ved `prefers-reduced-motion`.
Touch: horisontalt sveip ≥ 50 px eller trykk i venstre tredjedel (forrige) / resten (neste); trykk på lenker, knapper,
faner og rulleområder går til elementet. Lenker i lysbilder virker og forlater presentasjonen; Tilbake går inn igjen.

## Beslutning 7: Lagring av lysbildenivå

`presentation-storage.ts` (skjelettet er ferdig og testet), samme mønster som diskré embedding (ADR-008):

- `localStorage['vault-leser.presentasjon']` = `{ "v": 1, "levels": [["<vaultId>\n<docPath>", 3], …] }` – bare notater
  med **overstyrt** nivå, nyeste sist, maks 500. `:presenter auto` fjerner oppføringen.
- Leses ved hver start (alltid ferskt, også på tvers av faner – ingen `storage`-lytter trengs), skrives ved
  `:presenter h<n>`. All tilgang via `safeLocalStorage()` + try/catch: blokkert lagring ⇒ valget gjelder økten.
- Følger notatet ved omdøping (`moveLevelIn`, PO-49) via samme `moved`-signal som `DiscreetMoveSync`.
- P1: funksjonene tar bare `vaultId`/`docPath` og et nivå – aldri notatinnhold. API-et er kun GET (ADR-005), så
  AK-2-03 «ingenting skrives til notatet» er oppfylt konstruktivt.

## Beslutning 8: Endringer i eksisterende kode (slice 2-a)

| Hvor | Endring | Hvorfor |
|---|---|---|
| `outline/build-outline.ts` | Nytt felt `Outline.flow: readonly FlowBlock[]` (flyten som allerede beregnes internt; uten fotnoter og blanke noder) | Modellen trenger flyten; ingen ny traversering, ingen endret oppførsel |
| `note-view/HastContent.tsx` | Valgfri prop `components` (overstyringer) | Gjenbruk av hele mappingen |
| `note-view/use-document-scroll.ts` | Ingen rulling når bare `lysbilde`-parameteren endres (samme `pathname`, `hash` og øvrig query) | I dag ruller hver *replace* lesevisningen til toppen under overlegget |
| `properties` | `ingressOf()` flyttes hit fra `NoteHeader` | Tittellysbildet (andre bruker) |
| `keyboard/modes.ts` | `KEY_MODES = ['normal', 'present']` | P3 |
| `commands/model` | Gruppe `presentasjon`, nye kommandoer, present-bindinger, `shortcutGroups(platform, mode)`, `argumentError` | P2/P3, S4 |
| `commands/CommandProvider.tsx` | `ctx.mode` fra presentasjonen, `engine.setMode`, port `presentation` | P3 |
| `commands/handlers.ts` | Modus-begrunnelser i `isEnabled`; `system.escape` i present → `presentation.escape()` | F5-mønsteret |
| `app/VaultLayout.tsx` | `PresentationProvider` over `CommandProvider`; `PresentationLayer`; `PresentationMoveSync` | Overlegget |
| `README` | Tabell «I presentasjon» (generert) | AR-1.1-13 |

Planlagte filer i `features/presentation/` (✓ = i skjelettet):

```
model/slide-types.ts ✓   model/slide-id.ts ✓   model/resolve-slide.ts ✓   model/index.ts ✓
model/build-slides.ts    (2-a) buildSlideDrafts, fromOutline(outline, title) → SlideSource
model/finalize-deck.ts   (2-a) finalizeDeck, fotnoter, progresjon, etiketter
fit/fit-types.ts ✓       fit/fit-cache.ts (2-b)   fit/fingerprint.ts (2-b)   fit/MeasureCanvas.tsx (2-b)   fit/use-deck-fit.ts (2-b)
presentation-storage.ts ✓   presentation-url.ts ✓   fullscreen.ts ✓   presentation-control.ts ✓
PresentationProvider.tsx (2-a)   PresentationLayer.tsx (2-a)   Stage.tsx (2-a/2-b)   SlideView.tsx (2-b)
TitleSlide.tsx, AgendaSlide.tsx, AgendaLine.tsx, ProgressBar.tsx, Overview.tsx, Blackout.tsx (2-c)
presentation.css (2-b, UX-tokens)   index.ts ✓
```

`presentation/model` er ren TS (som `commands/model`), men leses ikke av README-skriptet og trenger ikke ligge i
`tsconfig.tooling.json`.

## Serveren

**Ingen endring.** Alt trengs finnes i dokument-API-et: sanitert HAST med embeds (ADR-009-garantiene), `toc`,
`properties` (skjulte filtrert, PO-29), `mtime`, `bases` (evaluert, oppdateres ved live reload), bildedimensjoner
(PO-71). CSP tillater inline `style` (brukes allerede av Mermaid; `--stage-scale`), og serveren sender ingen
`Permissions-Policy` som blokkerer fullskjerm. SPA-ruten `/v/*` er uavhengig av query-strengen. Klienten skriver
aldri til serveren.

## Konsekvenser

- Lysbildestrukturen er rene funksjoner med fasit-tester (S1–S8, AK-2-02/04/05); bare tilpasningen trenger e2e.
- Logisk lerret gjør tilpasningen deterministisk og uavhengig av vindu; prisen er at alle typografimål er i logiske
  piksler, og at teksten blir liten på telefon i stående format (letterbox, akseptert av A1).
- Overlegget holder to visninger av samme notat montert. Id-ene fjernes i lysbildene; lesevisningen er `inert`.
- Risiko: målepassene rendrer innhold på nytt; for svært store notater kan bakgrunnsmålingen ta over ett sekund
  (antall og oversikt foreløpige så lenge). Start og bytte holdes innenfor kravet av prioriteringen og cachen.
- Risiko: Esc i fullskjerm uten Keyboard Lock (Firefox, Safari) avslutter presentasjonen i ett trykk, også når man
  bare ville ut av fullskjerm. Akseptert: det er spesifikasjonens Esc-semantikk; `:fullskjerm` går ut uten å avslutte.
