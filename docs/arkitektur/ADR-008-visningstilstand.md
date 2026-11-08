# ADR-008: Visningstilstand – lesebredde, diskré embedding, zen og folding

- Status: Vedtatt (arkitekt), 2026-11-06. Gjelder v1.1 F1–F4 og P1.

## Kontekst

v1.1 innfører fire visningsvalg med ulik levetid og rekkevidde. P1 sier at ingen av dem leses fra eller
skrives til notatene (frontmatter er data). Temasystemet (`features/theme`) har allerede et mønster som
virker: ren tilstandsmodul (`theme-state.ts`: normalisering, `read…`/`write…` med try/catch,
`safeLocalStorage`) + provider + `data-*` på `<html>` + `public/tema-init.js` som setter attributtene før
første maling (CSP krever ekstern fil).

## Beslutning

| Valg | Rekkevidde | Levetid | Bor i | Lagring | Synlig som |
|---|---|---|---|---|---|
| Lesebredde (F1) | global | huskes | `features/view-settings` | `localStorage['vault-leser.visning']` | `<html data-width="full">` |
| Diskré embedding (F2) | per vault + notat | huskes | `features/view-settings` | `localStorage['vault-leser.diskret']` | prop til notatvisningen (ingen global attributt) |
| Zen (F4) | global | flyktig (økt i fanen) | `features/view-settings` | ingen | `<html data-zen="on">` |
| Folding (F3) | per åpnet notat | flyktig (til notatet forlates) | `features/outline` | ingen | `hidden` på foldede blokker (ADR-009) |

### Ny feature `view-settings`

Samme oppbygning som `theme`:

```
features/view-settings/
  view-state.ts          ren: typer, normalisering, read/write med try/catch, nøkkelfunksjoner
  view-state.test.ts
  ViewSettingsProvider.tsx
  view-settings-context.ts, use-view-settings.ts
  index.ts               ViewSettingsProvider, useViewSettings, typer
```

```ts
type ReadingWidth = 'readable' | 'full';
interface ViewSettingsValue {
  width: ReadingWidth; setWidth(w): void; toggleWidth(): void;
  zen: boolean; setZen(on): void;
  isDiscreet(vaultId, docPath): boolean; toggleDiscreet(vaultId, docPath): boolean; // returnerer ny verdi (til toast)
}
```

- `ViewSettingsProvider` monteres i `App` ved siden av `ThemeProvider` (over ruteren for vault), slik at
  zen overlever navigasjon mellom notater **og** bytte av vault.
- **Lesebredde:** `{ "v": 1, "width": "full" }`. Ukjent/ugyldig → `readable`. `public/tema-init.js` utvides
  til også å lese denne nøkkelen og sette `data-width` før første maling (ellers hopper teksten fra smal
  til bred ved reload). Filen beholder navnet (CSP-hash/-kilde er uendret: den er en ekstern fil fra
  `'self'`). Provider skriver attributtet i `useLayoutEffect`, slik `applyTheme` gjør.
- **Diskré embedding:** `{ "v": 1, "notes": ["<vaultId>\n<docPath>", …] }` – kun notater der valget er
  **på** (standard av), nyeste sist, maks 500 (eldste kastes). `\n` kan ikke forekomme i vault-id eller
  `DocPath`, så nøkkelen er entydig. Lest én gang ved oppstart, skrevet ved hver endring.
  Når live-reload melder `renamed` (PO-49) med `from`/`to`, flyttes oppføringen (`from` → `to`), så
  valget følger notatet ved omdøping. Slettede notater ryddes ikke (500-grensen holder størrelsen nede).
- **Zen:** React-tilstand i provideren, alltid `false` ved oppstart (huskes ikke). `data-zen="on"` på
  `<html>` styrer CSS (skjul `.sidebar`, `.rail`, `.topbar`, statuslinje; sentrer `.page`). Esc går ut via
  `system.escape` (ADR-007). Zen virker sammen med `data-width="full"`.
- **Folding:** eies av disposisjonsmodellen (`features/outline`, ADR-009), som en `Set<headingId>` i en
  provider rundt notatvisningen, med `key = vaultId + docPath`, så tilstanden nullstilles når et annet
  notat åpnes. Ikke i `view-settings`, fordi den hører sammen med overskriftene og TOC-en i dokumentet.

### Felles regler (som i `theme-state.ts`)

- All tilgang til `localStorage` går via `safeLocalStorage()` og `try/catch` (privat modus, full kvote,
  blokkert lagring): da gjelder valget bare økten, uten feilmelding. `safeLocalStorage` flyttes fra
  `theme-state.ts` til `src/web/shared/storage.ts` når den får sin andre bruker (strukturregel 5 tillater
  generiske primitiver i `web/shared`).
- Lagret JSON normaliseres alltid (`normalize…(unknown)`); ukjent versjon eller form → standardverdi.
- `storage`-hendelsen fra andre faner oppdaterer bredde og diskré-listen (samme leser i flere faner).
- Ingen URL-parametre for disse valgene i v1.1 (temaet har `?type=` for prototypen; det trengs ikke her).

### P1 – ingenting fra frontmatter

- `view-settings` tar aldri `NoteDocument` eller `properties` som inndata – kun `vaultId` og `docPath`.
  Signaturene gjør brudd synlige i review.
- `cssclasses` og andre presentasjonsnøkler i frontmatter ignoreres fortsatt (de sendes ikke fra serveren,
  PO-22).
- Klienten skriver aldri til serveren (API-et er kun GET, ADR-005); AK-1.1-10 er dermed oppfylt
  konstruktivt. QA tester at et notat med `cssclasses: [wide]` ikke gir full bredde.

## Konsekvenser

- Samme mønster som temaet: lett å lese, lett å teste uten DOM.
- `tema-init.js` får to ansvar (tema + bredde). Akseptert: begge er «før første maling»; et nytt skript ville
  gitt én forespørsel til før første maling.
- Diskré embedding følger notatet ved omdøping bare når leseren er åpen da omdøpingen skjer. Akseptert.
