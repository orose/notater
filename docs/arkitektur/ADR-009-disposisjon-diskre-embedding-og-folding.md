# ADR-009: Disposisjon – diskré embedding, innholdsfortegnelse, §-nummer og folding

- Status: Vedtatt (arkitekt), 2026-11-06. Gjelder v1.1 F2 og F3 (AK-1.1-02/03/04).
- Bygger på ADR-002 (HAST fra serveren) og ADR-008 (hvor tilstanden bor).

## Kontekst

- Serveren sender sanitert HAST. Innebygde notater er `vr-embed[data-status=ok]` med målets innhold som
  barn; overskrifter i embeds har **ingen id** (BE9), og `toc` inneholder bare vertsnotatets overskrifter.
- I dag nummereres seksjoner med en CSS-teller på `.prose > h2`, og TOC/scroll-spy bruker serverens `toc`.
- F2 krever at overskrifter fra innebygde notater (i diskré modus) blir med i TOC og §-nummerering, på
  justert nivå, og kan foldes. F3 krever folding på alle nivåer, utfolding ved dyplenker/TOC/søk og `za`.
- Diskré modus er et **klientvalg** (ADR-008). Serveren skal ikke kjenne det.

## Beslutning 1: Disposisjonen lages i klienten, fra HAST – ingen serverendring

Vi bygger en **disposisjon** (outline) i klienten som en ren funksjon av HAST-en, *før* rendering:

```
NoteDocument ─ splitLeadingTitle (PO-35) ─ prepareContent (sidenoter, oppgaver) ─ buildOutline(discreet) ─ applyFolds(folded) ─ HastContent
                                                                                     │
                                                                                     └→ toc, overskrifter, §-nummer, seksjoner
```

Hvorfor HAST og ikke DOM: HAST finnes før første maling, så TOC og § er riktige i første bilde (ingen
«hopp» etter en måling i `useEffect`), funksjonen er ren og enhetstestbar, og den kan memoiseres på
`(content, discreet)`. DOM-en brukes bare til det som krever layout: leseposisjon (`za`) og scroll-spy.

Hvorfor ikke serveren: alt som trengs finnes allerede i kontrakten, uavhengig av visningsvalget:

| Klienten trenger | Finnes i dag |
|---|---|
| Om embeden er notat, seksjon eller blokk | `data-anchor` mangler / er overskrift-id / starter med `^` |
| Notatets tittel (notatembed) | `data-title` = målets tittel |
| Seksjonens overskrift | første blokk i barna (seksjonen tas ut *med* overskriften) |
| Kildenivå på innebygde overskrifter | `h1`–`h6` beholdes uendret (bare CSS degraderer dem i rammevisning) |
| Kildelenke | `data-target` + `data-anchor` |
| Feiltilstander | `data-status` ≠ `ok` (ingen barn) |

Serveren endres derfor **ikke**. I stedet gjøres egenskapene over **normative** i `api.md`
(«Garantier for innebygd innhold», tillegg v1.1), slik at backend ikke bryter dem uforvarende.
`src/shared/api-types.ts` får bare en presiserende kommentar på `toc`. Ingen typeendring, full
bakoverkompatibilitet.

Vurdert og forkastet: en `embeddedToc` per `vr-embed` fra serveren. Det ville duplisert overskriftene
(de står allerede i HAST), og nivåjusteringen avhenger likevel av vertsnotatets kontekst og av diskré-valget,
som bare klienten kjenner.

## Beslutning 2: Modulen `features/outline`

```
features/outline/
  build-outline.ts       ren: (content, toc, discreet) → Outline
  apply-folds.ts         ren: (content, outline, folded) → content med hidden på foldede blokker
  reading-position.ts    DOM: overskriften ved leseposisjon, READING_LINE (deles med scroll-spy)
  OutlineProvider.tsx    fold-tilstand (Set<id>), reveal ved hash, porter til kommandoene
  FoldToggle.tsx         pilknappen
  index.ts
```

```ts
interface OutlineHeading {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;    // effektivt nivå (etter justering i diskré modus)
  text: string;
  origin: 'note' | 'embed';
  foldable: boolean;               // på toppnivå i flyten (se Beslutning 4)
  sec: number | null;              // §-nummer for nummererte nivå-2-overskrifter
}
interface Outline {
  content: Root;                   // omskrevet HAST (diskré: nye nivåer, id-er, tittel-overskrifter)
  headings: readonly OutlineHeading[];
  toc: readonly TocEntry[];        // til <Toc>/<InlineToc> (uendret komponent-API)
  sectionOf(id: string): readonly string[];  // id-ene til alle seksjoner som inneholder elementet
}
```

`note-view` kaller `buildOutline` og gir `outline.toc` til `Toc`/`InlineToc` (i stedet for `display.toc`);
`toc`-featuren endres ikke utover scroll-spy (Beslutning 5). `outline` importerer ikke `note-view`.

## Beslutning 3: Diskré embedding – omskrivingsregler

