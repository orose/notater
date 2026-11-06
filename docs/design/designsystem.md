# Designsystem – Vault-leser

Eier: UX/webdesign. Bindende grunnlag: `docs/produkt/brief.md` (særlig B9, B10, AK2–AK3, AK5–AK6, AK8–AK9, AK13–AK16, AK19).

**Filer i `docs/design/`**

| Fil | Hva |
|---|---|
| `designsystem.md` | Dette dokumentet: prinsipper, tokens, komponentspesifikasjoner |
| `tokens.css` | **Kanonisk kilde** for alle CSS custom properties (generert, kontrastverifisert). Importeres som den er. |
| `shiki-tema.ts` | Shiki-tema der alle farger er `var(--shiki-*)` – ett tema for alle paletter |
| `prototype.html` | Selvstendig referanse (fonter innebygd som base64, ingen nettverkskall). Åpne direkte i nettleser. |
| `skjermbilder/` | Skjermbilder 1440 px og 390 px i flere kombinasjoner (v1.1 i `skjermbilder/v1.1/`) |
| `prototype-v1.1.html` | **v1.1** (§11): lesebredde, diskré embedding, folding, zen, `:`-palett, `?`-oppslagskort, which-key. Selvstendig, interaktiv. |
| `kontrast-v1.1.mjs` | Kontrollskript for v1.1-fargene: `node docs/design/kontrast-v1.1.mjs` (exit 1 ved brudd, `--json` for QA) |

Prototypen kan styres med URL-parametre: `prototype.html?type=terminal&palette=fosfor&mode=dark`, og har tre «sider»: `#notat` (standard), `#komponenter` (alle callouts, lenketyper, tomtilstander/feil) og `#ukjent` (ukjent notat). `⌘K`/`Ctrl+K` åpner søk, `⌘.` bytter lys/mørk.

---

## 1. Designprinsipper

1. **Tekst først, grensesnitt etterpå.** Lesekolonnen er produktet. Kromet (sidepanel, marg) er stille: tynne streker i stedet for bokser, ingen skygger på innhold, ingen dekor som konkurrerer med teksten.
2. **Typografi gjør jobben farger gjør i generiske UI-er.** Vi skiller ting med skriftsnitt, småkapitéler, kursiv, mono og streker. Farge brukes sparsomt: én aksent per palett, pluss semantiske kulører for callouts.
3. **Tekniske ting får tidsskrift-behandling.** Kodeblokker er *figurer* med nummer og bildetekst, diagrammer har bildetekst, tabeller er «booktabs» (ingen loddrette streker), fotnoter blir marginalia. Det er dette som gjør det motiverende å lese – notatene ser *utgitt* ut.
4. **To personligheter, ett skjelett.** «Tidsskrift» og «Terminal» deler DOM, layout og tokens-navn. Bare verdier og noen få `[data-type]`-regler skiller dem. Frontend bygger én gang.
5. **Ærlig om det vi ikke kan.** Brutte lenker, ukjente Bases-nøkler, Dataview og LaTeX vises rolig og tydelig – aldri som en krasj, aldri som en skrikende feil.
6. **Tilgjengelighet er en del av estetikken.** AA-kontrast i alle 16 kombinasjoner, synlig fokus, lenker skilles ikke bare med farge (alltid understrek), `prefers-reduced-motion` nuller all bevegelse.

**Anti-mønstre (avtalt med kunden):** ingen lilla/blå gradienter, ingen «kort med skygge og emoji», ingen Inter-på-hvitt, ingen glassmorfisme, ingen emoji som ikoner (vi bruker egne 1,6 px strek-ikoner, se prototypens `<symbol>`-sprite), ingen avrundede «piller» overalt.

---

## 2. Temasystem – to akser (+ modus)

Temaet settes som tre attributter på `<html>`:

```html
<html lang="nb" data-type="tidsskrift|terminal|klartekst" data-palette="papir|cyanotypi|fosfor|signal" data-mode="light|dark">
```

| Akse | Verdier | Påvirker |
|---|---|---|
| **Typografisk sett** (`data-type`) | `tidsskrift` (A), `terminal` (C), `klartekst` (K, PO-18) | fonter, typeskala, linjehøyde, målbredde, radier, strektykkelser, noen komponentvarianter |
| **Palett** (`data-palette`) | `papir`, `cyanotypi` (anbefalt for A) · `fosfor`, `signal` (anbefalt for C) | alle farger inkl. kode og callouts |
| **Modus** (`data-mode`) | `light`, `dark` (brukervalg `system` løses i JS) | velger lys/mørk variant av paletten |

Alle **3 × 4 × 2 = 24** kombinasjoner er gyldige og kontrastverifisert (K kontrollert med axe-core i nettleser, 0 brudd – se §3.1). Paletten er uavhengig av typesettet (kontrast avhenger kun av palett × modus); «anbefalt» vises bare som et hint i temavelgeren.

### 2.1 Lagring og oppstart (AK2, AK3)

- `localStorage['vault-leser.tema'] = {"mode":"system","type":"tidsskrift","palette":"papir"}` (standard ved første besøk).
- Et lite **inline-script i `<head>`** (før CSS maler) leser verdien og setter attributtene – ellers blinker feil tema. Se toppen av `prototype.html`; kopier logikken.
- Ved `mode: "system"`: lytt på `matchMedia('(prefers-color-scheme: dark)')` og oppdater `data-mode` live.
- `color-scheme: light|dark` settes av paletten (native scrollbars/skjemafelt følger).
- Tema-bytte må også re-rendre Mermaid (se §6). Shiki trenger **ikke** re-rendres (CSS-variabler).

---

## 3. Fonter (OFL, selvhostet via npm)

Alle er SIL Open Font License 1.1 og installeres fra npm. Importer **kun latin-subsettet** (dekker æ ø å og alle norske tegn) for å holde bundelen liten (~ 300 KB totalt for begge sett).

| Rolle | Sett A «Tidsskrift» | Sett C «Terminal» |
|---|---|---|
| Brødtekst og titler | **Spectral** – `@fontsource/spectral` (300, 300-italic, 400, 400-italic, 600) | **Schibsted Grotesk** – `@fontsource-variable/schibsted-grotesk` (wght 400–900) |
| Småkapitéler / etiketter | **Spectral SC** – `@fontsource/spectral-sc` (500) | JetBrains Mono (versaler) |
| Kode | **IBM Plex Mono** – `@fontsource/ibm-plex-mono` (400, 400-italic, 500) | **JetBrains Mono** – `@fontsource-variable/jetbrains-mono` (wght 100–800 + italic), ligaturer på |
| Metadata (datoer, stier) | IBM Plex Mono | JetBrains Mono |

```ts
// src/app/fonts.ts – importer kun det som brukes (latin)
import '@fontsource/spectral/latin-300.css';
import '@fontsource/spectral/latin-300-italic.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-400-italic.css';
import '@fontsource/spectral/latin-600.css';
import '@fontsource/spectral-sc/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400-italic.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource-variable/schibsted-grotesk/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/jetbrains-mono/wght-italic.css';
```

Fontfamilienavnene i `tokens.css` er nøyaktig de fontsource registrerer: `"Spectral"`, `"Spectral SC"`, `"IBM Plex Mono"`, `"Schibsted Grotesk Variable"`, `"JetBrains Mono Variable"`. Fallback-stakkene peker på macOS-fonter (Iowan Old Style, Charter, SF Mono, Helvetica Neue).

**Hvorfor disse:**
- **Spectral** (Production Type) er en skjermoptimalisert tekstantikva med tidsskriftpreg, lett 300-vekt for store titler og en *ekte* SC-søsterfamilie. Viktig funn: fontsource/Google-byggene **fjerner OpenType-funksjonene `smcp`/`onum`** fra alle seriffer vi testet (Source Serif 4, Newsreader, Literata, EB Garamond, Alegreya, Crimson Pro, Fraunces …) – `font-variant-caps: small-caps` ville gitt falske, syntetiserte småkapitéler. Spectral SC løser det: skriv etiketten med `text-transform: lowercase` i `--font-sc`, så blir hele ordet ekte småkapitéler (c2sc-effekt).
- **Schibsted Grotesk** er tegnet for Schibsteds norske/nordiske aviser – en presis, litt kantete grotesk med god variabel vektakse (vi bruker 800 for titler, 420 for brødtekst). Norsk opphav er en fin detalj, og den er ikke «Inter».
- **JetBrains Mono** har `calt`-ligaturer (`->`, `!=`, `=>`, `>=`) og høy x-høyde – gir Terminal-settet sitt tekniske bitt. **IBM Plex Mono** er roligere, uten ligaturer, og passer ved siden av en antikva.

### 3.1 Sett K «Klartekst» (PO-18, slice 6)

Lesbarhet først – for lesevansker, nedsatt syn eller bare slitne øyne. Ingen ornamentikk-varianter: ingen initial,
ingen §-nummer, ingen småkapitéler.

| Rolle | Sett K «Klartekst» |
|---|---|
| Brødtekst, titler, etiketter | **Atkinson Hyperlegible Next** – `@fontsource-variable/atkinson-hyperlegible-next` (wght + italic). Etiketter = sperrede versaler, 700. |
| Kode og metadata | **Atkinson Hyperlegible Mono** – `@fontsource-variable/atkinson-hyperlegible-mono` (wght + italic), uten ligaturer. |

Tokens (`tokens.css`, `[data-type="klartekst"]`): skala 16,5→18,5 px, ratio 1,2→1,25 (Atkinsons store x-høyde gjør at
den leses større enn A ved samme px); `--leading-body` 1.65; vekter 400 / 700 (strong, display, h2) / 600 (h3), h3 ikke
kursiv; `--measure` 34em (≈ 62–66 tegn); radier 3 / 5 / 8 px; `--rule-heavy` 2px; lenkeunderstrek 1,5 px med 0,22em
avstand; `--dropcap: 0`. Komponentene bruker felles grunnstil (ingen `[data-type="klartekst"]`-varianter utover
etiketter, «Tilbakelenker (n) ↓» i margen og temapanelets ramme).

Kvalitetssjekk (2026-11-06): alle 3 typesett × 4 paletter × lys/mørk med axe-core `color-contrast` på `teknisk/Callouts`:
**0 brudd**. Skjermbilder i scratchpad `fe4/`.

---

## 4. Tokens

Fullstendige verdier står i **`tokens.css`** (kanonisk). Her er strukturen og begrunnelsene.

### 4.1 Typeskala (modulær, flytende med `clamp()`)

Skalaen interpolerer lineært mellom viewport 360 px og 1440 px (Utopia-metoden): både grunnstørrelse og ratio vokser med skjermen, så overskrifter får mer kontrast på store skjermer uten å bli for store på mobil.

