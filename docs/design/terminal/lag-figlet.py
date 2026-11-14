#!/usr/bin/env python3
"""
Lager figlet-fontene for terminalpresentasjonen (designsystem-terminal.md §3, ADR-011 beslutning 5):

    python3 docs/design/terminal/lag-figlet.py   → docs/design/terminal/figlet/vr-blokk.flf og vr-smal.flf

Fontene er tegnet av UX som punktgrafikk (# = fylt). Hver tekstrad bærer to «piksler» i høyden med halvblokkene
▀ ▄ █, så pikslene blir kvadratiske i en celle på 1:2:
  vr-blokk: 8 piksler = 4 rader. Versalhøyde 7 (rad 1–7); rad 0 er luft over (ringen i Å).
  vr-smal:  6 piksler = 3 rader. Versalhøyde 5 (rad 1–5); rad 0 er luft over.
Ingen skygge: massive blokker overlever komprimert video best. Én kolonne luft er tegnet inn etter hvert tegn
(«full width», ingen smushing). Lisens: prosjektets egen.

FIGlet-format (flf2a): ASCII 32–126 i rekkefølge, så de sju tyske tegnene (Ä Ö Ü ä ö ü ß), så kodemerkede tegn.
Tegn vi ikke har tegnet, har bredde 0 (= mangler; leseren faller da tilbake til fet tekst for hele hodet).
Små bokstaver er kopier av versalene. Ä Ö Ü ä ö ü ß står tomme: ADR-011 fjerner aksenter (NFD) før oppslag.
"""
import os

HER = os.path.dirname(os.path.abspath(__file__))

# ── vr-blokk: 5 × 7 (noen smalere/bredere), rad 0 tom unntatt Å ─────────────────────────────────────────────
B = {
    'A': ".###. #...# #...# ##### #...# #...# #...#",
    'B': "####. #...# #...# ####. #...# #...# ####.",
    'C': ".###. #...# #.... #.... #.... #...# .###.",
    'D': "####. #...# #...# #...# #...# #...# ####.",
    'E': "##### #.... #.... ####. #.... #.... #####",
    'F': "##### #.... #.... ####. #.... #.... #....",
    'G': ".###. #...# #.... #.### #...# #...# .####",
    'H': "#...# #...# #...# ##### #...# #...# #...#",
    'I': "### .#. .#. .#. .#. .#. ###",
    'J': "....# ....# ....# ....# #...# #...# .###.",
    'K': "#...# #..#. #.#.. ##... #.#.. #..#. #...#",
    'L': "#.... #.... #.... #.... #.... #.... #####",
    'M': "#...# ##.## #.#.# #.#.# #...# #...# #...#",
    'N': "#...# ##..# #.#.# #.#.# #..## #...# #...#",
    'O': ".###. #...# #...# #...# #...# #...# .###.",
    'P': "####. #...# #...# ####. #.... #.... #....",
    'Q': ".###. #...# #...# #...# #.#.# #..#. .##.#",
    'R': "####. #...# #...# ####. #.#.. #..#. #...#",
    'S': ".#### #.... #.... .###. ....# ....# ####.",
    'T': "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
    'U': "#...# #...# #...# #...# #...# #...# .###.",
    'V': "#...# #...# #...# #...# #...# .#.#. ..#..",
    'W': "#...# #...# #...# #.#.# #.#.# ##.## #...#",
    'X': "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
    'Y': "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..",
    'Z': "##### ....# ...#. ..#.. .#... #.... #####",
    # Æ: A og E deler stammen. Ø: O med en diagonal på tre piksler (0 skilles ved å være smalere og uten strek).
    # Å: ringen står i rad 0–2, A-en er kortere (rad 2–7).
    'Æ': ".###### #..#... #..#... ######. #..#... #..#... #..####",
    'Ø': ".###. #...# #..## #.#.# ##..# #...# .###.",
    '0': ".##. #..# #..# #..# #..# #..# .##.",
    '1': ".#. ##. .#. .#. .#. .#. ###",
    '2': ".###. #...# ....# ...#. ..#.. .#... #####",
    '3': "####. ....# ....# .###. ....# ....# ####.",
    '4': "...#. ..##. .#.#. #..#. ##### ...#. ...#.",
    '5': "##### #.... ####. ....# ....# #...# .###.",
    '6': ".###. #.... #.... ####. #...# #...# .###.",
    '7': "##### ....# ...#. ..#.. .#... .#... .#...",
    '8': ".###. #...# #...# .###. #...# #...# .###.",
    '9': ".###. #...# #...# .#### ....# ....# .###.",
    '.': ". . . . . . #",
    ',': ".. .. .. .. .. .# #.",
    ':': ". . # . . . #",
    ';': ".. .. .# .. .. .# #.",
    '!': "# # # # # . #",
    '?': ".###. #...# ....# ...#. ..#.. ..... ..#..",
    '-': "... ... ... ### ... ... ...",
    '–': "..... ..... ..... ##### ..... ..... .....",
    '/': "....# ....# ...#. ..#.. .#... #.... #....",
    '&': ".##.. #..#. #.#.. .#... #.#.# #..#. .##.#",
    '(': "..# .#. #.. #.. #.. .#. ..#",
    ')': "#.. .#. ..# ..# ..# .#. #..",
    "'": "# # . . . . .",
    '"': "#.# #.# ... ... ... ... ...",
    '#': ".#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.",
    '%': "##..# ##..# ...#. ..#.. .#... #..## #..##",
    '+': "..... ..#.. ..#.. ##### ..#.. ..#.. .....",
    ' ': "... ... ... ... ... ... ...",
}
B_AA = ".###. .#.#. .###. #...# #...# ##### #...# #...#"   # Å: 8 rader (ringen i rad 0)

