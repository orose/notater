---
tags:
  - task
  - team
status: doing
priority: 2
due: 2026-11-12
ansvarlig: Kari
---
# Skriv integrasjonstest for ordre-API

Integrasjonstest med Testcontainers for `POST /api/ordre`. Se [[Ordre]] og [[Evaluer Testcontainers]].

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Testcontainers
class OrdreApiIT {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void oppretter_ordre_og_publiserer_hendelse() {
        // gitt – når – så
    }
}
```