| Token | A «Tidsskrift» (17,5→19,5 px, ratio 1,2→1,28) | C «Terminal» (15,5→17 px, ratio 1,18→1,25) | Bruk |
|---|---|---|---|
| `--step-n2` | `clamp(0.7439rem, 0.7648rem - 0.0232vw, 0.7595rem)` | `clamp(0.68rem, 0.701rem - 0.0233vw, 0.6957rem)` | mikrotekst (sjelden) |
| `--step-n1` | `clamp(0.9115rem, 0.8979rem + 0.0603vw, 0.9521rem)` | `clamp(0.821rem, 0.8113rem + 0.043vw, 0.85rem)` | sidenoter, bildetekster, tilbakelenke-kontekst |
| `--step-0` | `clamp(1.0938rem, 1.0521rem + 0.1852vw, 1.2188rem)` | `clamp(0.9688rem, 0.9375rem + 0.1389vw, 1.0625rem)` | **brødtekst** |
| `--step-1` | `clamp(1.3125rem, 1.23rem + 0.3667vw, 1.56rem)` | `clamp(1.1431rem, 1.0815rem + 0.2741vw, 1.3281rem)` | h3, ingress (dek), sitat |
| `--step-2` | `clamp(1.575rem, 1.4344rem + 0.6249vw, 1.9968rem)` | `clamp(1.3489rem, 1.2451rem + 0.4611vw, 1.6602rem)` | seksjonstitler (tilbakelenker) |
| `--step-3` | `clamp(1.89rem, 1.668rem + 0.9865vw, 2.5559rem)` | `clamp(1.5917rem, 1.4305rem + 0.7163vw, 2.0752rem)` | h2 |
| `--step-4` | `clamp(2.268rem, 1.9335rem + 1.4868vw, 3.2716rem)` | `clamp(1.8782rem, 1.6396rem + 1.0604vw, 2.594rem)` | tomtilstand-titler |
| `--step-5` | `clamp(2.7216rem, 2.2329rem + 2.1718vw, 4.1876rem)` | `clamp(2.2163rem, 1.8742rem + 1.5203vw, 3.2425rem)` | **h1 (notattittel)** |
| `--step-6` | `clamp(3.2659rem, 2.5679rem + 3.1025vw, 5.3601rem)` | `clamp(2.6152rem, 2.1359rem + 2.1303vw, 4.0531rem)` | reserve |

Øvrige typografitokens per sett:

| Token | A | C | Kommentar |
|---|---|---|---|
| `--leading-body` | 1.6 | 1.55 | |
| `--leading-tight` / `--leading-heading` / `--leading-code` | 1.08 / 1.2 / 1.55 | 1.02 / 1.15 / 1.6 | |
| `--tracking-display` | −0.012em | −0.025em | stramme titler i C |
| `--tracking-sc` / `--tracking-meta` | 0.06em / 0.02em | 0.08em / 0.04em | sperring av etiketter |
| `--weight-body` / `--weight-strong` | 400 / 600 | 420 / 640 | variable vekter i C |
| `--weight-display` / `--weight-h2` / `--weight-h3` | 300 / 400 / 400 | 800 / 720 / 640 | lett antikva vs. tung grotesk |
| `--style-h3` | italic | normal | |
| `--measure` | 33em | 37em | se under |
| `--code-size` | 0.84em | 0.86em | inline-kode |
| `--mono-ligatures` | none | `"calt" 1, "liga" 1` | |

**Målbredde (measure).** Satt i `em` på lesekolonnen (som har `font-size: var(--step-0)`). Målt i Chromium med prototypen: **≈ 65–66 tegn per linje** (snitt inkl. siste linje i avsnitt, dvs. fulle linjer ≈ 70) i A og **≈ 68** i C på 1440 og 1200 px; 44–47 tegn på 390 px mobil.

### 4.2 Spacing, layout, radier, motion, fokus (felles)

```css
--space-1: .25rem; --space-2: .5rem; --space-3: .75rem; --space-4: 1rem;
--space-5: 1.5rem; --space-6: 2rem;  --space-7: 3rem;   --space-8: 4rem;
--space-flow: 1em;                                         /* mellom blokker i brødtekst */
--space-section: clamp(2.5rem, 1.9rem + 2.6vw, 4.25rem);   /* luft før h2 */
--gutter: clamp(1rem, .6rem + 1.8vw, 2.5rem);              /* sidemarg */
--sidebar-w: 16.5rem; --rail-w: 13.5rem; --sidenote-w: 12rem; --topbar-h: 3.25rem;
--dur-instant: 80ms; --dur-fast: 140ms; --dur-base: 220ms; --dur-slow: 360ms;  /* 0ms ved reduced motion */
--ease-out: cubic-bezier(.2,.7,.2,1); --ease-in-out: cubic-bezier(.6,0,.3,1);
--focus-width: 2px; --focus-offset: 2px; --focus-ring: var(--focus-width) solid var(--color-focus);
--z-rail: 10; --z-topbar: 20; --z-drawer: 40; --z-popover: 50; --z-modal: 60;
```

| Token | A | C |
|---|---|---|
| `--radius-s / -m / -l` | 0 / 2px / 3px | 2px / 4px / 6px |
| `--rule-heavy` | 1.5px (svart «redaksjonsstrek» over figurer/tabeller) | 1px |
| `--link-underline` / `-offset` | 1px / .2em | 1px / .18em |
| `--dropcap` | 3 (initial over tre linjer) | 0 |
| `--code-wide` | 2.5rem (kodefigur stikker ut i høyre marg) | 0 |

Fokus: `:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }` – aldri `outline: none` uten erstatning. Fokusfargen er bevisst en *annen* kulør enn lenkefargen i de fleste paletter (f.eks. Papir: blå fokus mot oksblod lenker), slik at fokus synes også på lenker.

### 4.3 Fargetokens (semantiske navn, alle paletter har alle)

| Token | Rolle | Krav |
|---|---|---|
| `--color-bg` | sidebakgrunn | |
| `--color-surface` | hevet flate (embed, diagram, sidepanel i C) | tekst ≥ 4.5 |
| `--color-sunken` | kodebakgrunn, inline-kode i C | tekst ≥ 4.5 |
| `--color-text` | brødtekst | ≥ 4.5 mot bg/surface/sunken |
| `--color-muted` | sekundærtekst, metadata, etiketter | ≥ 4.5 (vi bruker *ikke* «grå tekst under AA») |
| `--color-faint` | **kun dekor** (aldri tekst) | – |
| `--color-rule` / `--color-rule-strong` | hårstreker / kanter på interaktive kontroller | rule-strong ≥ 3 (WCAG 1.4.11) |
| `--color-accent`, `--color-accent2` | aksent / sekundæraksent | ≥ 4.5 (brukes som tekst) |
| `--color-link`, `--color-link-broken` | lenker, brutte lenker | ≥ 4.5 |
| `--color-mark` | `==markering==`, treff i tilbakelenker | tekst på mark ≥ 4.5 |
| `--color-focus` | fokusring | ≥ 3 |
| `--color-selection` | `::selection` | tekst på selection ≥ 4.5 |
| `--hue-blue/teal/green/amber/orange/red/plum/grey` | semantiske kulører (callouts, status) | ≥ 4.5 mot bg og mot callout-tint |
| `--tint` | 8 % (lys) / 12 % (mørk) – styrke på callout-bakgrunn | |

Avledet (felles, i `tokens.css`): `--color-tag-bg` = `color-mix(in oklab, accent 12%, bg)`, `--color-hover` = 6 % tekst, callout-bakgrunn = `color-mix(in oklab, var(--c) var(--tint), var(--color-bg))`.

### 4.4 Palettene

Nøkkelverdier (alt annet i `tokens.css`):

| Palett | Modus | bg | text | muted | accent / lenke | accent2 | Karakter |
|---|---|---|---|---|---|---|---|
| **Papir** | lys | `#f4eee2` | `#211c15` | `#5e5345` | `#9a2b1a` oksblod | `#1f4d6b` | varmt avispapir, rødt blekk |
| | mørk | `#1a1712` | `#ece4d4` | `#ad9f89` | `#f08b6b` | `#8fc1e3` | brunsvart, kobber |
| **Cyanotypi** | lys | `#eef1f1` | `#121d27` | `#4a5a67` | `#174a8c` preussisk blå | `#8a4f00` | kjølig blåkopi |
| | mørk | `#0d1520` | `#dbe4ec` | `#97a7b6` | `#86b9f5` | `#e8b75a` messing | nattblå arkitekttegning |
| **Fosfor** | lys | `#f2f3ee` | `#11150e` | `#4b5544` | `#2c6a0f` | `#8a5300` | papirterminal |
| | mørk | `#0b0d0a` | `#d8dfcf` | `#909a86` | `#a3e66d` fosforgrønn | `#ffb454` rav | CRT, men dempet |
| **Signal** | lys | `#f6f6f3` | `#111111` | `#545450` | `#b8350a` signaloransje (accent `#b23209`) | `#00677d` | sveitsisk, nøytral |
| | mørk | `#111213` | `#e9e9e6` | `#a0a09a` | `#ff8a5a` | `#5cd0e6` | grafitt, varsellys |

Ingen palett bruker lilla som aksent. `--hue-plum` finnes kun for `[!example]`-callouts og typer i kode.

### 4.5 Kontrast – verifisert (WCAG 2.1 AA)

Beregnet med WCAG-formelen (relativ luminans) i et node-script; callout-bakgrunner er regnet ut med samme `color-mix(in oklab, …)` som CSS bruker. **384 kontroller, 0 feil.** Laveste teksttall i hele systemet: 4.59 (kommentar i kode, Papir lys).

| Palett / modus | Tekst/bg | Dempet/bg | Lenke/bg | Brutt lenke/bg | Tekst/markering | Laveste kodetoken | Laveste callout-tittel | Fokusring/bg (≥ 3) |
|---|---|---|---|---|---|---|---|---|
| papir / lys | 14.64 | 6.49 | 6.65 | 4.99 | 12.14 | 4.59 (comment) | 4.93 (orange) | 7.79 |
| papir / mørk | 14.14 | 6.89 | 7.33 | 7.09 | 7.16 | 5.52 (comment) | 5.88 (grey) | 9.28 |
| cyanotypi / lys | 15.02 | 6.27 | 7.72 | 5.61 | 13.45 | 4.78 (comment) | 4.98 (orange) | 4.56 |
| cyanotypi / mørk | 14.25 | 7.44 | 8.97 | 7.50 | 8.30 | 5.82 (comment) | 6.36 (grey) | 9.91 |
| fosfor / lys | 16.55 | 7.02 | 5.93 | 5.45 | 15.64 | 5.11 (number) | 5.03 (orange) | 5.93 |
| fosfor / mørk | 14.29 | 6.65 | 13.10 | 8.28 | 7.07 | 5.40 (comment) | 5.92 (grey) | 11.07 |
| signal / lys | 17.44 | 7.02 | 5.46 | 5.67 | 14.64 | 4.99 (operator) | 4.89 (orange) | 5.99 |
| signal / mørk | 15.42 | 7.14 | 8.07 | 8.21 | 8.43 | 5.70 (comment) | 6.19 (grey) | 10.38 |

