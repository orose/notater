---
tags: [spring, java]
---
# Transaksjoner i Spring

`@Transactional` fungerer via proxy. **Kall fra samme klasse går utenom proxyen** og får ingen transaksjon.

```java
@Service
public class OrdreService {

    @Transactional
    public void opprett(NyOrdre ny) {
        repo.save(Ordre.fra(ny));
        intern(); // ⚠ ingen ny transaksjon her, selv med REQUIRES_NEW
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void intern() { /* ... */ }
}
```

## Transactional outbox

```mermaid
sequenceDiagram
    autonumber
    participant API as Ordre-API
    participant DB as Postgres
    participant R as Outbox-relay
    participant K as Kafka
    API->>DB: INSERT ordre + INSERT outbox (samme tx)
    R->>DB: SELECT * FROM outbox WHERE sendt = false
    R->>K: produce(ordre-opprettet)
    K-->>R: ack
    R->>DB: UPDATE outbox SET sendt = true
```

Se [[Hendelsesdrevet arkitektur#Outbox-mønsteret]].
