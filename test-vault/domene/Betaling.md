---
aliases: [Payment]
---
# Betaling

En betaling knyttes til nøyaktig én [[Ordre]]. Vi bruker idempotensnøkler for å tåle at Kafka leverer meldinger *minst én gang*.

```java
@Transactional
public void registrer(BetalingMottatt hendelse) {
    if (betalinger.existsByIdempotensnokkel(hendelse.idempotensnokkel())) {
        log.info("Duplikat betaling ignorert: {}", hendelse.idempotensnokkel());
        return;
    }
    betalinger.save(Betaling.fra(hendelse));
}
```

Se [[Transaksjoner i Spring]] og [[Kafka-grunnleggende#Leveransegarantier|leveransegarantier]].