# ── vr-smal: 3 × 5 (M W N Æ Ø bredere), rad 0 tom unntatt Å ────────────────────────────────────────────────
S = {
    'A': ".#. #.# ### #.# #.#", 'B': "##. #.# ##. #.# ##.", 'C': ".## #.. #.. #.. .##", 'D': "##. #.# #.# #.# ##.",
    'E': "### #.. ##. #.. ###", 'F': "### #.. ##. #.. #..", 'G': ".## #.. #.# #.# .##", 'H': "#.# #.# ### #.# #.#",
    'I': "### .#. .#. .#. ###", 'J': "..# ..# ..# #.# .#.", 'K': "#.# #.# ##. #.# #.#", 'L': "#.. #.. #.. #.. ###",
    'M': "#...# ##.## #.#.# #...# #...#", 'N': "#..# ##.# #.## #..# #..#", 'O': "### #.# #.# #.# ###",
    'P': "##. #.# ##. #.. #..", 'Q': "### #.# #.# ### ..#", 'R': "##. #.# ##. #.# #.#", 'S': ".## #.. .#. ..# ##.",
    'T': "### .#. .#. .#. .#.", 'U': "#.# #.# #.# #.# ###", 'V': "#.# #.# #.# #.# .#.",
    'W': "#...# #...# #.#.# ##.## #...#", 'X': "#.# #.# .#. #.# #.#", 'Y': "#.# #.# .#. .#. .#.", 'Z': "### ..# .#. #.. ###",
    'Æ': ".#### #.#.. ####. #.#.. #.###", 'Ø': "#### #.## ##.# #..# ####",
    '0': ".#. #.# #.# #.# .#.", '1': ".#. ##. .#. .#. ###", '2': "##. ..# .#. #.. ###", '3': "##. ..# .#. ..# ##.",
    '4': "#.# #.# ### ..# ..#", '5': "### #.. ##. ..# ##.", '6': ".## #.. ### #.# ###", '7': "### ..# .#. .#. .#.",
    '8': "### #.# ### #.# ###", '9': "### #.# ### ..# ##.",
    '.': ". . . . #", ',': ".. .. .. .# #.", ':': ". # . # .", ';': ".. .# .. .# #.", '!': "# # # . #",
    '?': "##. ..# .#. ... .#.", '-': ".. .. ## .. ..", '–': "... ... ### ... ...", '/': "..# ..# .#. #.. #..",
    '&': ".#. #.# .#. #.# .##", '(': ".# #. #. #. .#", ')': "#. .# .# .# #.", "'": "# # . . .", '"': "#.# #.# ... ... ...",
    '#': "#.# ### #.# ### #.#", '%': "#.# ..# .#. #.. #.#", '+': "... .#. ### .#. ...", ' ': ".. .. .. .. ..",
}
S_AA = ".#. ### #.# ### #.# #.#"   # Å: prikk/ring i rad 0 over en flat A


