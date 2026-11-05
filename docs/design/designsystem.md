# Designsystem – Vault-leser

Eier: UX/webdesign. Bindende grunnlag: `docs/produkt/brief.md` (særlig B9, B10, AK2–AK3, AK5–AK6, AK8–AK9, AK13–AK16, AK19).

**Filer i `docs/design/`**

| Fil | Hva |
|---|---|
| `designsystem.md` | Dette dokumentet: prinsipper, tokens, komponentspesifikasjoner |
| `tokens.css` | **Kanonisk kilde** for alle CSS custom properties (generert, kontrastverifisert). Importeres som den er. |
| `shiki-tema.ts` | Shiki-tema der alle farger er `var(--shiki-*)` – ett tema for alle paletter |
| `prototype.html` | Selvstendig referanse (fonter innebygd som base64, ingen nettverkskall). Åpne direkte i nettleser. |
| `skjermbilder/` | Skjermbilder 1440 px og 390 px i flere kombinasjoner |

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
<html lang="nb" data-type="tidsskrift|terminal" data-palette="papir|cyanotypi|fosfor|signal" data-mode="light|dark">
```

| Akse | Verdier | Påvirker |
|---|---|---|
| **Typografisk sett** (`data-type`) | `tidsskrift` (A), `terminal` (C) | fonter, typeskala, linjehøyde, målbredde, radier, strektykkelser, noen komponentvarianter |
| **Palett** (`data-palette`) | `papir`, `cyanotypi` (anbefalt for A) · `fosfor`, `signal` (anbefalt for C) | alle farger inkl. kode og callouts |
| **Modus** (`data-mode`) | `light`, `dark` (brukervalg `system` løses i JS) | velger lys/mørk variant av paletten |

Alle **2 × 4 × 2 = 16** kombinasjoner er gyldige og kontrastverifisert. Paletten er uavhengig av typesettet (kontrast avhenger kun av palett × modus); «anbefalt» vises bare som et hint i temavelgeren.

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
- **Typografi:** to valg med typografisk prøve «Aa*g*» i Spectral 300 og «Aa→» i Schibsted 800 + JetBrains-ligatur, navn og én linje beskrivelse.
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
