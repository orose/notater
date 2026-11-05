---
tags: [adr, arkitektur]
status: vedtatt
dato: 2025-03-14
---
# ADR-001 Bruk Kafka

> [!abstract] Sammendrag
> Vi bruker Kafka som hendelsesbuss mellom tjenestene i handelsdomenet.

Merk: dette notatet har `status: vedtatt`, men er **ikke** tagget `task` – skal ikke vises i oppgavebasen.

## Kontekst

Vi har fire tjenester som i dag kaller hverandre synkront via REST.

## Beslutning

Kafka (managed), med outbox-mønster. Se [[Hendelsesdrevet arkitektur#Outbox-mønsteret]].

## Konsekvenser

- ✅ Løs kobling i tid
- ❌ Eventual consistency må håndteres i UI

## Status

Vedtatt. Gjennomgått i [[Gjennomgå ADR-er]].