Hver palett × modus kontrolleres for: tekst/dempet/lenke mot bg, surface og sunken; accent, accent2, brutt lenke mot bg; tekst mot markering og seleksjon; tag-tekst mot tag-bakgrunn; alle 8 callout-kulører (tittel *og* brødtekst mot tint); alle 14 kodetokens mot kodebakgrunn; fokusring og `rule-strong` (≥ 3, ikke-tekst). I Tidsskrift er callout-bakgrunnen transparent, som gir *høyere* kontrast enn tallene over.

**Regel for fremtidige endringer:** Endres en farge, kjør kontrollen på nytt (QA kan be om scriptet). Ingen tekst under 4.5, heller ikke «diskret» tekst. `--color-faint` skal aldri brukes på tekst.

---

## 5. Kodeblokker (AK14)

### 5.1 Syntax highlighting – Shiki med CSS-variabler

Bruk `shiki` (server- eller byggtid) med temaet i **`shiki-tema.ts`**. Alle farger i output er `var(--shiki-…)`, så tema-bytte er ren CSS – ingen re-highlighting.

Hvorfor eget tema og ikke Shikis innebygde `css-variables`: testet mot shiki 4.6.0 mapper det innebygde temaet strenger til `--shiki-token-string-expression`, typer og JSON-nøkler til `keyword`, og variabler til `constant` – det blir uleselig. Vårt tema bruker **samme variabelnavn** (fullt kompatibelt; faller man tilbake til det innebygde temaet, fungerer fargene fortsatt), pluss fire ekstra.

| Variabel | Treffer (eksempler) | Papir lys | Papir mørk | Cyanotypi lys | Cyanotypi mørk | Fosfor lys | Fosfor mørk | Signal lys | Signal mørk |
|---|---|---|---|---|---|---|---|---|---|
| `--shiki-foreground` | variabler, vanlig tekst | `#2a241c` | `#e6dccb` | `#16222d` | `#d6e0ea` | `#14190f` | `#d8dfcf` | `#151515` | `#e6e6e3` |
| `--shiki-background` | kodeflate | `#ebe3d2` | `#14120e` | `#e1e8ea` | `#09101a` | `#e6e9df` | `#070806` | `#ecece8` | `#0a0a0b` |
| `--shiki-token-keyword` | `public`, `new`, `if`, `var` | `#94281a` | `#f08b6b` | `#174a8c` | `#86b9f5` | `#2c6a0f` | `#a3e66d` | `#b8350a` | `#ff8a5a` |
| `--shiki-token-string` | `"all"` | `#3b6322` | `#b4d38a` | `#2e6630` | `#93d29a` | `#7a5200` | `#ffc761` | `#2f6b1f` | `#9ad67a` |
| `--shiki-token-string-expression` | escapes, `${…}`, `$HOME` | `#1d5f5a` | `#7cc8bd` | `#8a4f00` | `#e8b75a` | `#9a3412` | `#ffb454` | `#a8201a` | `#ff7b72` |
| `--shiki-token-comment` (kursiv) | `// …`, `# …` | `#6f6352` | `#968a76` | `#566673` | `#7f90a1` | `#566050` | `#7d8874` | `#5c5c57` | `#8a8a84` |
| `--shiki-token-constant` | `true`, `null`, `--flagg` | `#8a4a00` | `#e8b45c` | `#9a3d0f` | `#f2a36a` | `#a3420a` | `#ff9e5e` | `#1f4f8f` | `#d9a8f0` |
| `--shiki-token-number` * | `5`, `1490.00` | = constant | | | | | | | |
| `--shiki-token-function` | `put`, `send` | `#1f4d78` | `#8fbde8` | `#0f5f66` | `#6ccfd3` | `#1d4f86` | `#8ab8f0` | `#00677d` | `#5cd0e6` |
| `--shiki-token-type` * | `KafkaProducer`, `@Override` | `#6b3a63` | `#d8a4cf` | `#69407a` | `#cfa6e6` | `#0f605a` | `#6fd6c8` | `#6e3c74` | `#ffc861` |
| `--shiki-token-property` * | JSON-nøkler, YAML-nøkler | = function | | | | | | | |
| `--shiki-token-operator` * | `!=`, `->`, `=` | = keyword | | | | | | | |
| `--shiki-token-parameter` | parametre | `#5a3a17` | `#e8cfa8` | `#5a4a12` | `#e8d3a0` | `#5c3f6a` | `#e2c9f0` | `#6b4a00` | `#f0d0b8` |
| `--shiki-token-punctuation` | `{ } ( ) ; ,` | `#5e5345` | `#ad9f89` | `#4a5a67` | `#97a7b6` | `#4b5544` | `#909a86` | `#545450` | `#a0a09a` |
| `--shiki-token-link` | URL-er i kode | `#1f4d78` | `#8fbde8` | `#174a8c` | `#86b9f5` | `#1d4f86` | `#8ab8f0` | `#1f4f8f` | `#8cb6f5` |

\* = utvidelse utover Shikis innebygde sett. Alle verdier ≥ 4.5 mot kodebakgrunnen (se §4.5).

### 5.2 Anatomi

```html
<figure class="code" data-lang="java">
  <figcaption class="code-head">
    <span class="file">OrdreProdusent.java</span>   <!-- fra ```java title="…" eller ```java:fil; utelates om ikke oppgitt -->
    <span class="lang">java</span>
    <button class="copy" data-copy><svg …/><span>Kopier</span></button>
  </figcaption>
  <pre class="shiki vault-leser" tabindex="0"><code><span class="line">…</span></code></pre>
</figure>
```

| Del | Tidsskrift | Terminal |
|---|---|---|
| Ramme | ingen radius; 1,5 px tekstfarget strek over, hårstrek under; stikker 1rem til venstre (teksten i koden flukter optisk med brødteksten) og `--code-wide` til høyre | 1 px `--color-rule`-ramme, radius 6 px |
| Header | «Fig. *n*» i Spectral SC aksent (CSS-teller `fig`, deles med diagrammer) + filnavn i mono | aksentprikk + filnavn i mono på litt lysere bånd |
| Linjenumre | nei | ja, CSS-teller på `.line::before`, `--color-muted`, `user-select: none` |
| Språkmerke | små bokstaver, mono, høyre side | samme |
| Kopier-knapp | tekstknapp «Kopier» → «Kopiert» (grønn, 1,6 s). `aria-live="polite"`-region annonserer «Kopiert til utklippstavlen». | samme |
| Overflyt | `overflow-x: auto` inne i `pre` – **aldri** horisontal scroll på sidenivå (AK5). Mobil: koden går kant-i-kant (negativ gutter-marg). | samme |
| Fokus | `pre` har `tabindex="0"` så tastaturbrukere kan scrolle | samme |

Inline-kode: Tidsskrift = bare mono, ingen bakgrunn (som i trykk). Terminal = `--color-sunken`-bakgrunn, radius 2 px. I tabeller: renderer setter `<wbr>` etter `.` i lange kodespenn (f.eks. `max.in.flight.<wbr>requests…`) så kolonner brekker pent.

---

## 6. Mermaid (AK15)

Mermaid kan **ikke** lese CSS-variabler (fargeberegningene skjer i JS med khroma) og godtar ikke `color-mix()`. Derfor: les *ferdige hex-tokens* fra `getComputedStyle` ved init og ved hvert tema-bytte, og render diagrammene på nytt fra kilden (lagre kilden i `data-source` på figuren). Last Mermaid lat (`import('mermaid')`) bare når et notat har diagrammer.

```ts
export function mermaidConfig(): MermaidConfig {
  const cs = getComputedStyle(document.documentElement);
  const t = (n: string) => cs.getPropertyValue(n).trim();
  const dark = document.documentElement.dataset.mode === 'dark';
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: t('--font-ui'),
    themeVariables: {
      darkMode: dark,
      fontFamily: t('--font-ui'),
      fontSize: '14px',
      background: t('--color-surface'),
      textColor: t('--color-text'),
      lineColor: t('--color-muted'),
      // flytdiagram
      primaryColor: t('--color-bg'),          primaryTextColor: t('--color-text'),   primaryBorderColor: t('--color-rule-strong'),
      secondaryColor: t('--color-sunken'),    secondaryTextColor: t('--color-text'), secondaryBorderColor: t('--color-rule-strong'),
      tertiaryColor: t('--color-surface'),    tertiaryTextColor: t('--color-text'),  tertiaryBorderColor: t('--color-rule'),
      mainBkg: t('--color-bg'), nodeBorder: t('--color-rule-strong'), nodeTextColor: t('--color-text'),
      clusterBkg: t('--color-sunken'), clusterBorder: t('--color-rule'),
      titleColor: t('--color-text'), edgeLabelBackground: t('--color-surface'),
      // sekvensdiagram
      actorBkg: t('--color-bg'), actorBorder: t('--color-rule-strong'), actorTextColor: t('--color-text'),
      actorLineColor: t('--color-rule-strong'), signalColor: t('--color-muted'), signalTextColor: t('--color-text'),
      labelBoxBkgColor: t('--color-surface'), labelBoxBorderColor: t('--color-rule-strong'), labelTextColor: t('--color-text'),
      loopTextColor: t('--color-muted'), activationBkgColor: t('--color-sunken'), activationBorderColor: t('--color-accent'),
      noteBkgColor: t('--color-mark'), noteTextColor: t('--color-text'), noteBorderColor: t('--color-rule-strong'),
      sequenceNumberColor: t('--color-bg'),
      // tilstand/klasse/ER/gantt/pie
      errorBkgColor: t('--color-bg'), errorTextColor: t('--hue-red'),
      taskBkgColor: t('--color-sunken'), taskBorderColor: t('--color-accent'), taskTextColor: t('--color-text'),
      activeTaskBkgColor: t('--color-mark'), doneTaskBkgColor: t('--color-surface'), critBorderColor: t('--hue-red'),
      todayLineColor: t('--color-accent'), gridColor: t('--color-rule'),
      pie1: t('--hue-blue'), pie2: t('--hue-orange'), pie3: t('--hue-green'), pie4: t('--hue-plum'),
      pie5: t('--hue-teal'), pie6: t('--hue-amber'), pie7: t('--hue-red'), pie8: t('--hue-grey'),
      pieStrokeColor: t('--color-bg'), pieTitleTextColor: t('--color-text'), pieSectionTextColor: t('--color-bg'),
      git0: t('--color-accent'), git1: t('--hue-blue'), git2: t('--hue-green'), git3: t('--hue-orange'),
    },
  };
}
```

