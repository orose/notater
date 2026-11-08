---
tags: [qa, lenker]
---
# Lenketest

Alle lenkevarianter på ett sted. Fasit per lenke står i `README-QA.md` (seksjon «Lenker»).

## Grunnleggende

1. Enkel: [[Ordre]]
2. Med alias: [[Ordre|ordrene våre]]
3. Til overskrift: [[Kafka-grunnleggende#Partisjoner]]
4. Til underoverskrift: [[Kafka-grunnleggende#Antall partisjoner]]
5. Til overskrift med alias: [[Kafka-grunnleggende#Leveransegarantier|garantiene]]
6. Til blokk: [[Kafka-grunnleggende#^offset-def]]
7. Til blokk i liste: [[Kafka-grunnleggende#^liste-blokk]]
8. Med mappesti: [[domene/Betaling]]
9. Med full mappesti og alias: [[teknisk/Kafka/Consumer groups|konsumentgrupper]]
10. Med `.md`-endelse: [[Faktura.md]]

## Via aliaser i frontmatter

Obsidian løser **ikke** lenker via aliaser (aliaser brukes til autofullføring og søk). Forventet utfall: se `README-QA.md` (punkt 11–14 og 18, PO-spørsmål L5).

11. [[Bestilling]] – alias for `domene/Ordre.md`
12. [[EDA]] – alias for `teknisk/Arkitektur/Hendelsesdrevet arkitektur.md`
13. [[Loom|virtuelle tråder]] – alias for `teknisk/Java/Java 21 – virtuelle tråder.md`
14. [[Domenekart]] – alias for `domene/_MOC.md`

## Store/små bokstaver

15. [[kafka-grunnleggende]] → `Kafka-grunnleggende`
16. [[ORDRE]] → `Ordre`
17. [[Avtale]] → `domene/avtale.md`
18. [[bestilling]] – alias med case-avvik

## Spesielle filnavn

19. [[Æøå og mellomrom – særnorsk]]
20. [[versjon 2.0.1 notater]]
21. [[Notat (kopi)]]
22. [[R&D – spørsmål og svar]]
23. [[Dypt nestet notat]]
24. [[Årsrapport (NFD)]] (filnavnet er lagret i Unicode NFD, lenken er skrevet i NFC)
25. [[Spring Boot – konfigurasjon]]

## Tvetydige lenker

To filer heter `Kunde.md`: `domene/Kunde.md` og `arkiv/2023/Kunde.md`.

26. [[Kunde]] – tvetydig. Se fasit i `README-QA.md`.
27. [[domene/Kunde]] – entydig.
28. [[arkiv/2023/Kunde|gammel kunde]] – entydig.

## Brutte lenker

29. [[Finnes ikke]]
30. [[Finnes ikke|brutt med alias]]
31. [[Kafka-grunnleggende#Overskrift som ikke finnes]] (notatet finnes, overskriften ikke)
32. [[Kafka-grunnleggende#^blokk-som-ikke-finnes]]
33. [[domene/Finnes ikke]]
34. [[Slettet notat]] (ligger i `.trash/` – skal være brutt)
35. [[README]] (finnes bare i `.obsidian/` – skal være brutt)

## Andre filtyper

36. [[Oppgaver.base]]
37. [[Domene.base|domeneoversikten]]
38. [[Tegning.canvas]] (ikke i scope)
39. [[arkitektur.png]] (lenke, ikke embed)
40. [[logo.svg|logoen]]

## Lokale lenker

41. [[#Brutte lenker]] – overskrift i samme notat
42. [[#^lokal-blokk]] – blokk i samme notat
43. [[Lenketest#Grunnleggende]] – eksplisitt eget notat

Dette avsnittet har en blokk-ID. ^lokal-blokk

## Markdown-lenker

44. [Kunde (relativ)](../domene/Kunde.md)
45. [Spring-konfig (URL-kodet)](../teknisk/Spring/Spring%20Boot%20%E2%80%93%20konfigurasjon.md)
46. [Ordre med vinkelparentes](<../domene/Ordre.md>)
47. [Ekstern lenke](https://kafka.apache.org)
48. [Brutt markdown-lenke](finnes-ikke.md)

## Ting som IKKE er lenker

49. I inline-kode: `[[Ordre]]`
50. Escapet: \[[Ordre]]
51. Tom: [[]]
52. Uavsluttet: [[Ordre
53. I kodeblokk:

```markdown
Se [[Betaling]] – skal ikke bli lenke eller tilbakelenke.
```

## Lenke i property

Se `domene/Ordre.md`, som har `relatert: ["[[Kunde]]", "[[Betaling]]"]` i frontmatter.
