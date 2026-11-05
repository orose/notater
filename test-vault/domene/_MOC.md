---
tags: [moc]
aliases: [Domenekart]
---
# Domenekart (MOC)

Inngangsporten til domenemodellen for nettbutikken. Notatene her beskriver *begrepene* – ikke implementasjonen.

> [!info] Om denne siden
> Dette er en «Map of Content». Den skal **ikke** vises i [[Domene.base|domenebasen]] (filtrert bort på `file.name != "_MOC"`).

## Kjernebegreper

- [[Kunde]] – hvem som handler
- [[Ordre]] – hva som er bestilt (også kjent som [[Bestilling]])
- [[Betaling]] og [[Faktura]]
- [[Lager]] og [[Produktkatalog]]
- [[avtale|Avtale]] – rammeavtaler for bedriftskunder
- [[delt/Adresse|Adresse]] – verdiobjekt som deles mellom kontekster

## Støttebegreper

- [[Ærendelogg]]
- [[Øyeblikksbilde]]
- [[Åpningstider]]
- [[Hendelseskatalog]]

## Hendelser (Kafka-topics)

Disse er tagget `kafka-topic` og skal **ikke** vises i domenebasen:

- [[ordre-opprettet]]
- [[betaling-mottatt]]
- [[delt/kunde-endret]]

## Domenebasen

![[Domene.base]]