Visuelt (se `prototype.html`, figur 1): Mermaid-diagrammet ligger i `<figure class="diagram">` med ramme (`--color-surface`, 1 px rule; i Tidsskrift: tekstfarget strek over, ingen boks), bildetekst under (Tidsskrift: «Fig. *n*» + kursiv; teksten kommer fra en `%% caption: …`-kommentar i mermaid-kilden hvis den finnes, ellers ingen bildetekst) og en **«Forstørr»**-knapp som åpner diagrammet i en modal `<dialog>` på ~96 vw med pan (dra) og zoom (hjul/klyp, `+`/`−`/`0` på tastatur). SVG har `role="img"` og `aria-label` = bildetekst eller «Diagram». Feil i mermaid-syntaks → «ikke støttet»-kortet med feilmeldingen og «Vis kilde».

---

## 7. Komponentspesifikasjoner

Alle komponentene finnes i `prototype.html`; klassenavn der er forslag, ikke krav (B3/B4: React-komponenter i feature-mapper). «A»/«C» = avvik per typesett.

### 7.1 App-layout

```
≥ 1380 px   | sidepanel 16.5rem | gutter | lesekolonne (measure) + sidenotekolonne 12rem | 2.5rem | høyre marg 13.5rem | gutter |
1100–1379   | sidepanel | lesekolonne (sidenoter blir innfelte, klikkbare) | høyre marg |
860–1099    | sidepanel | lesekolonne, sentrert; TOC blir sammenleggbar «Innhold» øverst i notatet; tilbakelenker kun nederst |
< 860       | topplinje (3.25rem, sticky) + lesekolonne; sidepanel = skuff fra venstre |
```

- **Sidepanel** (`<nav aria-label="Vault">`, sticky, egen scroll): vault-navn + «*n* vaults ▾»-bytter (B6) · søkeknapp «Søk i notater ⌘K» · filterbrikker (Alle / Nylig / Bases / aktive tag-filtre med ×) · mappetre med antall (tabulære tall) · tagger med antall · bunnlinje med live-status «● Synkronisert 14.02» (AK12; prikken blinker kort ved ny endring, ikke ved reduced motion) og «Utseende»-knapp. A: transparent, italic vault-navn, søk som understreket felt. C: `--color-surface`-bakgrunn, `~/vault`-prefiks, mono.
- **Høyre marg** (`<aside aria-label="På denne siden">`, sticky): «Innhold» med lesefremdrift (2 px strek), TOC med scroll-spy (aktiv = aksentstrek til venstre + tekstfarge), «Lenker herfra» (inkl. brutte, med «finnes ikke»), «Tilbakelenker» (kompakt, hopper til full seksjon nederst).
- **Mobil (< 860 px):** topplinje med meny (åpner skuff, `aria-expanded`, Esc og klikk utenfor lukker, fokus tilbake til knappen), brødsmule i mono (ellipsis), søk og tema-ikon. Trykkflater ≥ 44 × 44 px. Skuffen er 20rem / 86 vw med dimmet bakteppe. Ingen horisontal scroll på sidenivå – målt 0 px overflyt på 390 px i alle testede kombinasjoner.

### 7.2 Notat-header

Rekkefølge: **brødsmule** (mappesti; A: Spectral SC i aksent, C: mono `~/domene / kafka`) → **tittel** h1 `--step-5` (A: Spectral 300; C: Schibsted 800, −0.032em; `text-wrap: balance`) → **ingress** fra frontmatter `description`/`summary` hvis den finnes (A: kursiv 300; C: dempet `--step-1`) → **properties** → **tagger + metadata**.

- **Properties** = `<dl>`. A: rutenett `repeat(auto-fill, minmax(10.5rem, 1fr))` med Spectral SC-etiketter, svart strek over og hårstrek under. C: «terminal-tabell» – to kolonner `nøkkel  verdi` i mono på `--color-surface` med ramme. Verditype-rendering: lenker (`[[x]]` i property) som wikilinks, URL-er som eksterne lenker med «↗», lister kommaseparert, `status`-lignende felt med statusprikk, datoer formatert norsk (`3. nov. 2026`), tom verdi som kursiv «ikke satt». `tags`, `aliases`, `title`, `description`, `cssclasses` vises ikke i rutenettet (de har egne plasser / er tekniske). `aliases` vises dog som property (nyttig kontekst).
- **Tagger:** A: kursiv Spectral i aksent, `#tag`, ingen bakgrunn. C: mono på `--color-tag-bg`, radius 2 px. Klikk = filtrer sidepanelet på taggen. Nestede tagger vises hele (`#arkitektur/meldinger`).
- **Metadata:** mono, dempet: «Endret 3. nov. 2026, 14.02 · 6 min lesing» (lesetid = ord/220, avrundet opp). `<time datetime>`.

### 7.3 Brødtekst-typografi (det som gjør det «utgitt»)

- **Ingress-avsnitt** (første `<p>` i notatet, klassen `lede`): A: initial over tre linjer (`initial-letter: var(--dropcap)` i aksent, Spectral 300) og **første linje i småkapitéler** (`::first-line { font-family: var(--font-sc) }`). C: første avsnitt i `--step-1`. Hoppes over hvis notatet starter med noe annet enn et avsnitt.
- **h2** nummereres automatisk (CSS-teller): A: «§ 1» i kursiv aksent som *henger i venstremargen* (mobil: over overskriften). C: «01 /» i mono aksent over overskriften, med hårstrek over hele seksjonen. **h3**: A kursiv, C halvfet. Ankerlenke «#» vises ved hover/fokus.
- **Hengende tegnsetting:** `hanging-punctuation: first allow-end last` (virker i Safari = macOS-målplattformen; Chrome ignorerer det). Blokksitat: åpningsguillemet «henger» utenfor tekstkanten i begge nettlesere. A: punktlister med tankestrek henger i margen på ≥ 860 px.
- **Orddeling:** `hyphens: auto` med `lang="nb"` (norsk ordbok i Safari/Chrome på macOS), `hyphenate-limit-chars: 8 4 3`; aldri orddeling i lenker, kode og callout-titler. `text-wrap: pretty` på avsnitt.
- **Sidenoter (fotnoter `[^n]`):** ≥ 1380 px: flyter i margkolonnen ved siden av referansen (A: kursiv `--step-n1`; C: mono 0.74rem). Smalere: referansetallet er en knapp (checkbox-hack eller `<button aria-expanded>`) som felles inn notatet under linjen med en tynn venstrestrek. Ingen fotnoteliste nederst.
- **Blokksitat:** A: kursiv `--step-1`, guillemets i aksent, kilde i småkapitéler. C: halvfet, aksentstrek 3 px til venstre.
- **Markering** `==x==`: `--color-mark`-bakgrunn, radius 2 px, `box-decoration-break: clone`. `%%kommentarer%%` fjernes helt.
- **Oppgavelister:** ekte (deaktiverte) checkboxer med `accent-color: var(--color-accent)`; ferdige punkter dempet med gjennomstreking.
- **Skillelinje** `---`: «⁂» sentrert, dempet.

### 7.4 Wikilinks (AK7, AK9)

| Variant | Utseende | Oppførsel |
|---|---|---|
| Eksisterende `[[x]]`, `[[x\|alias]]` | A: tekstfarge med 1 px **aksent-understrek** (blekk-stil); hover: tekst i aksent, 2 px strek. C: aksentfarget tekst, understrek 45 % opasitet → full ved hover, lett tint-bakgrunn. | Klientside-navigasjon, stabil URL (AK11). Hover-forhåndsvisning er utenfor scope v1. |
| Til overskrift `[[x#h]]` | vises som «x › h» når alias mangler | scroller til overskriften, kort `:target`-markering (fade av `--color-mark`, 1,2 s; ingen ved reduced motion) |
| Til blokk `[[x#^id]]` | «x ^id» når alias mangler | som over, markerer blokken |
| **Brutt** | `--color-link-broken`, **prikket** understrek 1,5 px, liten hevet «?» i mono, `cursor: help`, `title="Notatet «x» finnes ikke ennå"` | Lenker til «ukjent notat»-siden (§7.13). Skilles fra vanlige lenker av farge **og** strekstil (ikke bare farge). |
| Ekstern | som vanlig lenke + «↗» i dempet farge | `target="_blank" rel="noopener noreferrer"` |

Seksjon/blokk som ikke finnes i et eksisterende notat: vanlig lenke til notatet, men en diskret toast «Fant ikke seksjonen «#h»» ved klikk.

### 7.5 Tilbakelenker (AK10)

Egen seksjon etter notatet: A: kraftig strek over, kursiv tittel «Tilbakelenker» + «3 notater» i SC. Hver rad (≥ 700 px to kolonner): **notattittel** (halvfet) + mappesti (mono, dempet) | **kontekstutdrag** (~ 160 tegn rundt lenken, `--step-n1`, dempet) med lenketeksten i `<mark>`. Sortert etter sist endret. Tom tilstand: «Ingen notater lenker hit ennå.» (dempet, ingen illustrasjon). Ulenkede omtaler er utenfor v1.

### 7.6 Embeds `![[x]]` / `![[x#seksjon]]`

Visuelt avgrenset, men ikke en «boks i boksen»-kakofoni:
- A: **dobbel venstrestrek** (1 px + 1 px med 3 px mellomrom), ingen bakgrunn. C: `--color-surface`, 1 px rule, radius 6 px, stiplet skille under header.
- Header: etikett «Innebygd fra» + wikilink «Notat › Seksjon» + «Åpne notat →» til høyre (mono, dempet).
- Innholdet rendres med samme komponenter, `0.94em`. Overskrifter inni embeds degraderes (embed-ens topp-overskrift blir h4-stil, nummereres ikke, havner ikke i TOC).
- Nøsting: maks dybde 3; deretter vises en vanlig lenke. **Syklus** → liten tomtilstand «Innbygging stoppet: syklus `A.md → B.md → A.md`. Notatet vises som lenke i stedet.»
- Bilde-embeds `![[x.png]]`: `<figure>` med `max-width: 100%`, radius `--radius-m`, valgfri bildetekst fra alias; `loading="lazy"`.

### 7.7 Callouts – alle Obsidian-typer, foldbare

`> [!type] Tittel` → `<div class="callout" data-callout="type">`; `> [!type]-` → `<details>` lukket, `> [!type]+` → `<details open>`. Ukjent type → `note`-stil med typenavnet som etikett. Aliaser følger Obsidian (summary/tldr → abstract, hint/important → tip, check/done → success, help/faq → question, caution/attention → warning, fail/missing → failure, error → danger, cite → quote).

