---
tags: [qa, markdown]
aliases: [Markdown-test]
---
# Markdown-elementer

Samlenotat for «Bør»-funksjonene: tabeller, oppgavelister, fotnoter, markering, kommentarer, inline-tagger.

## Formatering

**Fet**, *kursiv*, ***fet kursiv***, ~~gjennomstreket~~, `kode`, ==markert tekst== og ==markering med **fet** inni==.

Escapet: \*ikke kursiv\*, \==ikke markert\==, \[[ikke en lenke]], \#ikkeentagg.

Hard linjeskift med to mellomrom  
neste linje. Obsidian bruker også «strict line breaks» av,
så denne linjen kan vises på samme linje som forrige (avklares).

## Tagger inline

Dette avsnittet har #arkitektur og en nestet #java/spring og en tagg med norske tegn #særnorsk og bindestrek #kafka-streams. `#ikke-tagg-i-kode` er ikke en tagg. Tall alene er ikke tagg: #2026. Utrop#ikke-tagg (ingen mellomrom foran).

## Kommentarer (skal skjules)

Synlig tekst %%denne inline-kommentaren skal IKKE vises%% fortsetter her.

%%
Dette er en kommentarblokk over flere linjer.
Den skal ikke vises. Hvis du ser «HEMMELIG-KOMMENTAR» i leseren eller i søketreff, er det en feil.
HEMMELIG-KOMMENTAR
%%

Teksten etter kommentarblokken skal vises.

## Tabeller

| Venstre | Midtstilt | Høyre |
|:--------|:---------:|------:|
| a | b | 1 |
| lang tekst som bryter | `kode` | 1 000,50 |
| [[Kunde\|lenke med alias i tabell]] | ==markert== | 3 |

Bred tabell (skal scrolle internt på mobil):

| ID | Navn | Status | Prioritet | Frist | Ansvarlig | Team | Komponent | Miljø | Versjon | Kommentar |
|----|------|--------|-----------|-------|-----------|------|-----------|-------|---------|-----------|
| 1 | Migrer til Java 21 | doing | 1 | 2026-11-08 | Ola | Backend | ordre-service | prod | 1.4.2 | Venter på base-image |
| 2 | Optimaliser SQL-spørring | doing | 2 | 2026-11-09 | Kari | Backend | ordre-db | prod | 16.4 | Delvis indeks |

## Oppgavelister

- [ ] Ikke gjort
- [x] Gjort
- [X] Gjort (stor X)
- [/] Delvis (egendefinert status)
- [-] Kansellert (egendefinert status)
- [ ] Nestet:
    - [ ] Underoppgave 1
    - [x] Underoppgave 2

Avkrysningsbokser skal være **skrivebeskyttet** (B1) – klikk skal ikke endre noe.

## Lister

1. Første
2. Andre
   1. Nestet nummerert
   2. Enda en
3. Tredje

- Punkt
  - Underpunkt
    - Under-underpunkt

## Fotnoter

Kafka ble opprinnelig utviklet hos LinkedIn.[^1] Navnet er etter Franz Kafka.[^navn] Inline-fotnote også.^[Dette er en inline-fotnote.]

[^1]: Åpen kildekode i 2011.
[^navn]: Jay Kreps likte forfatteren. Fotnoter kan ha **formatering** og [[Kafka-grunnleggende|lenker]].

## Horisontal linje

---

***

## Lenker

Ekstern: [Apache Kafka](https://kafka.apache.org). Ren URL: https://spring.io. E-post: <post@example.com>.

Markdown-lenke til notat: [Kunde-notatet](../domene/Kunde.md) og URL-kodet: [Spring-konfig](Spring/Spring%20Boot%20%E2%80%93%20konfigurasjon.md).

## Veldig langt ord

Superkalifragilistiskekspialidoskeordsomikkeharmellomromogsomskalbrytesikkeskapehorisontalscrollpåmobil_https://example.com/en/svært/lang/sti/som/ikke/har/mellomrom/og/skal/brytes/pent/på/mobil?parameter=verdi&annen=verdi

## Overskrifter

### H3
#### H4
##### H5
###### H6
