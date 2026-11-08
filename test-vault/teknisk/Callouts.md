---
tags: [qa, callouts]
---
# Callouts

Alle innebygde typer og aliaser. Hver type skal ha ikon og farge som holder WCAG AA i alle temaer (AK8/AK19).

> [!note]
> Note uten egen tittel – tittel skal bli «Note» (eller norsk oversettelse).

> [!abstract] Abstract
> Aliaser: `summary`, `tldr`.

> [!summary] Summary (alias for abstract)
> Innhold.

> [!tldr] TL;DR (alias for abstract)
> Innhold.

> [!info] Info
> Innhold.

> [!todo] Todo
> Innhold.

> [!tip] Tip
> Aliaser: `hint`, `important`.

> [!hint] Hint
> Innhold.

> [!important] Important
> Innhold.

> [!success] Success
> Aliaser: `check`, `done`.

> [!check] Check
> Innhold.

> [!done] Done
> Innhold.

> [!question] Question
> Aliaser: `help`, `faq`.

> [!help] Help
> Innhold.

> [!faq] FAQ
> Innhold.

> [!warning] Warning
> Aliaser: `caution`, `attention`.

> [!caution] Caution
> Innhold.

> [!attention] Attention
> Innhold.

> [!failure] Failure
> Aliaser: `fail`, `missing`.

> [!fail] Fail
> Innhold.

> [!missing] Missing
> Innhold.

> [!danger] Danger
> Alias: `error`.

> [!error] Error
> Innhold.

> [!bug] Bug
> Innhold.

> [!example] Example
> Innhold.

> [!quote] Quote
> Alias: `cite`.

> [!cite] Cite
> Innhold.

## Store bokstaver og ukjent type

> [!WARNING] Skrevet med store bokstaver
> Typen er case-insensitiv – skal se ut som `warning`.

> [!egendefinert] Ukjent type
> Ukjente typer skal falle tilbake til `note`-utseende, ikke krasje.

## Bare tittel

> [!info] Callout med bare tittel og ingen innhold

## Foldbare

> [!tip]- Lukket som standard (klikk for å åpne)
> Dette innholdet skal være **skjult** ved lasting. Toggle må være tastaturtilgjengelig (Enter/Space) og ha `aria-expanded`.

> [!tip]+ Åpen som standard (kan lukkes)
> Dette innholdet skal være **synlig** ved lasting.

> [!faq]- Hvorfor er dette lukket?
> Fordi `-` etter typen betyr lukket.

## Nestede callouts

> [!question] Ytre callout
> Tekst i ytre.
> > [!example] Indre callout
> > Tekst i indre.
> > > [!danger]- Innerste, foldbar og lukket
> > > Tre nivåer dypt.
> 
> Mer tekst i ytre etter nestingen.

## Callout med kode inni

> [!example] Eksempel på Kafka-lytter
> ```java
> @KafkaListener(topics = "handel.ordre.opprettet.v1", groupId = "lager")
> public void håndter(OrdreOpprettet h) {
>     lager.reserver(h.linjer());
> }
> ```
> Og litt `inline-kode` og en lenke til [[Consumer groups]].

> [!note] Callout med mermaid
> ```mermaid
> flowchart LR
>     A --> B
> ```

## Callout med liste og tabell

> [!info] Sjekkliste
> - [ ] Ikke krysset av
> - [x] Krysset av
>
> | Kolonne | Verdi |
> |---------|-------|
> | a | 1 |

## Vanlig blokksitat (ikke callout)

> Dette er et vanlig sitat. Det skal **ikke** se ut som en callout.
> — Ukjent

> [!note]Mangler mellomrom etter ]
> Obsidian godtar dette også.