| Type | Norsk etikett | Ikon | Kulør-token |
|---|---|---|---|
| note | Merk | blyant | `--callout-note` → `--hue-blue` |
| abstract | Sammendrag | utklippstavle | `--hue-teal` |
| info | Info | i-sirkel | `--hue-blue` |
| todo | Gjøremål | hake i sirkel | `--hue-blue` |
| tip | Tips | lyspære | `--hue-teal` |
| success | Suksess | hake | `--hue-green` |
| question | Spørsmål | ?-sirkel | `--hue-amber` |
| warning | Advarsel | trekant | `--hue-orange` |
| failure | Feilet | kryss | `--hue-red` |
| danger | Fare | lyn | `--hue-red` |
| bug | Feil | bille | `--hue-red` |
| example | Eksempel | liste | `--hue-plum` |
| quote | Sitat | anførselstegn | `--hue-grey` (brødtekst kursiv) |

Anatomi: tittellinje = ikon (1.1em strek-ikon) + **typeetikett** + « — egen tittel» (hvis oppgitt) + chevron (kun foldbare, roterer 90°). Brødtekst innrykket til tittelteksten.
- A: **ingen bakgrunn**, 2 px venstrestrek i kulør, etikett i Spectral SC, egen tittel i kursiv.
- C: tint-bakgrunn `color-mix(in oklab, kulør var(--tint), bg)`, 1 px ramme i 35 % kulør + 3 px venstrestrek, etikett i mono versaler 0.72rem, egen tittel halvfet.
- Fold: `<summary>` er tastaturfokuserbar; ingen høyde-animasjon (unngå layout-hopp); chevron roterer med `--dur-fast`.

### 7.8 Tabeller

«Booktabs»: kraftig strek over og under tabellen, tynn under header, hårstreker mellom rader, ingen loddrette streker, `font-variant-numeric: tabular-nums`, tall høyrejustert (`.num`). A: header i Spectral SC. C: header i mono versaler 0.68rem på `--color-surface`, sebrastriper, 1 px ramme. Alltid pakket i `<div class="table-wrap" tabindex="0" role="region" aria-label="Tabell: …">` med intern horisontal scroll (AK5).

### 7.9 Bases – table view

```
┌ [ikon] Oppgaver.base ·································· 5 resultater ┐
│ Huskeliste 5 │ Kanban 8 │ Arkiv 3                         ← faner   │
│ FILE.NAME                         STATUS     DUE                    │
│ Mine oppgaver 3                                  ← grupperad        │
│ Slå på idempotens i ordre-tjenesten  ◐ doing  2026-11-08            │
│ …                                                                   │
│ ⚠ 1 ukjent nøkkel ignorert: cardSize             ← diskret advarsel │
└─────────────────────────────────────────────────────────────────────┘
```