def piksler(spec, hoyde):
    rader = spec.split()
    if len(rader) == hoyde - 1:
        rader = ['.' * len(rader[0])] + rader          # rad 0 = luft over versalhøyden
    assert len(rader) == hoyde and len({len(r) for r in rader}) == 1, spec
    return [r + '.' for r in rader]                     # én kolonne innebygd luft


def halvblokker(px):
    ut = []
    for i in range(0, len(px), 2):
        a, b = px[i], px[i + 1]
        ut.append(''.join('█' if x == '#' and y == '#' else '▀' if x == '#' else '▄' if y == '#' else ' ' for x, y in zip(a, b)))
    return ut


def flf(navn, tegn, aa, hoyde_px, kommentar):
    h = hoyde_px // 2
    glyf = {c: halvblokker(piksler(v, hoyde_px)) for c, v in tegn.items()}
    glyf['Å'] = halvblokker(piksler(aa, hoyde_px))
    for c in list(glyf):
        if c.isalpha() and c.upper() == c:
            glyf[c.lower()] = glyf[c]
    tom = [''] * h

    def skriv(rader):
        return [r + ('@@' if i == h - 1 else '@') for i, r in enumerate(rader)]

    maks = max(len(r) for g in glyf.values() for r in g) + 2
    linjer = [f'flf2a$ {h} {h} {maks} -1 {len(kommentar)} 0 0 {7}']
    linjer += kommentar
    for k in range(32, 127):
        linjer += skriv(glyf.get(chr(k), tom))
    for c in 'ÄÖÜäöüß':                                 # påkrevde tyske tegn: tomme (NFD-oppslag i leseren)
        linjer += skriv(tom)
    for c in 'ÆØÅæøå–':
        linjer.append(f'{ord(c)}  {c}')
        linjer += skriv(glyf[c])
    os.makedirs(os.path.join(HER, 'figlet'), exist_ok=True)
    with open(os.path.join(HER, 'figlet', navn + '.flf'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(linjer) + '\n')
    return glyf


KOMMENTAR = [
    '{navn} – figlet-font for vault-leserens terminalpresentasjon (v3).',
    'Tegnet av UX, prosjektets egen lisens. Kilde: docs/design/terminal/lag-figlet.py (ikke rediger for hånd).',
    '{px} piksler høy i halvblokker (▀ ▄ █), {rader} rader. Versaler; små bokstaver er kopier. Full width, ingen smushing.',
    'Glyfsett: A–Z ÆØÅ 0–9 mellomrom . , : ; ! ? - – / & ( ) \' " # % +   Bredde 0 = tegnet mangler.',
]

if __name__ == '__main__':
    for navn, tegn, aa, px in (('vr-blokk', B, B_AA, 8), ('vr-smal', S, S_AA, 6)):
        k = [l.format(navn=navn, px=px, rader=px // 2) for l in KOMMENTAR]
        g = flf(navn, tegn, aa, px, k)
        prøve = 'STATUSMØTE UKE 45 – ÆØÅ 0123456789'
        print(navn)
        for i in range(px // 2):
            print('  ' + ''.join(g[c][i] for c in prøve))
