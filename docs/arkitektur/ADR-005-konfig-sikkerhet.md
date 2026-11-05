# ADR-005: Konfigurasjon og sikkerhet

- Status: Vedtatt (arkitekt), 2026-11-05

## Konfigurasjon (B6, AK1)

### Fil

`vault-reader.config.json` i prosjektroten (sjekket inn, peker på `./test-vault` slik at `npm start` virker
rett etter kloning). Kunden lager `vault-reader.config.local.json` (git-ignorert via `*.local.json`) som
**erstatter** den sjekkede fila helt hvis den finnes.

```jsonc
{
  "port": 4317,                       // valgfri, standard 4317
  "defaultVault": "jobb",             // id fra lista; standard = første vault
  "vaults": [
    {
      "id": "jobb",                   // [a-z0-9-]+, unik, brukes i URL-er
      "name": "Jobbnotater",          // visningsnavn
      "path": "~/Documents/Jobb",     // absolutt, ~/ eller relativ til konfigfila
      "ignore": ["Maler/", "Privat/"] // valgfri, vault-relative mappeprefikser
    }
  ]
}
```

Typen ligger i `src/server/features/config/` (`AppConfig`). Validering er håndskrevet (ingen schema-
avhengighet); feil gir én tydelig norsk melding og exit-kode 1 ved oppstart. Ukjente nøkler ignoreres
(nøkler som starter med `$`, f.eks. `$comment`, er tillatt).

### Overstyring – presedens CLI > env > fil > standard

| CLI-flagg | Env | Effekt |
|---|---|---|
| `--config <fil>` | `VAULT_READER_CONFIG` | Annen konfigfil. |
| `--vault <sti>` | `VAULT_READER_VAULT` | Ad hoc-vault med id `cli` (navn = mappenavn), blir `defaultVault`. Øvrige vaults fra fila beholdes. |
| `--vault-id <id>` | `VAULT_READER_VAULT_ID` | Velg standard-vault blant de konfigurerte. |
| `--port <n>` | `VAULT_READER_PORT` | Port. |

Bruk: `npm start -- --vault ~/Notater`. Parsing med `node:util` `parseArgs` (ingen avhengighet).

Konfig-modulen er en ren funksjon `resolveConfig({ argv, env, readFile, cwd, homedir })` → `AppConfig`,
slik at all presedenslogikk kan testes uten filsystem.

## Sikkerhet (AK20, B1)

| Trussel | Tiltak |
|---|---|
| Tilgang fra nettverket | Serveren binder **hardkodet** `127.0.0.1` (ikke konfigurerbart). Vite dev-server likeså. |
| DNS-rebinding (ondsinnet nettside som når localhost) | Middleware avviser forespørsler der `Host` ikke er `127.0.0.1:<port>` eller `localhost:<port>` (403). |
| Path traversal | API-et tar aldri en sti og slår den opp på disk. Alle stier slås opp **i indeksen** (`docPath`/`filePath` → `VaultFile`). Finnes den ikke der → 404. Disk-stien bygges fra vault-rot + indeksert relativ sti, og verifiseres med `path.relative` (ingen `..`) før lesing. Symlenker ut av vaultet indekseres ikke. |
| XSS via markdown/HTML i notater | `rehype-sanitize` i pipelinen (ADR-002). Klienten bruker aldri `dangerouslySetInnerHTML` for notatinnhold. Mermaid kjøres med `securityLevel: 'strict'`. |
| XSS via vedlegg (f.eks. SVG) | Vedlegg serveres med `Content-Security-Policy: sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'` og `X-Content-Type-Options: nosniff`. Kun hvitelistede MIME-typer (bilder i v1). |
| Skriving til vault | Ingen skrivende kode eller endepunkter (B1). Kun `GET`. Andre metoder → 405. |
| Nettverkskall ut (B10) | Ingen CDN, fonter og biblioteker bundles. App-sider får CSP `default-src 'self'` (+ `style-src 'self' 'unsafe-inline'` for Shiki/Mermaid). |

## Konsekvenser

- + Sikkert som standard uten konfig.
- − `--host` støttes bevisst ikke; å lese fra mobilen over LAN krever en senere, eksplisitt beslutning fra PO.
