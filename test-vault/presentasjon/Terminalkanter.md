---
description: Kanttilfeller for presentasjon i terminalen – særtegn, bredde og plassholdere.
---
# Terminalkanter

## Særtegn

### Æøå og emoji 🚀

Blåbærsyltetøy fra Ærøskøbing på skjærgårdsøya ved Åsgårdstrand. Bredde-2-tegn: 漢字テスト og 한국어 midt i en setning som må brytes riktig. Emoji: 🙂 🚀 👩‍💻 🇳🇴. Kombinerende tegn: «Ä» (A + U+0308).

Markør TERM-SÆR.

## Blokker

### Callouts

> [!note] Merk deg
> En vanlig callout med ramme og etikett. Markør TERM-CALLOUT-NOTE.

> [!warning] Advarsel med æøå
> Callouten har en lang linje som må brytes innenfor rammen og aldri flyte over kanten på en smal terminal. Markør TERM-CALLOUT-WARN.

### Bases-tabell

```base
filters:
  and:
    - file.inFolder("oppgaver")
    - file.hasTag("task")
    - priority == 1
views:
  - type: table
    name: Kritisk
    order:
      - file.name
      - status
      - due
    sort:
      - property: due
        direction: DESC
```

Markør TERM-BASE.

### Bilde

![[arkitektur.png]]

Markør TERM-BILDE.

### Ti kolonner

| Kol01 | Kol02 | Kol03 | Kol04 | Kol05 | Kol06 | Kol07 | Kol08 | Kol09 | Kol10 |
|---|---|---|---|---|---|---|---|---|---|
| T1K01 | T1K02 | T1K03 | T1K04 | T1K05 | T1K06 | T1K07 | T1K08 | T1K09 | T1K10 |
| T2K01 | T2K02 | Ærlig | T2K04 | T2K05 | T2K06 | T2K07 | T2K08 | T2K09 | T2K10 |
| T3K01 | T3K02 | T3K03 | T3K04 | T3K05 | T3K06 | T3K07 | T3K08 | T3K09 | T3K10 |

Markør TERM-TABELL.

## Donaudampfschifffahrtselektrizitätenhauptbetriebswerkbauunterbeamtengesellschaft

### Lange ord og lenker

Ordet over har 80 tegn – like bredt som en terminal på 80 kolonner. Dette har enda flere: Personvernkonsekvensvurderingsprosessdokumentasjonsmalverktøyleverandøravtalereforhandlingsmøtereferatet.

En lang adresse: https://eksempel.invalid/sti/som/er/mye/lengre/enn/en/terminal/på/åtti/kolonner/og/derfor/må/brytes?side=2

En lenke med tekst: [presentasjonsdokumentasjonen](https://eksempel.invalid/dokumentasjon/presentasjon).

Markør TERM-LANG.