- Header: kildefil som lenke (for ` ```base `-blokker: «Base i notatet»), totalt antall treff (for aktiv fane).
- **Faner** (flere views): `role="tablist"`, piltaster flytter, `aria-selected`, antall per view i mono. A: kursiv tekst med aksent-understrek på aktiv. C: mono, 2 px aksentstrek.
- Kolonneoverskrifter = property-navn som i Obsidian (`file.name`, `status`). `file.name`-celler er wikilinks. `columnSize` → `style="width: …px"` på desktop; på mobil intern scroll.
- **Gruppering** (`groupBy`): grupperad som `<tr><th colspan>` med gruppenavn + antall; A kursiv, C mono. Tom gruppeverdi → «(ingen)» sist.
- Verdier: status-lignende felt med statusprikk (○ todo, ◐ doing, ● done – form *og* farge), datoer ISO i mono, lister som tagger, boolske som ✓/–.
- Advarsel for ukjente funksjoner/nøkler: én linje under tabellen i mono, dempet, gult varseltrekant-ikon. Krasjer aldri.
- Tom view: «Ingen notater matcher denne visningen» + én forklarende setning (se komponentark).

### 7.10 Bases – kanban

- Kolonner i `groupOrder`, deretter andre verdier alfabetisk, så «(ingen)» sist (kursiv etikett). Kolonnehode: verdi (etikett-stil) + antall.
- Horisontal scroll med `scroll-snap` når kolonnene ikke får plass; kolonnebredde min 13rem (mobil: 82 % av bredden, så neste kolonne «titter frem»).
- Kort: tittel (wikilink, hele kortet klikkbart) + feltene fra `order` (tagger som tagger, øvrige som `nøkkel verdi` i mono). A: kort uten ramme, bare hårstrek under, tittel blir aksent på hover. C: `--color-bg`-kort på `--color-surface`-bane, 1 px ramme → aksent på hover. **Ingen skygger.**
- Read-only (B1): ingen drag-and-drop, ingen «+ legg til».

### 7.11 ⌘K-søkepalett (AK13)

- Modal `<dialog>` (native fokusfelle, Esc lukker, fokus tilbake). 40rem bred, 12vh fra topp. A: 3 px tekstfarget strek øverst, ingen radius. C: hard 6 px offset-«skygge» i `--color-rule-strong` (brutalistisk, ikke blur).
- Felt: `role="combobox"` + `aria-activedescendant`; stor tekst (`--step-1`, A kursiv). Resultater i grupper: **Notater** (tittel + alias i kursiv «alias: …»), **Overskrifter** («Notat › Overskrift»), **Innhold** (tittel + utdrag med treff). Treff understreket i aksent – ikke gul bakgrunn.
- Valgt rad: `--color-tag-bg` + 2 px aksentstrek til venstre. ↑/↓ velger, ↵ åpner, ⌘↵ ny fane. Bunnlinje med `<kbd>`-hint og antall notater i indeksen.
- Tom tilstand før skriving: «Nylig åpnet» (5). Ingen treff: se komponentark.

### 7.12 Temavelger

- Åpnes fra sidepanelets bunnlinje («◐ Utseende») og topplinjen på mobil. Modal `<dialog>`, 24rem.
- **Modus:** segmentert kontroll Lys / Mørk / System (radioknapper; valgt = invertert).
- **Typografi:** tre valg med typografisk prøve «Aa*g*» i Spectral 300, «Aa→» i Schibsted 800 + JetBrains-ligatur og «Il1» i Atkinson Hyperlegible Next 700, navn og én linje beskrivelse.
- **Palett:** fire valg med stripe-prøve (bg · tekst · aksent · aksent2) **i gjeldende modus**, navn og beskrivelse; paletter som anbefales for valgt typesett merkes «Anbefalt».
- Endring gjelder umiddelbart (ingen «Lagre»), lagres i localStorage. Snarvei `⌘.` bytter lys/mørk.
- Overgang ved bytte: bakgrunn/tekst `--dur-base` – ikke for alt (`transition: all` er forbudt).

### 7.13 Tomtilstander og feil

Tone: rolig, konkret, på norsk, sier hva som skjedde og hva man kan gjøre. Ingen illustrasjoner/emoji; ett typografisk glyf («∅») der en hel side er tom.

| Situasjon | Utforming | Tekst (forslag) |
|---|---|---|
| **Ukjent notat** (brutt lenke klikket / ugyldig URL) | Helside: «∅» i aksent, sti i etikett-stil, tittel `--step-4`, forklaring, knapper «← Tilbake» (primær) og «Søk etter «x»», deretter «Lenket fra»-liste | «Dette notatet er ikke skrevet ennå. Lenken *x* peker hit fra 2 notater, men filen finnes ikke i vaultet. Når du oppretter den i Obsidian, dukker den opp her automatisk.» |
| Ingen søketreff | stiplet mini-boks | «Ingen treff for «zookeper». Prøv et kortere ord … Mente du *zookeeper*?» |
| Tom Bases-view | stiplet mini-boks i panelet | «Ingen notater matcher denne visningen» |
| Syklus i embed | stiplet mini-boks der embed skulle vært | «Innbygging stoppet: syklus …» |
| Seksjon finnes ikke | mini-boks i embed / toast ved lenke | «Finner ikke seksjonen «#Oppsett»» |
| **«Ikke støttet»** (LaTeX, Dataview, Canvas, Excalidraw, Mermaid-syntaksfeil) | `role="note"`, stiplet ramme, blokk-ikon, **fet kort tittel** + én setning, `<details>` «Vis kilde» med råteksten i mono | «Dataview vises ikke her. Spørringen kjøres bare i Obsidian.» |
| Vault ikke lesbar / config-feil | helt-linjet ramme i `--hue-red` | «Får ikke lest vaultet. Stien `~/Notater/Arbeid` fra `vault-leser.config.json` finnes ikke. Sjekk konfigurasjonen og start på nytt.» |
| Mistet forbindelse (live reload) | bunnlinja i sidepanelet: prikk blir `--hue-amber`, tekst «Frakoblet – prøver igjen» | |

---

## 8. Tilgjengelighet (AK19) – sjekkliste for frontend/QA

- Kontrast: §4.5 (alle kombinasjoner AA). Ikke-tekst ≥ 3 (fokus, `rule-strong`-kanter på kontroller).
- Lenker har alltid understrek (WCAG 1.4.1). Brutt lenke skilles med strekstil + «?», ikke bare farge. Status i Bases skilles med form (○ ◐ ●), ikke bare farge.
- Synlig `:focus-visible` overalt; fokusfargen avviker fra lenkefargen.
- Landemerker: `nav` (vault), `main` (notat), `aside` (på denne siden); én `h1` per side; overskriftshierarki fra markdown bevares (ikke hopp i nivå i UI-kromet).
- Dialoger med `<dialog>.showModal()`; Esc lukker; fokus returneres.
- Tastatur: `⌘K` søk, `⌘.` lys/mørk, `[`/`]` (valgfritt) skjul sidepanel/marg, `g g`/`G` er utenfor scope. Faner med piltaster, tre med piltaster (ARIA tree er valgfritt i v1; knapper med `aria-expanded` holder).
- `prefers-reduced-motion`: alle `--dur-*` = 0 ms; smooth scroll deaktiveres i JS.
- Zoom 200 % uten tap av innhold; `rem` overalt.
- Utskrift: `@media print` skjuler kromet.

---

## 9. Motion

Lite og funksjonelt: farge/understrek på hover (`--dur-fast`), skuff inn/ut og temabytte (`--dur-base`, `--ease-out`), chevron-rotasjon, fremdriftsstrek. Ingen inngangsanimasjoner på innhold, ingen parallakse, ingen «skeleton shimmer» (notatbytte < 200 ms gjør det unødvendig; vis heller forrige notat til nytt er klart).

---

## 10. Åpne spørsmål til PO

1. **Tredje typesett?** Forslag «Klartekst»: Atkinson Hyperlegible Next (`@fontsource-variable/atkinson-hyperlegible-next`) + JetBrains Mono, for lange økter/svaksynte. Systemet tåler det uten nye paletter.
2. **Initial og nummererte seksjoner** i Tidsskrift er på som standard. Skal de kunne slås av per notat (frontmatter `cssclasses: [ingen-initial]`) eller globalt?
3. **Sidenoter vs. fotnoteliste** – vi har valgt marginalia/innfelte noter og *ingen* fotnoteliste. OK?
4. **Ingress fra frontmatter:** hvilket felt brukes i vaultet – `description`, `summary` eller ingen? Hvis ingen, vises ikke ingress.
5. **Hvilke properties skal skjules** i notat-headeren utover `tags/aliases/title/description/cssclasses`?
6. **Lesetid** («6 min lesing») – ønsket, eller støy for tekniske notater?

---

## 11. v1.1 – Lesekomfort og tastaturstyring

Bindende grunnlag: `docs/produkt/v1.1-spesifikasjon.md` (F1–F7, P1–P7) og PO-53 til PO-61 i `docs/beslutninger.md`.
Referanse: **`prototype-v1.1.html`** (selvstendig, alle tre typesett, alle paletter, lys/mørk). Skjermbilder i `skjermbilder/v1.1/`
(1440 px og 390 px; filnavnene sier funksjon, typesett, palett og modus).

**Prototypen styres med URL-parametre** (i tillegg til `type`, `palette`, `mode` fra v1):
`width=full`, `diskret=1`, `zen=1` (+ `hint=1&hold=1` for å vise hintet), `fold=alle` eller `fold=id1,id2`,
`open=palette|cmd|refcard|theme|whichkey|toast`, `q=` (forhåndsutfylt tekst, f.eks. `q=tema%20`), `side=base`
(kontekst der kommandoer er deaktivert), `os=pc` (viser Ctrl i stedet for ⌘). Alle tastene i spesifikasjonen virker.

### 11.1 Prinsipper for v1.1

1. **Vim i ånden, ikke i pynten.** Vi låner vims *ordforråd*, som foldcolumn (`−`/`+`), foldtekst (`+-- 86 ord ····`),
   `-- KOMMANDO --`, `showcmd`, `E492` og which-key. Lånet er sterkest i Terminal og oversettes til typografi i Tidsskrift
   (`§`, `⋯`, småkapitéler) og til klartekst i Klartekst. Ingen «hacker-estetikk» med grønn-på-svart utenfor Fosfor.
2. **Moduser skal være synlige, men stille.** Hver tilstand som endrer hva brukeren ser, har en diskré indikator:
   statuslinjeflagg `[full]` og `[diskré]`, `zen · Esc` i hjørnet, og `-- KOMMANDO --` i paletten. Ingen bannere.
3. **Én DOM, CSS bestemmer plasseringen.** Kildelenken, sidenotene og fold-pilen har ett element hver. Media- og
   attributtregler flytter dem (marg, i flyt eller ved linjeslutt). Frontend bygger én gang.
4. **Touch er ikke en ettertanke.** Alt som vises «ved hover», er alltid synlig og dempet når `(hover: none)` gjelder,
   med trykkflate på minst 44 × 44 px.
5. **Ingen ny farge uten avledning.** Alle nye farger er avledet av palett-tokens og kontrollert med skript (§11.9).

### 11.2 Nye tilstander og tokens

| Tilstand | Settes | Huskes |
|---|---|---|
| `html[data-width="optimal\|full"]` | Utseende, `Space w`, `:bredde` | `localStorage['vault-leser.bredde']`. Settes i tema-init-scriptet før første maling (ingen hopp). |
| `.page[data-embeds="diskret\|vanlig"]` | Utseende, `Space d`, `:diskret` | `localStorage['vault-leser.diskret:<vault-id>:<notatsti>']` |
| `html[data-zen]` | Utseende, `Space z`, `:zen`; avsluttes også med `Esc` | Aldri (F4) |
| Foldet seksjon | pil, `za`, `zM`, `zR` | Aldri (F3). Overskriften får `data-folded`, skjulte blokker får `data-folded-by="<id>"`. |

Nye tokens (se `tokens.css`, blokken «v1.1»):

| Token | Verdi | Bruk |
|---|---|---|
| `--leader-delay` | 400ms | which-key vises etter `Space` + så lenge uten neste tast. JS leser den med `getComputedStyle`. |
| `--sequence-timeout` | 1000ms | `gg`, `za`, `Space w` … avbrytes etter dette (**pauses mens which-key vises**, §11.8) |
| `--hint-linger` | 4000ms | zen-hint |
| `--fold-col` | 1.1rem | fold-kolonnens avstand fra tekstkanten (= §-avstanden i v1) |
| `--embed-bracket` | −1rem | x-posisjon for hover-klammen på diskré embed (til **høyre** for spalten) |
| `--refcard-w` / `--whichkey-w` | 54rem / 34rem | |
| `--z-hint` | 45 | which-key, showcmd, zen-hint, zen-utgang (over skuffen, under popover og toast) |
| `[data-width="full"]` | `--measure: none; --code-wide: 0` | |
| `--leading-body` i full bredde | A 1.68 · C 1.62 · K 1.74 | Lange linjer trenger mer luft for at øyet skal finne neste linje. |
| `--color-kbd-bg` | `color-mix(in oklab, sunken 55%, surface)` | tasttegn |
| `--color-kbd-fg` / `--color-kbd-edge` | text / rule-strong | |
| `--color-kbd-edge-active` | muted | tasttegnkant i **valgt** rad (rule-strong gir bare 2,5:1 der) |
| `--color-row-active` | = tag-bg | valgt rad i palett og underliste |
| `--color-cmd` | = accent | `:`-prompt, kommandomodus-strek, leder-tast |
| `--color-disabled` | = muted (≥ 4,5) | deaktiverte kommandoer – **aldri** grå under AA |
| `--color-fold-leader` | = faint | prikkede ledere i fold-linjen – kun dekor |
| `--color-src-rule` | = rule-strong | hover-klammen |
| `--color-veil` | bg 92 % | bak zen-utgangen på touch |

**Tasttegn (`.k`).** Én kbd per *tastetrykk*. En akkord er ett tegn (`⌘K`, `Ctrl d`, `⌘.`), og en sekvens er flere
tegn tett etter hverandre (`g` `g`, `Space` `w`). Alternativer skilles med en dempet `/`. `Space` (lederen) tegnes alltid
med `--color-cmd`, slik at alle leder-kombinasjoner gjenkjennes på et blikk. På macOS viser vi `⌘`, ellers `Ctrl`.
Tasttegnet har 2 px underkant (tastaturfølelse) og radius `--radius-m` (Tidsskrift: `--radius-l`).

### 11.3 F1 Lesebredde

Skjermbilder: `01-bredde-optimal-…`, `01-bredde-full-tidsskrift-…`, `01-bredde-full-terminal-…`, `01-bredde-full-klartekst-…`.

- `.col { max-width: none }`. Ved ≥ 1380 px fjernes også den reserverte sidenotekolonnen (`margin-right: 0`).
  Ved 1440 px vokser brødtekstspalten fra ≈ 607 px (33em) til ≈ 832 px. **Uten** dette ville full bredde gitt *null*
  gevinst i Tidsskrift ved 1440 px, fordi lesespalten + margkolonnen allerede fyller rommet mellom panelene.
- **Sidenoter har tre plasseringer, én DOM:**
  1. *Marg*: leseoptimalisert ≥ 1380 px (som v1), og i zen ≥ 1100 px (panelene er borte, så margen finnes).
  2. *Innfelt marginalia*: full bredde ≥ 1100 px i Tidsskrift og Terminal. Noten flyter til høyre **inne i** spalten
     (`float: right; width: var(--sidenote-w)`), med 1 px venstrestrek, og teksten løper rundt den. Typografien er den
     samme som i margen (A kursiv, C mono), så marginalia beholder identiteten sin. Figurer, tabeller, callouts,
     innrammede embeds, blokksitat, h2/h3 og fotnotelisten får `clear: right`, så de aldri presses smale ved siden av en note.
  3. *Fotnoteliste nederst* (PO-20): alle andre tilfeller, **og alltid i Klartekst i full bredde**. Tekst som løper
     rundt flytere, er dårlig for lesbarheten, og det er hele poenget med Klartekst.
- **Kodefigurer:** `--code-wide` blir 0 (det finnes ingen marg å stikke ut i). Tidsskrift beholder −1rem til venstre,
  slik at koden flukter optisk. Kode med intern scroll som før.
- **Initial og småkapitél-linje:** uendret. En hel småkapitél-linje på ≈ 90 tegn er tradisjonell tidsskriftsats og tåles fint.
- **Ingress** (`.dek`) og **properties** beholder lesevennlig bredde (34em), fordi de er «tittelside», ikke brødtekst.
- **§-nummer og hengende tegn:** uendret.
- **Indikator:** statuslinjeflagget `[full]` i sidepanelets bunn (mono, dempet, klammer som vims `[+]`). Det er en knapp
  som bytter tilbake (`title="Full bredde er på – Space w bytter"`). Leseoptimalisert er standard og har derfor ikke noe flagg.
- Bytte gir toast «Full bredde» / «Leseoptimalisert bredde» med tasttegn `Space w`.

### 11.4 F2 Diskré embedding

Skjermbilder: `02-embed-vanlig-…` (referanse, uendret v1), `02-embed-diskret-hover-tidsskrift-…` (margvariant),
`02-embed-diskret-hover-terminal-…` (full bredde, variant under innholdet), `02-embed-diskret-feilkort-…`, `m-notat-touch-…`.

**Anatomi**

```html
<div class="embed is-diskret">            <!-- ingen landemerke/rolle: teksten skal leses som én -->
  <h2 id="leveransegarantier">Leveransegarantier</h2>   <!-- ekte nivå, jf. under -->
  <p>…</p> <ul>…</ul>
  <div class="embed is-diskret">…</div>    <!-- nestet arver -->
  <a class="embed-src" href="…" aria-label="Kilde: Leveransegarantier – åpne notatet">
    <span class="src-k">fra</span><span class="t">Leveransegarantier</span></a>   <!-- SISTE barn: leses som sitatkilde -->
</div>
```

- Ingen ramme, bakgrunn, etikett eller knapp. Blokkene får samme `--space-flow` som brødteksten. Skriftstørrelsen er 1em,
  ikke 0,94em som i vanlig embed.
- **Overskriftsnivå:** notattittelen = nærmeste foregående overskrift i *vertsnotatet* + 1 (h1-tittelen teller som nivå 1,
  maks h6). Notatets egne overskrifter forskyves med samme avstand: tittelnivå − 1. Seksjonsembed: seksjonens overskrift får
  samme regel, og underoverskriftene forskyves med (nytt nivå − kildenivå). Blokkembed: ingen overskrift. (Forskyvningen
  av underoverskrifter er en presisering, se åpne spørsmål.)
- **§-nummer og TOC:** en diskré h2 er en vanlig h2. Selektoren for nummerering må derfor nå gjennom diskré omslag:
  `.prose > h2, .prose .embed.is-diskret > h2` (ikke `.prose > h2` alene). Overskrifter i *innrammede* embeds nummereres
  ikke og kan ikke foldes (PO-54). I v1.1 rendres tittelen der som `<p class="embed-title">` med h4-stil i stedet for en
  `<h4>`. Det fjerner axe-bruddet `heading-order` som v1 hadde når en embed sto rett under h1.
- **Hover-klammen:** `::before` på omslaget, 1 px `--color-src-rule` **til høyre for spalten** (`right: var(--embed-bracket)`),
  og i Tidsskrift som dobbel hårstrek, et «spøkelse» av den vanlige embed-streken. Den står på høyre side fordi venstre marg
  allerede bærer §-nummer, fold-kolonne og hengende listestreker (en venstreklamme krysset dem i første utkast), og fordi
  den da peker mot kildelenken i margen. Opasitet 0 → 1 på `:hover`/`:focus-within`, `--dur-fast`. Klammen starter ved
  første tekstlinje, ikke i luften over en h2.
- **Kildelenken, tre plasseringer:**
  1. *Margen* (pekeenhet, ≥ 1380 px leseoptimalisert, eller zen ≥ 1100 px): absolutt i margkolonnen, på høyde med første
     tekstlinje, og ser ut som en sidenote. A: «FRA» i småkapitéler + kursiv tittel. C: `↳ fra Tittel` i mono.
     K: «fra Tittel» i mono.
  2. *Under innholdet* (pekeenhet uten marg, også full bredde): absolutt, høyrestilt i luften under siste blokk. Den
     tar ikke plass, så det blir null layoutskift når den vises.
  3. *Touch* (`hover: none`, PO-60): alltid synlig, dempet (`--color-muted`), i flyt og høyrestilt. Klammen er alltid
     synlig i `--color-rule`.
  Lenketeksten: notat → «Tittel», seksjon → «Tittel › Seksjon», blokk → «Tittel ^id». Hover gir lenkefarge og hel understrek.
  Tastatur: lenken er et vanlig tab-stopp. Fokus inni omslaget (også på lenker og fold-piler) viser klamme og lenke.
- **Nestet:** arver diskré. Den indre klammen ligger 0,4rem innenfor den ytre, og den indre kildelenken står alltid
  under sitt eget innhold (aldri to lenker i margen).
- **Feilkort (alltid synlige):** `mini-state` med stiplet ramme, blokk-ikon, etiketten «Innebygd notat», fet
  «Fant ikke «Outbox-mønster»» og én setning. De er *identiske* i begge moduser, fordi kortet må skille seg ut nettopp når
  resten glir inn.
- **Indikator:** statuslinjeflagget `[diskré]` (bare på notatet det gjelder). Toast ved bytte (PO-59):
  «Diskré embedding **på**/**av** for dette notatet» + `Space d`.
- Baser og bilder er uendret.

### 11.5 F3 Folding

Skjermbilder: `03-fold-hover-tidsskrift-…` (pil ved hover, foldet §2), `03-fold-alle-terminal-…`, `03-fold-alle-tidsskrift-papir-dark`,
`m-fold-touch-terminal-…`.

**Fold-pilen** er en `<button class="fold" aria-expanded aria-controls aria-label="Fold sammen «X»" title="Fold sammen (za)">`
som *siste barn* av overskriften. Hover på knappen er da også hover på overskriften.

| | Pekeenhet ≥ 860 px | Smal skjerm eller touch |
|---|---|---|
| Plassering | **Fold-kolonnen** i venstre marg: `right: calc(100% + var(--fold-col))`, vertikalt sentrert på overskriftens første linje | Slutten av overskriftens første linje (`padding-right: 2.25rem` på overskriften), trykkflate 44 × 44 px |
| Synlig | ved `:hover`/`:focus-within` på overskriften, eller når foldet | alltid (`hover: none`): dempet (`--color-muted`), foldet = aksent |
| Tidsskrift h2 | **Chevronen tar §-tegnets plass, og nummeret blir stående:** «§ 1» → «⌄ 1» (h2::before tones ut, og knappen tegner chevron + `counter(sec)` på samme sted). Ingen kollisjon i den smale margen (≈ 52 px), og «§» blir selve håndtaket. | § står over overskriften som i v1. Pilen står ved linjeslutt. |
| Terminal | vims foldcolumn: `−` åpen, `+` foldet, i mono. h2: på linjen med «01 /» | samme tegn, ved linjeslutt |
| Klartekst | chevron 1,2rem, strek 2 | chevron |
| Ornamentikk av (PO-19) | bare chevron (ingen nummer) | |

Pilen roterer 90° → 0° (`--dur-fast`). Fargen er dempet i hvile, aksent ved hover, og aksent når seksjonen er foldet.

**Fold-linjen** (indikator for skjult innhold) settes inn rett etter den foldede overskriften. Den har `aria-hidden="true"`
(knappen bærer tilstanden) og kan klikkes for å utfolde:

| Typesett | Utseende |
|---|---|
| Tidsskrift | `⋯` (aksent) · *86 ord · 1 figur* (kursiv) · prikket leder · UTFOLD (småkapitéler) |
| Terminal | `+-- 86 ord · 1 figur · · · · · · · · · za` (vims foldtext, med mono og prikker i `--color-fold-leader`) |
| Klartekst | `▸ 86 ord · 1 figur` … «Vis innholdet» (understreket) |

Tellingen gjelder ord og figurer (kode, diagram, tabell) i den skjulte delen.

**Seksjonsgrenser:** en seksjon løper til neste overskrift på samme eller høyere nivå i *lesefølge*, der diskré
embed-omslag er gjennomsiktige (én sammenhengende tekst). Fotnotelisten er aldri del av en seksjon. En diskré embed der
alt er foldet bort, skjuler også kildelenken sin.

**Animasjon:** folding går umiddelbart, og fold-linjen tones inn (`--dur-base`). Ved utfolding får de avdekkede blokkene
`opacity 0 → 1` og `translateY(−0.35rem → 0)` (`--dur-base`, `--ease-out`). Vi animerer **ikke** høyde, av samme grunn
som for callouts: det gir layouthopp, og Safari mangler `interpolate-size`. Under `prefers-reduced-motion` er alt 0 ms.
**Leseposisjonen holdes:** overskriften som foldes, står stille i viewporten (scroll-kompensasjon), også når innhold over
leselinjen forsvinner.

**`za`:** bruker samme leselinje som TOC, 30 % ned i viewporten (PO-53), eller fokusert overskrift. Overskriften blinker
kort (`--color-mark`, 0,9 s) og fokus flyttes til pilen. `zM` folder alle nivåer (og vi står da øverst), og `zR`
utfolder alt. Begge gir en kort toast med motsatt tast.

### 11.6 F4 Zen

Skjermbilder: `04-zen-tidsskrift-papir-dark` (med førstegangshint), `04-zen-full-terminal-fosfor-light`, `m-zen-terminal-fosfor-dark`.

- `html[data-zen]`: sidepanel, høyre marg, topplinje, statuslinje og innebygd TOC skjules. `.app` og `.main` får én kolonne,
  og `.col` sentreres (`margin-inline: auto`). Ekstra luft øverst (`clamp(2.5rem, 1rem + 6vw, 7rem)`). Tittel og
  properties beholdes.
- **Tidsskrift i zen = Tufte-oppslag:** *tekstspalten* sentreres optisk, og marginalia henger fritt til høyre. Sidenoter
  og kildelenker går i margen allerede fra 1100 px, fordi panelene er borte.
- **Zen + full bredde:** `padding-inline: clamp(1rem, 7vw, 8rem)`, sidenoter innfelt (§11.3).
- **Overgang:** View Transitions API. `.col` (`view-transition-name: lesekolonne`) glir til midten (`--dur-slow`,
  `--ease-in-out`), og panelene tones ut og inn (`--dur-base`). Uten API-støtte eller med reduced motion: umiddelbart.
- **Avslutt zen (PO-61):** knappen `.zen-exit` er fast i øvre høyre hjørne og viser «zen [Esc]». På desktop er den usynlig
  i hvile og vises ved musebevegelse (i 1,8 s), hover eller fokus. Den er også et vanlig tab-stopp. På touch er den alltid
  synlig: et 44 px «✕» på `--color-veil`. Knappen er samtidig modusindikatoren.
- **Førstegangshint:** de tre første gangene (`localStorage['vault-leser.hint.zen']`) vises et kort nederst i midten:
  «**Zen** Panelene er skjult – tastene virker som før. [Esc] eller [Space][z] tar deg tilbake.» Det forsvinner etter
  `--hint-linger`. Touch-tekst: «Trykk ✕ øverst til høyre for å gå tilbake.» Det er `role="status"`, så skjermlesere får det.
- Zen kan også slås på fra Utseende (lenkerad nederst i panelet). Navigasjon mellom notater beholder zen. `Esc` går ut
  når ingen dialog er åpen og ingen sekvens er påbegynt.

### 11.7 F5 Kommandopalett med `:`

Skjermbilder: `05-palett-kommando-…`, `05-palett-kommando-sok-…` (fuzzy), `05-palett-tema-…`, `05-palett-palett-…`,
`05-palett-deaktivert-base-…`, `05-palett-feil-…`, `m-palett-kommando-…`.

**Moduser i samme dialog** (samme størrelse og plassering, så det aldri hopper):

| | Søk (`⌘K`, `/`) | Kommando (`:`) |
|---|---|---|
| Ikonfelt | forstørrelsesglass | **`:`-prompt** i mono, `--color-cmd` |
| Felt | `--step-1`, kursiv i A | mono, ikke kursiv, 0,86 × `--step-1`, aksentfarget markør |
| Kant | A: 3 px tekstfarge øverst | A: øverste strek blir `--color-cmd`. C: 3 px aksentstrek til venstre i feltraden. K: hele rammen i aksent |
| Bunnlinje | `søk` · ↑↓ velg · ↵ åpne · ⌘↵ ny fane · `:` kommandoer · 2 041 notater | `-- KOMMANDO --` (C, med vims streker) / *kommando* (A, småkapitéler) · ↑↓ velg · ⇥ fullfør · ↵ kjør · ⌫ på tom linje: tilbake til søk |

**Prompten står utenfor feltet** (vim-oppførsel): `:` som første tegn i søk bytter modus og blir prompt, og `⌫` på tom
linje går tilbake til søk. Feltets tilgjengelige navn bytter mellom «Søk i notater» og «Kommando». Se åpne spørsmål
(spesifikasjonen sier «forhåndsutfylt med `:`»).

**Kommandorad:** rutenett `[:alias] [navn + nå-tilstand] [taster]`.
- `:bredde` i mono, dempet. Fuzzy-treff i `--color-cmd`, halvfet og understreket. Argumentkommandoer viser `:tema ‹typesett›`.
- Navnet i UI-fonten, med nå-tilstanden etter i dempet mono («nå: full», «nå: av»). Det gjør veksle-kommandoer forutsigbare.
- Hurtigtaster helt til høyre som tasttegn. `Space` i aksent.
- **Deaktivert:** `aria-disabled="true"`, hele raden i `--color-disabled` (fortsatt ≥ 4,5:1), og en forklaringslinje under
  navnet («Gjelder bare notater med innebygde notater – dette er en .base-side»). Raden kan velges med piltaster, slik at
  skjermlesere leser forklaringen. `↵` gir bare forklaringen som toast.
- Tom linje: alle kommandoer gruppert som **Visning, Lesing, Søk og kommandoer, Navigasjon** (mest brukt først). Med tekst:
  sortert etter treff, uten grupper.

**Underlister** (`:tema `, `:palett `): `↵` eller `⇥` på en argumentkommando fyller ut `tema ` og viser verdiene.
Overskriftsraden er `:tema` + «VELG TYPESETT». Tema-rader har typografisk prøve («Aa», «Aa», «Il1» i egen font), navn og
én linje beskrivelse. Palett-rader har firefelts stripe (bg · tekst · aksent · aksent2) **i gjeldende modus** og
«anbefalt for …». Gjeldende verdi er merket «● NÅ». Det kan filtreres videre: `:tema ter`.

**Feil:** ukjent kommando gir et stiplet kort «**E492** Ingen kommando heter «wq». Prøv `:hjelp` …». Ugyldig argument gir
«**E475** Ugyldig argument …». Feilkodene er vims egne, et lite nikk til kunden. De står i mono, `--hue-red`, foran en
vanlig norsk setning, så de ikke er til hinder for andre.

Ekstra taster i paletten: `Ctrl n`/`Ctrl p` er alternativer til ↓/↑ (vim). `⌘K` lukker.

### 11.8 F6 Hurtigtastoversikten (`?`) og F7 which-key

**Oppslagskortet** (`06-taster-…`, `m-taster-…`) er en modal `<dialog class="refcard">`, 54rem, og lukkes med `Esc` eller `?`.
- Hode: «Hurtigtaster» i display-fonten, under det «Normal-modus · leder er [Space]». **Terminal** får en man-side-topp:
  `VAULT-LESER(1)    Normal-modus    VAULT-LESER(1)`.
- To spalter (`columns: 2 21rem`, grupper brytes ikke), og én spalte under ca. 760 px. På mobil er kortet et fullskjermark.
- Grupper i spesifikasjonens rekkefølge: Navigasjon, Lesing, Visning, Søk og kommandoer. Gruppehoder: A småkapitéler med
  kraftig strek over (booktabs). C mono-versaler i aksent med strek som løper ut. K sperrede versaler med 2 px strek.
- Rader: `[taster 8.75rem] [beskrivelse]`, med valgfri dempet underlinje (A kursiv). Par slås sammen («`j` / `k` Rull ned / opp»),
  styrt av registeret (`pair`). Hårstreker mellom rader i A og K, luft i C.
- Under Visning: «Bare som kommando: `:tema` `:palett` `:lys` `:mørk`». Bunn: «Esc eller ? lukker · :hjelp åpner også
  dette kortet» og «Reservert for redigering senere: i a o e I A O s c d x p y u r». Det siste er ærlig om P4, og en
  vim-bruker vil lure på hvorfor `i` ikke gjør noe.
- **Alt genereres fra registeret** (prototypen gjør det samme: `REG` → kort, palett og which-key).

**Which-key** (`07-whichkey-…`):
- Plassering: fast, nederst i midten (`bottom: var(--space-5)`), 34rem. Den legger seg *over* teksten der leseren
  allerede ser, ikke i et hjørne.
- Innhold: hode `[Space] LEDER … Esc avbryter`, og et rutenett med `[w] lesebredde full`, `[d] diskré embedding av`,
  `[z] zen`, `[m] lys / mørk`, `[t] utseende`. Tasten står i `--color-cmd`, og nå-tilstanden helt til høyre i dempet mono.
  C: `w → lesebredde` i mono. A: kursiv.
- Flate: `--color-surface`, 1 px rule-strong. A: 2 px tekstfarget strek øverst, ingen radius. C: hard 4 px skygge.
- **Timing:** vises etter `--leader-delay` (400 ms) uten neste tast. Raske brukere ser den aldri. Toning og 0,35rem løft
  (`--dur-fast`). **Mens den vises, er sekvens-tidsavbruddet satt på pause.** Den lukkes på neste tast, `Esc`, klikk
  utenfor eller tap av vindusfokus. Ellers ville hintet forsvunnet etter 600 ms (1 s − 400 ms), før man rakk å lese det.
- `role="status"`, `aria-live="polite"`.

**showcmd** (vim): en liten mono-boks nederst til høyre som viser påbegynte sekvenser (`g`, `z`, `␣`) med en gang. Den
gir trygghet ved `gg`/`za` og forklarer hvorfor neste tast «ble spist». Den er `aria-hidden` og forsvinner når sekvensen
fullføres eller avbrytes.

**`Space` på fokusert knapp** beholder vanlig funksjon (PO-56). Prototypen gjør dette for knapper, lenker, summary,
brytere og radioknapper.

### 11.9 Utseende og kontrast

**Utseende** (`08-utseende-…`): ny gruppe **Lesing** mellom Modus og Typografi:
- segmentkontroll «Leseoptimalisert | Full bredde» med små spalte-ikoner (`#w-narrow` / `#w-full`)
- bryter «Diskré embedding», med beskrivelse «Bare dette notatet · innebygde notater glir inn i teksten».
  På en .base-side: deaktivert (stiplet), med beskrivelsen «Ikke tilgjengelig – .base-sider har ingen innebygde notater».
- Lenkerad nederst: «Zen [Space][z]» og «Alle hurtigtaster [?]» (F6, PO-61).

**Kontrast** (§4.5-regelen gjelder fortsatt):
- `node docs/design/kontrast-v1.1.mjs` leser palettene fra `tokens.css`, regner ut de avledede fargene med samme
  `color-mix(in oklab)` som CSS og sjekker 28 nye kombinasjoner × 24 (3 typesett × 4 paletter × 2 moduser) = **672
  kontroller, 0 brudd**. Laveste verdier: treff i aksent på valgt rad 4,86 (Signal lys), deaktivert på valgt rad 5,14
  (Cyanotypi lys), tasttegnkant 3,02–3,04 (krav 3). Første kjøring fant ett reelt brudd: tasttegnkanten på valgt rad var
  2,49. Det løste vi med `--color-kbd-edge-active`.
- **axe-core 4 i nettleser** på `prototype-v1.1.html`: alle 24 kombinasjoner × 8 tilstander (fold med hover, `:`-liste,
  `:tema`-underliste, oppslagskort, which-key, zen + full + hint, deaktiverte kommandoer på base, Utseende) =
  192 kjøringer, **0 brudd**. Underveis fant vi og rettet: tag-tellere med `opacity .8` (arv fra v1-prototypen),
  `heading-order` for innrammet embed rett under h1 (se §11.4) og to dempede spenn med opasitet.
- **Regel:** ingen `opacity` på tekst for å «dempe». Bruk `--color-muted` eller `--color-disabled`.

### 11.10 Sjekkliste for frontend og QA (v1.1)

- [ ] `data-width` settes i tema-init-scriptet (ingen hopp ved oppstart). Ingen horisontal sidescroll ved 360 px i noen
      tilstand (prototypen er målt til 0 px overflyt i 31 skjermbilder).
- [ ] Sidenoter: tre plasseringer etter §11.3. `clear: right` på blokkelementene i full bredde.
- [ ] §-telleren og TOC tar med `.embed.is-diskret > h2`. Innrammede embeds bruker `.embed-title`, ikke `<h4>`.
- [ ] Kildelenken er siste barn, får fokus med Tab og er synlig på touch.
- [ ] Fold-knappen er siste barn av overskriften, med `aria-expanded`, `aria-controls` og et dynamisk `aria-label`.
      Fold-linjen har `aria-hidden`.
- [ ] Scroll-kompensasjon ved folding. `za` bruker 30 %-linjen. Blink og fokus på pilen.
- [ ] Zen: View Transitions med reservevalg, `.zen-exit` i hjørnet og hint de tre første gangene.
- [ ] Palett: prompt utenfor feltet, `⌫` på tom linje, `⇥` fullfører, deaktiverte rader kan velges, underlister.
- [ ] Which-key pauser sekvens-tidsavbruddet. showcmd.
- [ ] Alle tidskonstanter leses fra tokens (`--leader-delay`, `--sequence-timeout`, `--hint-linger`).

### 11.11 Åpne spørsmål (v1.1)

1. **`:` forhåndsutfylt vs. prompt.** Designet viser `:` som prompt utenfor feltet (vim-oppførsel, `⌫` på tom linje går
   tilbake til søk). Spesifikasjonen sier «forhåndsutfylt med `:`». Hvis tester sjekker `input.value === ':'`, kan
   frontend beholde `:` i verdien og bare *tegne* den som prompt (første tegn skjult med innrykk). Visuelt blir det likt.
2. **Taklengde i full bredde.** Spesifikasjonen sier at teksten flyter over all tilgjengelig bredde. På 2560 px-skjermer gir
   det ≈ 200 tegn per linje. Vil kunden ha et tak (for eksempel 120ch), eller er «full» bokstavelig?
3. **Underoverskrifter i diskré notatembed** forskyves med (tittelnivå − 1). Spesifikasjonen sier bare noe om tittelen.
   Vi trenger en bekreftelse.
4. **Which-key og sekvens-tidsavbrudd:** designet pauser tidsavbruddet mens hintet vises. Arkitekten må bekrefte at
   tastaturmotoren støtter det.
5. **Fold-pilen på Tidsskrift h2 bytter ut «§»** ved hover og når seksjonen er foldet. Er det greit for kunden at
   §-tegnet midlertidig blir et håndtak?
6. **Statuslinjeflagg** finnes bare i sidepanelet. På mobil (< 860 px) er Utseende eneste sted man ser at full bredde
   eller diskré er på. Skal topplinjen få et lite flagg?
