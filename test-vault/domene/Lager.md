# Lager

Lagerbeholdning per vare og lagerlokasjon. Reservasjon skjer når [[Ordre]] opprettes, og frigjøres ved kansellering.

```yaml
lager:
  reservasjon:
    ttl: PT30M
    opprydding-cron: "0 */5 * * * *"
```
