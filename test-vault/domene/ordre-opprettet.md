---
tags:
  - kafka-topic
topic: handel.ordre.opprettet.v1
partisjoner: 12
retention: P7D
---
# ordre-opprettet

Publiseres når en [[Ordre]] er opprettet. Nøkkel: `ordreId`.

```json
{
  "type": "OrdreOpprettet",
  "ordreId": "6f1c2e4a-1b2c-4d5e-9f00-112233445566",
  "kundeId": "0b9d6a1e-7c55-4a4f-8b1a-a1b2c3d4e5f6",
  "linjer": [{ "sku": "KAF-001", "antall": 2 }],
  "tidspunkt": "2026-11-05T09:15:00Z"
}
```
