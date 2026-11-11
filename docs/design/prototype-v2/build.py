#!/usr/bin/env python3
"""Bygger docs/design/prototype-v2.html fra src.html (se README.md i denne mappen).

Setter inn @font-face-reglene (base64-fonter) fra prototype-v1.1.html og hele tokens.css,
slik at prototypen er selvstendig og alltid bruker de kanoniske tokenene.
Ingen avhengigheter utover Python 3.
"""
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
DESIGN = HERE.parent

src = (HERE / 'src.html').read_text(encoding='utf-8')
v11 = (DESIGN / 'prototype-v1.1.html').read_text(encoding='utf-8').split('\n')
fonts = [l for l in v11[:60] if l.startswith('@font-face')]
assert len(fonts) == 15, f'Forventet 15 @font-face-linjer i prototype-v1.1.html, fant {len(fonts)}'
tokens = (DESIGN / 'tokens.css').read_text(encoding='utf-8')

assert src.count('/*FONTS*/') == 1 and src.count('/*TOKENS*/') == 1, 'Plassholderne mangler i src.html'
out = src.replace('/*FONTS*/', '\n'.join(fonts)).replace('/*TOKENS*/', tokens)
(DESIGN / 'prototype-v2.html').write_text(out, encoding='utf-8')
print(f'Skrev {DESIGN / "prototype-v2.html"} ({len(out) // 1024} KB)')
