---
tags: [qa, kode]
---
# Kodeblokker – alle språk

Fasit for AK14: highlighting som følger tema, språkmerke, kopier-knapp, filnavn/tittel. Lange linjer skal scrolle **inne i blokken** – aldri på sidenivå (AK5).

## Java

```java
package no.eksempel.ordre;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/ordre")
public class OrdreController {

    private final OrdreService service;

    public OrdreController(OrdreService service) {
        this.service = service;
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrdreDto> hent(@PathVariable UUID id) {
        return service.finn(id)
                .map(OrdreDto::fra)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
```

## JSON

```json
{
  "ordreId": "6f1c2e4a-1b2c-4d5e-9f00-112233445566",
  "status": "BETALT",
  "beløp": 298.00,
  "betalt": true,
  "kommentar": null,
  "linjer": [
    { "sku": "KAF-001", "antall": 2 }
  ]
}
```

## Bash

```bash
#!/usr/bin/env bash
set -euo pipefail
for svc in ordre betaling lager; do
  docker compose logs --since 10m "$svc" | grep -i "error" || true
done
```

## YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ordre-service
  labels:
    app: ordre-service
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: app
          image: registry.local/ordre-service:1.4.2
          resources:
            limits: { cpu: "1", memory: 512Mi }
```

## SQL

```sql
WITH siste AS (
  SELECT kunde_id, max(opprettet) AS sist
  FROM ordre
  GROUP BY kunde_id
)
SELECT k.navn, s.sist
FROM kunde k
JOIN siste s USING (kunde_id)
WHERE s.sist < now() - interval '1 year';
```

## TypeScript

```typescript
export interface Notat {
  readonly sti: string;
  tittel: string;
  tags: ReadonlyArray<string>;
}

export const sorterEtterTittel = (a: Notat, b: Notat): number =>
  a.tittel.localeCompare(b.tittel, 'nb', { sensitivity: 'base' });
```

## ts (kortform)

```ts
const x: Record<string, number> = { a: 1 };
```

## Kotlin

```kotlin
@Service
class LagerService(private val repo: LagerRepository) {
    fun reserver(sku: String, antall: Int): Result<Reservasjon> = runCatching {
        val beholdning = repo.finn(sku) ?: error("Ukjent SKU: $sku")
        check(beholdning.ledig >= antall) { "Ikke nok på lager" }
        repo.reserver(sku, antall)
    }
}
```

## XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <artifactId>ordre-service</artifactId>
  <!-- Kommentar med <tegn> & spesialtegn -->
</project>
```

## Diff

```diff
 @Transactional
-public void opprett(Ordre o) {
+public void opprett(NyOrdre ny) {
+    var o = Ordre.fra(ny);
     repo.save(o);
 }
```

## Ukjent språk

Skal vises som ren tekst med språkmerket `cobol-2077` – ingen krasj.

```cobol-2077
IDENTIFICATION DIVISION.
PROGRAM-ID. HEI-VERDEN.
PROCEDURE DIVISION.
    DISPLAY 'Hei, verden'.
```

## Uten språk

```
Ren tekst uten språk. Ingen highlighting, ingen språkmerke (eller «tekst»).
    Innrykk skal bevares.	Tab også.
```

## Tilde-gjerde

~~~java
// Kodeblokk med ~~~ i stedet for ```
String s = "```";
~~~

## Kode med fire backticks (inneholder tre)

````markdown
```java
System.out.println("nested");
```
````

## Veldig lang linje

```java
String veldigLangStreng = "Denne linjen er bevisst ekstremt lang for å teste at kodeblokken scroller horisontalt internt og at siden ikke får horisontal scroll på mobil, selv ved 360 px bredde. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
```

## Kode inne i liste

1. Start Kafka lokalt:
   ```bash
   docker compose up -d kafka
   ```
2. Opprett topic:
   ```bash
   kafka-topics.sh --create --topic handel.ordre.opprettet.v1 --partitions 12 --bootstrap-server localhost:9092
   ```
3. Verifiser:
   - Liste topics:
     ```bash
     kafka-topics.sh --list --bootstrap-server localhost:9092
     ```

## Innrykket kodeblokk (4 mellomrom)

    Dette er en innrykket kodeblokk uten gjerde.
    Den skal vises som kode uten språk.

## Inline-kode

Bruk `Optional.ofNullable(x)` i stedet for `null`-sjekker. Inline med backtick inni: `` `a` ``.

## Kodeblokk med HTML-innhold (skal escapes, ikke tolkes)

```html
<script>alert('Denne skal vises som tekst, ikke kjøres')</script>
<img src="x" onerror="alert(1)">
```

Se også [[Stor kodeblokk]] (500+ linjer).
