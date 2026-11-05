---
tags: [kafka-topics, katalog]
---
# Hendelseskatalog

Oversikt over alle hendelser. Notatet er tagget `kafka-topics` (flertall!) – **ikke** `kafka-topic` – og skal derfor *vises* i domenebasen. Fanger feil der `hasTag` gjør prefiks-match på strengen.

| Topic | Produsent | Notat |
|-------|-----------|-------|
| `handel.ordre.opprettet.v1` | ordre-service | [[ordre-opprettet]] |
| `handel.betaling.mottatt.v1` | betaling-service | [[betaling-mottatt]] |
| `kunde.kunde.endret.v1` | kunde-service | [[delt/kunde-endret]] |
