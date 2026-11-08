---
aliases: [Kafka, Apache Kafka]
tags: [kafka, læring]
---
# Kafka-grunnleggende

Apache Kafka er en distribuert, append-only logg. Dette notatet er mål for mange lenke- og embed-tester – **ikke endre overskrifter eller blokk-ID-er** uten å oppdatere `README-QA.md`.

## Topics

Et *topic* er en navngitt logg. Meldinger har nøkkel, verdi, headers og tidsstempel.

## Partisjoner

Et topic deles i partisjoner. Rekkefølge garanteres **kun innenfor én partisjon**. Meldinger med samme nøkkel havner i samme partisjon (så lenge antall partisjoner ikke endres).

```java
int partisjon = Utils.toPositive(Utils.murmur2(nøkkelBytes)) % antallPartisjoner;
```

### Antall partisjoner

Tommelfingerregel: start med 6–12 og mål. Å øke senere bryter nøkkel-til-partisjon-mappingen.

## Offset

En offset er posisjonen til en melding i en partisjon. Konsumenten committer offset for å huske hvor den slapp. ^offset-def

- Auto-commit er enkelt, men kan miste meldinger ved krasj. ^liste-blokk
- Manuell commit etter vellykket behandling gir *minst-én-gang*.

## Leveransegarantier

| Garanti | Hvordan | Pris |
|---------|---------|------|
| Høyst én gang | commit før behandling | kan miste data |
| Minst én gang | commit etter behandling | duplikater |
| Nøyaktig én gang | transaksjoner + idempotent produsent | kompleksitet |

> [!tip] Idempotente konsumenter
> I praksis: *minst én gang* + idempotent behandling. Se [[Betaling]].

## Se også

- [[Consumer groups]]
- [[Hendelsesdrevet arkitektur]]
