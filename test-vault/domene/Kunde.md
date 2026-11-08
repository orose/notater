---
aliases: [Kunder, Customer]
eier: Team Handel
oppdatert: 2026-10-02
---
# Kunde

En **kunde** er en person eller virksomhet som kan legge inn en [[Ordre]]. Kunden identifiseres med et `kundeId` (UUID) og har én eller flere [[delt/Adresse|adresser]].

## Invarianter

1. En kunde har alltid minst én e-postadresse.
2. En kunde som er slettet etter GDPR, beholder kun anonymisert ordrehistorikk. Se [[Avklar (GDPR) sletting av kundedata]].

## Modell

```java
public record Kunde(
        UUID kundeId,
        String navn,
        Email epost,
        List<Adresse> adresser,
        Kundetype type) {

    public Kunde {
        Objects.requireNonNull(kundeId, "kundeId");
        if (adresser == null || adresser.isEmpty()) {
            throw new IllegalArgumentException("Kunde må ha minst én adresse");
        }
        adresser = List.copyOf(adresser);
    }
}
```

> [!warning] Merk
> Det finnes også et *gammelt* notat med samme filnavn: `arkiv/2023/Kunde.md`. Lenken `[[Kunde]]` er derfor tvetydig.

Se også [[_MOC|domenekartet]].
