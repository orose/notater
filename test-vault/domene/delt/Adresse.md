# Adresse

Verdiobjekt som brukes av både [[Kunde]] og frakt. Ligger i **undermappen** `domene/delt/` – testes mot `file.inFolder("domene")` (skal inkludere undermapper).

```kotlin
data class Adresse(
    val gate: String,
    val postnummer: String,
    val poststed: String,
    val land: String = "NO",
) {
    init {
        require(postnummer.matches(Regex("\\d{4}"))) { "Ugyldig postnummer: $postnummer" }
    }
}
```
