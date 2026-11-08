---
tags: [qa, ikke-i-scope]
---
# Ikke støttet – dataview, LaTeX, canvas

Alt her er **utenfor scope** i v1. Forventet: et diskret «ikke støttet»-kort der det dukker opp (eller rå tekst for inline LaTeX – se spørsmål til PO). Ingen krasj, ingen tom plass.

## Dataview

```dataview
TABLE status, priority, due
FROM #task
WHERE status != "done"
SORT priority ASC
```

```dataviewjs
dv.table(["Fil"], dv.pages("#task").map(p => [p.file.link]))
```

Inline dataview: `= this.file.name` og `$= dv.current().file.mtime`.

## LaTeX

Inline: $x^2 + y^2 = z^2$ og $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$.

Blokk:

$$
\mathbb{E}[X] = \int_{-\infty}^{\infty} x \, f(x) \, dx
$$

Pengebeløp som **ikke** er LaTeX: Det koster $5 og $10 i USA.

## Canvas

![[Tegning.canvas]]

## Excalidraw

![[Skisse.excalidraw]]

## Ukjent kodeblokk-plugin

```tasks
not done
due before tomorrow
```