Gjelder kun `vr-embed[data-status=ok]` når diskré er på for vertsnotatet. Nestede embeds arver (hele
treet skrives om). Feilkort (`missing`, `cycle`, `depth-limit`), `vr-base` og `img` røres ikke.

**Nivå.** `forrige` = effektivt nivå på nærmeste foregående overskrift i *verten* (for nestede embeds:
det innebyggende notatet, etter justering). Uten foregående overskrift er konteksten notatets tittel (H1),
altså `forrige = 1`. Tittelnivå `T = min(6, forrige + 1)`.

| Type | Overskrift | Innebygde overskrifter (`l` = kildenivå) |
|---|---|---|
| Notat (ingen `data-anchor`) | Ny `h{T}` med `data-title`. **Unntak (PO-35):** begynner målet med en H1, brukes dens tekst og den fjernes fra barna (ellers dobbel tittel). | `m` = laveste kildenivå blant toppnivå-overskriftene: `l → min(6, T + 1 + l − m)` |
| Seksjon (`data-anchor` uten `^`) | Seksjonens egen første overskrift, satt til `h{T}` | `s` = seksjonsoverskriftens kildenivå: `l → min(6, T + l − s)` |
| Blokk (`data-anchor` med `^`) | Ingen | Sjelden; `l → min(6, T + l − m)` |

Etter embeden gjelder vertens `forrige` igjen (to embeds etter samme H2 får begge H3-tittel). Overskriftene
**retagges** (`h3` → `h4` osv.), ikke bare restyles, slik at skjermlesere får riktig struktur. Ved nivå 6
flates dypere nivåer ut (akseptert).

**Id-er.** Innebygde overskrifter har ingen id fra serveren. Klienten gir dem `~e<n>-<i>`: `n` = embedens
løpenummer i dokumentrekkefølge (1-basert, også nestede), `i` = overskriftens nummer i embeden (tittelen
er `0`). Ingen av serverens id-er starter med `~` (github-slugger fjerner tegnet, blokk-id-er starter med `^`,
fotnoter og id-er fra rå HTML med `user-content-`), så kollisjon er umulig. Testen låser at `slug('~') === ''`.
Id-ene er stabile så lenge innholdet er det samme; de brukes i TOC-lenker (`#~e2-1`), som overlever reload
fordi diskré-valget huskes.

**Element.** `vr-embed` får `dataVrDiscreet: 'true'`. `Embed` rendrer da uten ramme, etikett og «Åpne
notat»: en `div.embed-discreet` med barna i vanlig brødtekst-flyt (samme `--space-flow`, `font-size: 1em`)
og **én** kildelenke først i DOM-en (`a.embed-source`, f.eks. «Kilde: ‹tittel›», til
`docUrl(target, anchor)`). Lenken er visuelt skjult til `.embed-discreet:hover` eller `:focus-within`, og
plasseres i margen (UX bestemmer uttrykket). Fordi den er en ekte lenke først i embeden, får
tastaturbrukere den når de tabber inn (AK-1.1-03). Tomt mål → tittel + dempet «Notatet er tomt.».

**TOC.** Vertsoverskrifter tar tekst fra serverens `toc` (samme tekst som i dag); innebygde får tekst fra
HAST (`inlineText`, samme funksjon som `splitLeadingTitle`). `visibleToc` (nivå 2–4, minst 3) brukes
uendret på de effektive nivåene, så innebygde overskrifter teller med i terskelen.

## Beslutning 4: §-nummer beregnes, ikke telles i CSS

CSS-telleren (`counter-increment` på `.prose > h2`) erstattes av `data-vr-sec="3"` (og
`data-vr-sec-pad="03"` for Terminal) satt av `buildOutline`, og CSS `content: "§\2009" attr(data-vr-sec)`.

Begrunnelse: (1) `>`-selektoren treffer ikke overskrifter inne i en diskré embed; (2) foldede blokker får
`display: none`, og CSS-tellere telles **ikke** i skjulte elementer – § ville hoppet når man folder en H1
med H2-er under; (3) TOC og eventuell annen visning kan bruke samme nummer.

Nummererte overskrifter = **foldbare** overskrifter med effektivt nivå 2: toppnivå i verten pluss toppnivå i
diskré embeds (rekursivt). Overskrifter i callouts, sitater, lister og rammede embeds nummereres ikke og
foldes ikke – som i dag. Fotnote-overskriften («Fotnoter») er ikke i disposisjonen.
`[data-ornaments="off"]` skjuler fortsatt nummeret (PO-19).

## Beslutning 5: Folding

**Flyten.** Folding virker på *toppnivå-flyten*: rotens barn, der en diskré embed er gjennomsiktig (barna
er med i flyten, innenfor et eget *omfang*). Rammede embeds, callouts osv. er én blokk i flyten.

