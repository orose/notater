# Kilde for prototype-v2.html (PO-98)

`../prototype-v2.html` er **generert**. Rediger `src.html` her og bygg på nytt. Ikke rediger den genererte filen.

| Fil | Hva |
|---|---|
| `src.html` | Prototypens HTML, CSS og JS (designsystem §12). Inneholder plassholderne `/*FONTS*/` og `/*TOKENS*/`. |
| `build.py` | Setter inn de 15 `@font-face`-reglene (base64-fonter) fra `../prototype-v1.1.html` og hele `../tokens.css`, og skriver `../prototype-v2.html`. |

## Bygg

```sh
python3 docs/design/prototype-v2/build.py
```

Krever bare Python 3, ingen avhengigheter. Bygget er deterministisk: samme `src.html`, `tokens.css` og
`prototype-v1.1.html` gir byte-identisk `prototype-v2.html` (kontrollert med `cmp`).

**Bygg på nytt når du har endret `tokens.css`**, slik at prototypen alltid viser de kanoniske tokenene. Kjør deretter
kontrollene:

```sh
node docs/design/kontrast-v2.mjs      # fargekontrast for v2, exit 1 ved brudd
node docs/design/kontrast-v1.1.mjs    # v1.1 skal fortsatt være grønn
```

## Etter bygging

- Åpne `docs/design/prototype-v2.html` direkte i nettleseren (`file://`). URL-parametrene står i designsystem §12.
- Skjermbildene i `../skjermbilder/v2/` tas med Playwright mot den genererte filen, i 1920×1080, 1280×720, 1440×900
  og 390×844. Filnavnene sier funksjon, typesett, palett og modus. Kjør aldri `playwright install`; nettleseren er
  forhåndsinstallert.