**Seksjonsgrense.** Seksjonen til overskrift `H` (nivå `L`, i omfang `S`) er blokkene etter `H` frem til
første av: (a) en overskrift med nivå ≤ `L` i `S` eller et ytre omfang, (b) slutten av `S` (embedens slutt),
(c) dokumentets slutt. Regel (b) betyr at folding av en innebygd overskrift aldri skjuler vertens tekst
etter embeden, og at et innebygd notat ikke kan foldes som én blokk (F3) – men en vertsoverskrift som
inneholder embeden, skjuler den (med kildelenken).

**Rendering.** `applyFolds` gir en kopi av HAST med `hidden` på hver skjult blokk (strukturdeling: urørte
noder beholder identitet). `HastContent` rendrer toppnivåblokkene som memoiserte enheter, så en fold
rendrer bare blokkene som endret seg (AK17 for store notater). Nestede folder er union: en blokk er skjult
hvis en seksjon som inneholder den er foldet. `hidden="until-found"` brukes der React og nettleseren støtter
det: da finner nettleserens søk (⌘F) tekst i foldede seksjoner, og `beforematch` folder ut. Ellers vanlig
`hidden` (spesifikasjonen krever ikke ⌘F-støtte).

**Pilen.** Overskriftskomponentene (alle `h1`–`h6`, ikke bare h2/h3 som i dag) rendrer
`button.fold-toggle[type=button][aria-expanded]` med `aria-label` «Fold sammen ‹tekst›» / «Fold ut ‹tekst›»
for foldbare overskrifter. Synlig ved `:hover`/`:focus-within` på overskriften; `@media (hover: none)`
alltid synlig, dempet. Foldet overskrift får `data-vr-folded` og en diskret indikator (UX). Merk: knappens
navn blir en del av overskriftens tilgjengelige navn, slik ankerlenken allerede er i dag.

**Tilstand.** `OutlineProvider` (nøkkel `vaultId + docPath`) holder `Set<id>`. Nytt notat ⇒ ny provider ⇒
alt utfoldet (huskes ikke). Ved live reload beholdes bare folder på vertsoverskrifter som fortsatt finnes
(innebygde id-er er posisjonelle og kan peke på en annen overskrift etter endring).

**`za` – seksjonen ved leseposisjon.** (1) Har en overskrift (eller pilen i den) fokus, gjelder den.
(2) Ellers siste *synlige* foldbare overskrift med `top < READING_LINE × innerHeight`, der
`READING_LINE = 0.3` – **samme linje som scroll-spy**, så `za` folder seksjonen TOC-en markerer som aktiv.
(3) Ingen slik overskrift (over første overskrift) → toast «Ingen seksjon her». Lå overskriften over
toppen av visningen når seksjonen foldes, rulles den til toppen (`block: 'start'`, uten animasjon ved
redusert bevegelse), så leseren ikke mister plassen. `zM` folder alle foldbare, `zR` tømmer settet.

**Scroll-spy.** `useScrollSpy` må hoppe over skjulte overskrifter (`el.checkVisibility?.() ??
el.offsetParent !== null`): et element med `display: none` har `top = 0` og ville ellers blitt «aktivt».
TOC viser fortsatt foldede overskrifter. `READING_LINE` eksporteres fra `outline` og brukes av scroll-spy,
eller scroll-spy får linjen som parameter (toc skal ikke importere outline, så `note-view` sender den inn).
Høyre marg (PO-48) og sidenoter måles på nytt ved hver fold (`ResizeObserver` på `.prose`).

**Utfolding ved navigasjon.**

| Hendelse | Effekt |
|---|---|
| `#overskrift`, `#^blokk`, `#user-content-fn-…` (dyplenke, TOC-klikk, lenke i notatet, frem/tilbake) | Alle seksjoner som inneholder målet foldes ut (`sectionOf(id)`) |
| Søketreff til et annet notat | Nytt notat ⇒ alt utfoldet |
| Søketreff til samme notat (PUSH uten hash) | Regnes som å åpne notatet: alt foldes ut |
| `beforematch` (⌘F) | Seksjonene rundt treffet foldes ut |

Utfoldingen skjer **under rendering** når `location.hash` endres (samme mønster som `lastPath` i
`VaultLayout`: sammenlign med forrige verdi og oppdater tilstand i render). Dermed er `hidden` borte i samme
commit, før `useDocumentScroll` (forelderens layout-effekt, kjører etter barnas commit) finner elementet
og ruller dit. Ingen ekstra ramme, ingen falsk «Fant ikke seksjonen».

## Konsekvenser

- Ingen API-endring; diskré og folding er rene klientfunksjoner, testbare som rene funksjoner på HAST.
- CSS-telleren for § byttes ut (berører `note-view.css` og `embed.css`); frontend og UX må ta det samme slice.
- Antakelser til PO (logget som AR-1.1-…): `za` bruker 30 %-linjen; overskrifter i rammede embeds kan ikke
  foldes; overskrifter i callouts/sitater foldes og nummereres ikke.
- Risiko: memoisering per toppnivåblokk er nødvendig for ytelse i store notater; uten den re-rendres hele
  HAST-treet ved hver fold.
