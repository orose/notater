#!/usr/bin/env python3
"""
ANSI-mockups for terminalpresentasjonen (v3), designsystem-terminal.md.

    python3 docs/design/terminal/lag-mockups.py      → docs/design/terminal/mockups/*.ans

Dette er en DESIGNREFERANSE, ikke produksjonskode: en liten, lesbar implementasjon av reglene i
designsystem-terminal.md (rutenett, lysbildetyper, agendalinje, statuslinje, blokker, deling i «(forts.)»,
intern rulling, oversikt, kommandolinje …), slik at frontend kan sammenligne tegn for tegn.
Ingen avhengigheter utover Python 3.9+. Leser farger.json og figlet-glyfer.json.

Fargene lagres som ROLLER per celle og oversettes først ved skriving, enten til truecolor (palett × modus)
eller til terminalens 16 farger (ansi16). Samme lysbilde kan derfor skrives i alle paletter.
"""
import json
import os
import re
import unicodedata

HER = os.path.dirname(os.path.abspath(__file__))
FARGER = json.load(open(os.path.join(HER, 'farger.json'), encoding='utf-8'))
FIGLET = json.load(open(os.path.join(HER, 'figlet-glyfer.json'), encoding='utf-8'))
UT = os.path.join(HER, 'mockups')


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Skjerm: celler med tegn + rollebasert stil
# ═════════════════════════════════════════════════════════════════════════════════════════════════

def bredde(s):
    """Antall celler (East Asian Wide/Fullwidth = 2). Produksjon: bruk grafem-klynger (string-width)."""
    return sum(2 if unicodedata.east_asian_width(c) in 'WF' else 0 if unicodedata.combining(c) else 1 for c in s)


class Stil(dict):
    """fg, bg (roller), b (fet), i (kursiv), ul (1 rett, 3 bølget, 4 prikket), uc (understrekfarge), rev, link"""
    def __add__(self, o):
        n = Stil(self); n.update(o); return n


S = Stil


class Skjerm:
    def __init__(self, W, H, bg='bg'):
        self.W, self.H = W, H
        self.c = [[(' ', S(bg=bg)) for _ in range(W)] for _ in range(H)]

    def put(self, x, y, tekst, stil=S(), maks=None):
        if not (0 <= y < self.H):
            return x
        for ch in tekst:
            if maks is not None and x >= maks:
                break
            if 0 <= x < self.W:
                gammel = self.c[y][x][1]
                st = S(gammel) if 'bg' in gammel else S()
                st = S(bg=gammel.get('bg', 'bg'))
                st.update(stil)
                self.c[y][x] = (ch, st)
            x += 1
        return x

    def fyll(self, x, y, w, h, bg, tom=False):
        for yy in range(max(0, y), min(self.H, y + h)):
            for xx in range(max(0, x), min(self.W, x + w)):
                ch, st = self.c[yy][xx]
                self.c[yy][xx] = (' ', S(bg=bg)) if tom else (ch, S(st, bg=bg))

    def demp(self):
        """Bakgrunnen bak et flytevindu: alt i dekorfarge på lerretet, så vinduet står alene (også i video)."""
        for yy in range(self.H):
            for xx in range(self.W):
                ch, st = self.c[yy][xx]
                self.c[yy][xx] = (ch, S(fg='dekor', bg='bg'))

    def spans(self, x, y, spans, maks=None):
        for t, st in spans:
            x = self.put(x, y, t, st, maks)
        return x

    # ---- serialisering ----
    def ansi(self, farger):
        ut = []
        for rad in self.c:
            forrige = None
            linje = []
            lenke = None
            for ch, st in rad:
                sgr = farger.sgr(st)
                if st.get('link') != lenke:
                    linje.append('\x1b]8;;%s\x1b\\' % (st.get('link') or ''))
                    lenke = st.get('link')
                if sgr != forrige:
                    linje.append('\x1b[0;%sm' % sgr if sgr else '\x1b[0m')
                    forrige = sgr
                linje.append(ch)
            if lenke:
                linje.append('\x1b]8;;\x1b\\')
            linje.append('\x1b[0m')
            ut.append(''.join(linje))
        return '\n'.join(ut) + '\n'


class Truecolor:
    """Roller → 24-bits SGR for én palett × modus."""
    def __init__(self, palett, modus):
        sett = FARGER['truecolor'][palett][modus]
        self.navn = f'{palett}-{"lys" if modus == "light" else "mork"}'
        self.r = dict(sett['roller'])
        self.r.update({'kode.' + k: v for k, v in sett['kode'].items()})
        self.r.update({'kulor.' + k: v for k, v in sett['kulor'].items()})

    def rgb(self, rolle):
        h = self.r[rolle]
        return '%d;%d;%d' % (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))

    def sgr(self, st):
        p = []
        if st.get('b'): p.append('1')
        if st.get('i'): p.append('3')
        if st.get('ul'): p.append('4:%d' % st['ul'])
        fg, bg = st.get('fg', 'tekst'), st.get('bg', 'bg')
        p.append('38;2;' + self.rgb(fg))
        p.append('48;2;' + self.rgb(bg))
        if st.get('ul') and st.get('uc'):
            p.append('58:2::' + self.rgb(st['uc']).replace(';', ':'))
        return ';'.join(p)


class Ansi16:
    """Roller → 16 ANSI-farger (terminalens egne). Se farger.json › ansi16."""
    def __init__(self, palett, modus):
        a = FARGER['ansi16']
        self.navn = f'ansi16-{"lys" if modus == "light" else "mork"}'
        sett = a[modus]
        self.aks = a['aksentAvPalett'][palett][modus]
        self.r = dict(sett['roller'])
        self.r.update({'kode.' + k: v for k, v in sett['kode'].items()})
        self.r.update({'kulor.' + k: v for k, v in sett['kulor'].items()})

    def idx(self, rolle):
        v = self.r[rolle]
        kursiv = False
        if isinstance(v, str) and v.endswith('+kursiv'):
            v, kursiv = int(v.split('+')[0]), True
        if v == 'palett':
            v = self.aks
        return v, kursiv

    def sgr(self, st):
        p = []
        fg, bg = st.get('fg', 'tekst'), st.get('bg', 'bg')
        if st.get('chip'):
            fg, bg = 'kode.string', 'bg'   # inline-kode: kodefarge, ingen brikke
        if st.get('b'): p.append('1')
        if bg == 'linje_bg':
            return ';'.join(p + ['7'])     # vims StatusLine/TabLineFill: reverse (fet beholdes)
        rev = bg in ('invertert_bg', 'markor_bg')
        f, kursiv = self.idx(fg)
        if st.get('i') or kursiv: p.append('3')
        if st.get('ul'): p.append('4:%d' % st['ul'])
        if rev:
            p.append('7')  # reverse video: terminalens forgrunn blir bakgrunn
            return ';'.join(p)
        if isinstance(f, int):
            p.append(str(30 + f if f < 8 else 90 + f - 8))
        b, _ = self.idx(bg) if bg in self.r else ('default', False)
        if isinstance(b, int):
            p.append(str(40 + b if b < 8 else 100 + b - 8))
        if st.get('ul') and st.get('uc'):
            u, _ = self.idx(st['uc'])
            if isinstance(u, int):
                p.append('58:5:%d' % u)
        return ';'.join(p)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Rutenett (§1)
# ═════════════════════════════════════════════════════════════════════════════════════════════════

class Rutenett:
    SATS_MAKS = 160   # bredere enn dette blir aldri innholdet; resten blir marg (sentrert)
    MAAL = 72         # målbredde for brødtekst, lister, sitater, callouts, plassholdere

    def __init__(self, W, H):
        self.W, self.H = W, H
        marg = max(4, round(W * 0.067))
        sats = W - 2 * marg
        if sats > self.SATS_MAKS:
            sats = self.SATS_MAKS
            marg = (W - sats) // 2
        self.x = marg
        self.sats = sats
        self.maal = min(sats, self.MAAL)
        self.luft = (H - 24) // 12            # 24→0, 36→1, 50→2: ekstra luft øverst og nederst
        self.topp = 2 + self.luft             # første rad under agendalinjen (rad 0) + luft
        self.bunn = H - 3 - (H - 24) // 24    # siste rad innhold kan bruke (24→21, 36→32, 50→46)
        self.status = H - 1


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Inline-tekst: [(tekst, stil)] med brekking
# ═════════════════════════════════════════════════════════════════════════════════════════════════

T = S(fg='tekst')
D = S(fg='dempet')
A = S(fg='aksent')
LENKE = S(fg='lenke', ul=1, uc='lenke')
KODE = S(fg='tekst', bg='flate_bg', chip=1)   # inline-kode: brikke på linje_bg (kode_bg er for nær bg i mørke paletter)
SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'


def md(tekst, basis=T):
    """Mini-markdown for mockup-innhold: **fet**, *kursiv*, `kode`, [[wikilenke]], [tekst](url), [^n]."""
    ut = []
    for m in re.finditer(r'\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[\[(.+?)\]\]|\[([^\]]+)\]\((\S+?)\)|\[\^(\d+)\]|([^*`\[]+|.)', tekst):
        if m.group(1): ut.append((m.group(1), basis + S(b=1)))
        elif m.group(2): ut.append((m.group(2), basis + S(i=1)))
        elif m.group(3): ut.append((m.group(3), basis + KODE))
        elif m.group(4): ut.append((m.group(4), basis + LENKE))
        elif m.group(5): ut.append((m.group(5), basis + LENKE + S(link=m.group(6))))
        elif m.group(7): ut.append((''.join(SUP[int(d)] for d in m.group(7)), basis + S(fg='aksent', b=1)))
        else: ut.append((m.group(8), basis))
    return ut


def bryt(spans, w, w2=None):
    """Bryter spans til linjer på bredde w (første) / w2 (resten). Ord brytes hardt bare hvis de er > w."""
    w2 = w2 or w
    # Del i ord. Et ord er alt mellom to mellomrom, også på tvers av stiler: «(`kode`).» er ETT ord,
    # så en kodebrikke aldri skilles fra parentesen eller punktumet ved siden av (§4.1).
    ord_, cur_ord = [], []
    for t, st in spans:
        if st.get('chip'):
            cur_ord.append((t, st))
            continue
        for del_ in re.findall(r'\S+|\s+', t):
            if del_.isspace():
                cur_ord.append((del_, st)); ord_.append(cur_ord); cur_ord = []
            else:
                cur_ord.append((del_, st))
    if cur_ord:
        ord_.append(cur_ord)
    linjer, cur, cw = [], [], 0
    grense = w
    for o in ord_:
        tekst = ''.join(t for t, _ in o)
        ow = bredde(tekst.rstrip())
        if cw + ow > grense and cur:
            linjer.append(cur); cur, cw = [], 0; grense = w2
            if tekst.isspace():
                continue
        while ow > grense:  # hardt brudd i ord som er lengre enn linjen (ingenting kuttes)
            rest, foran, n = [], [], grense - cw
            for t, st in o:
                if n >= len(t): foran.append((t, st)); n -= len(t)
                elif n > 0: foran.append((t[:n], st)); rest.append((t[n:], st)); n = 0
                else: rest.append((t, st))
            linjer.append(cur + foran); cur, cw = [], 0; grense = w2
            o = rest; tekst = ''.join(t for t, _ in o); ow = bredde(tekst.rstrip())
        cur += o; cw += bredde(tekst)
    if cur:
        linjer.append(cur)
    # fjern etterhengende mellomrom
    rens = []
    for l in linjer:
        if l and not l[-1][1].get('chip'):
            l = l[:-1] + [(l[-1][0].rstrip(), l[-1][1])]
        rens.append(l)
    return rens


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Figlet-hode (§3)
# ═════════════════════════════════════════════════════════════════════════════════════════════════

def figlet_linje(tekst, sett):
    g = FIGLET[sett]['glyfer']
    over = max((len(g[c].get('over', [])) for c in tekst if c in g), default=0)
    h = FIGLET[sett]['hoyde']
    rader = [''] * (over + h)
    for c in tekst:
        gl = g[c]
        w = len(gl['rader'][0])
        o = gl.get('over', [])
        for i in range(over):
            j = i - (over - len(o))
            rader[i] += (o[j].ljust(w) if 0 <= j < len(o) else ' ' * w)
        for i in range(h):
            rader[over + i] += gl['rader'][i]
    return [r.rstrip() for r in rader]


def figlet(tekst, maks_w, maks_h, maks_linjer=2):
    """Velger nivå: stor → kompakt → tekst. Bryter bare mellom ord. Returnerer (nivå, [linjer av rader])."""
    tekst = tekst.upper()
    for sett in ('stor', 'kompakt'):
        g = FIGLET[sett]['glyfer']
        if any(c not in g for c in tekst):
            continue  # tegn som ikke finnes i fonten (emoji, CJK …): aldri bland, gå videre
        ord_ = tekst.split(' ')
        linjer, cur = [], ''
        ok = True
        for o in ord_:
            prøv = (cur + ' ' + o).strip()
            if bredde(figlet_linje(prøv, sett)[-1]) <= maks_w and max(bredde(r) for r in figlet_linje(prøv, sett)) <= maks_w:
                cur = prøv
            else:
                if not cur:
                    ok = False; break
                linjer.append(cur); cur = o
                if max(bredde(r) for r in figlet_linje(cur, sett)) > maks_w:
                    ok = False; break
        if cur: linjer.append(cur)
        if not ok or len(linjer) > maks_linjer:
            continue
        blokker = [figlet_linje(l, sett) for l in linjer]
        hoyde = sum(len(b) for b in blokker) + (len(blokker) - 1)
        if hoyde <= maks_h:
            return sett, blokker
    return 'tekst', None


def tegn_figlet(sk, x, y, tekst, maks_w, maks_h, maks_linjer=2):
    nivaa, blokker = figlet(tekst, maks_w, maks_h, maks_linjer)
    if nivaa == 'tekst':
        # Fallback: fet aksent, brytes på ord (hardt i ord lengre enn satsen), tung strek under.
        linjer = bryt([(tekst, A + S(b=1))], maks_w)
        for l in linjer:
            sk.spans(x, y, l); y += 1
        sk.put(x, y, '━' * min(maks_w, max(bredde(''.join(t for t, _ in l)) for l in linjer)), S(fg='aksent'))
        return y + 1, nivaa
    fyll = FIGLET[nivaa]['fyll']
    for b in blokker:
        for rad in b:
            for i, ch in enumerate(rad):
                if ch == ' ':
                    continue
                skygge = nivaa == 'stor' and ch not in fyll
                sk.put(x + i, y, ch, S(fg='hode_skygge' if skygge else 'hode'))
            y += 1
        y += 1
    return y - 1, nivaa


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Kodefarger (enkel tokeniserer for mockupene; produksjon bruker Shiki, §4.3)
# ═════════════════════════════════════════════════════════════════════════════════════════════════

KW = {
    'java': r'\b(var|if|return|new|final|public|private|class|null|import)\b',
    'sql': r'\b(BEGIN|COMMIT|ALTER|TABLE|RENAME|TO|CREATE|PRIMARY|KEY|PARTITION|BY|RANGE|OF|FOR|VALUES|FROM|DEFAULT|INDEX|ON|WHERE|INSERT|INTO|SELECT|DROP|CONSTRAINT|ADD|FOREIGN|REFERENCES|ANALYZE|DO|IF|THEN|RAISE|EXCEPTION|END|NOT|NULL|CHECK|DESC)\b',
    'ts': r'\b(export|const|let|return|import|from|type)\b',
}


def farg_kode(linje, spr):
    kom = '--.*' if spr == 'sql' else '//.*'
    re_ = re.compile(r'(%s)|(\'[^\']*\'|"[^"]*")|\b(\d+)\b|%s|\b(uuid|text|bigint|timestamptz|Duration|Response)\b|\b([a-zA-Z_]\w*)(?=\()|(::|->|=|<>|>=)|([.,;(){}\[\]])' % (kom, KW[spr]))
    ut, pos = [], 0
    for m in re_.finditer(linje):
        if m.start() > pos:
            ut.append((linje[pos:m.start()], 'kode.foreground'))
        rolle = ['kode.comment', 'kode.string', 'kode.number', 'kode.keyword', 'kode.type', 'kode.function', 'kode.operator', 'kode.punctuation'][[i for i in range(1, 9) if m.group(i)][0] - 1]
        ut.append((m.group(0), rolle))
        pos = m.end()
    if pos < len(linje):
        ut.append((linje[pos:], 'kode.foreground'))
    return [(t, S(fg=r, bg='kode_bg', i=1 if r == 'kode.comment' else 0)) for t, r in ut]


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Blokker (§4). Hver blokk har hoyde(g, w) og tegn(sk, g, x, y, w, maks_h) → brukte rader.
# ═════════════════════════════════════════════════════════════════════════════════════════════════

class Avsnitt:
    def __init__(self, tekst, stil=T): self.spans = md(tekst, stil)
    def linjer(self, g): return bryt(self.spans, g.maal)
    def hoyde(self, g, w=None): return len(self.linjer(g))
    def tegn(self, sk, g, x, y, maks_h=None):
        for l in self.linjer(g):
            sk.spans(x, y, l); y += 1
        return y


class Liste:
    def __init__(self, punkter, nummerert=False): self.p, self.n = punkter, nummerert
    def linjer(self, g):
        ut = []
        for k, p in enumerate(self.p):
            merke = ('%d.' % (k + 1)).rjust(3) + ' ' if self.n else '  – '
            ls = bryt(md(p), g.maal - 4)
            for j, l in enumerate(ls):
                ut.append(([(merke if j == 0 else '    ', D)] + l))
        return ut
    def hoyde(self, g, w=None): return len(self.linjer(g))
    def tegn(self, sk, g, x, y, maks_h=None):
        for l in self.linjer(g):
            sk.spans(x - 2, y, l); y += 1  # tankestreken henger i margen (som v2: hengende tankestreker)
        return y


class Sitat:
    def __init__(self, tekst, kilde=None): self.t, self.k = tekst, kilde
    def linjer(self, g):
        ls = bryt(md(self.t, T + S(i=1)), g.maal - 3)
        if self.k:
            ls.append([('– ' + self.k, D)])
        return ls
    def hoyde(self, g, w=None): return len(self.linjer(g))
    def tegn(self, sk, g, x, y, maks_h=None):
        for l in self.linjer(g):
            sk.put(x, y, '▎', S(fg='aksent2'))
            sk.spans(x + 3, y, l); y += 1
        return y


CALLOUT = {  # type: (kulør, tegn, etikett)
    'note': ('blue', 'i', 'Merk'), 'info': ('blue', 'i', 'Info'), 'tip': ('teal', '*', 'Tips'),
    'success': ('green', '✓', 'Ferdig'), 'question': ('amber', '?', 'Spørsmål'), 'warning': ('orange', '!', 'Advarsel'),
    'danger': ('red', '‼', 'Fare'), 'bug': ('red', '✗', 'Feil'), 'example': ('plum', '≡', 'Eksempel'),
    'quote': ('grey', '”', 'Sitat'), 'abstract': ('teal', '≡', 'Sammendrag'), 'todo': ('blue', '☐', 'Gjøremål'),
}


class Callout:
    def __init__(self, typ, tittel, tekst): self.typ, self.tittel, self.t = typ, tittel, tekst
    def bredde(self, g): return min(g.sats, g.maal) + 4
    def linjer(self, g): return bryt(md(self.t), self.bredde(g) - 4)
    def tittellinjer(self, g):
        _, tegn, etikett = CALLOUT[self.typ]
        hode = len(' %s %s · ' % (tegn, etikett)) + 2
        return bryt([(self.tittel, T + S(b=1))], self.bredde(g) - 4 - hode + 2, self.bredde(g) - 4)
    def hoyde(self, g, w=None): return 2 + len(self.tittellinjer(g)) - 1 + len(self.linjer(g)) + 0 + 1
    def tegn(self, sk, g, x, y, maks_h=None):
        kul, tegn, etikett = CALLOUT[self.typ]
        k = S(fg='kulor.' + kul)
        w = self.bredde(g)
        x -= 2  # rammen henger i margen; teksten står i satsens venstrekant (§4.4)
        # topp: ╭─ ? Spørsmål ─────────────╮  (etiketten står i rammen, fet kulør)
        sk.put(x, y, '╭─', k)
        e = sk.put(x + 2, y, ' %s %s ' % (tegn, etikett), k + S(b=1))
        sk.put(e, y, '─' * (x + w - 1 - e), k); sk.put(x + w - 1, y, '╮', k)
        y += 1
        tl = self.tittellinjer(g)
        for l in tl:
            sk.put(x, y, '│', k); sk.spans(x + 2, y, l); sk.put(x + w - 1, y, '│', k); y += 1
        for l in self.linjer(g):
            sk.put(x, y, '│', k); sk.spans(x + 2, y, l); sk.put(x + w - 1, y, '│', k); y += 1
        sk.put(x, y, '╰' + '─' * (w - 2) + '╯', k)
        return y + 1


class Kode:
    def __init__(self, fil, spr, kilde, start=0): self.fil, self.spr, self.l, self.start = fil, spr, kilde.split('\n'), start
    def bredde(self, g): return g.sats
    def visuelle(self, g):
        """(linjenr|None, spans): lange linjer brytes med ↪ i rennen (vims showbreak), ingenting kuttes."""
        nw = len(str(len(self.l)))
        tw = self.bredde(g) - 2 - nw - 2 - 1  # luft · nr · 2 · tekst · luft
        ut = []
        for n, linje in enumerate(self.l, 1):
            spans = farg_kode(linje, self.spr)
            biter = bryt(spans, tw) if bredde(linje) > tw else [spans]
            for j, b in enumerate(biter or [[]]):
                ut.append((n if j == 0 else None, b))
        return ut, nw
    def hoyde(self, g, w=None): return len(self.visuelle(g)[0]) + 3   # hode + luft over + innhold + luft under
    def min_hoyde(self): return 6
    def tegn(self, sk, g, x, y, maks_h=None):
        w = self.bredde(g)
        vis, nw = self.visuelle(g)
        h = len(vis) + 3
        rull = maks_h is not None and h > maks_h
        hh = min(h, maks_h) if maks_h else h
        sk.fyll(x, y, w, hh, 'kode_bg')
        # hode: ● filnavn ……… språk
        sk.put(x + 2, y, '●', S(fg='aksent', bg='kode_bg'))
        sk.put(x + 4, y, self.fil, S(fg='kode_tekst', bg='kode_bg', b=1))
        sk.put(x + w - 2 - len(self.spr), y, self.spr, S(fg='dempet', bg='kode_bg'))
        sk.put(x + 1, y + 1, '╌' * (w - 2), S(fg='dekor', bg='kode_bg'))
        synlig = (hh - 3) if rull else len(vis)
        if rull:
            synlig = hh - 3  # hode + strek + hintlinje
        start = self.start
        for k, (n, spans) in enumerate(vis[start:start + synlig]):
            yy = y + 2 + k
            nr = (str(n).rjust(nw) if n else '↪'.rjust(nw))
            sk.put(x + 2, yy, nr, S(fg='dempet', bg='kode_bg'))
            sk.spans(x + 2 + nw + 2, yy, spans)
        if rull:
            yy = y + hh - 1
            igjen = len(vis) - start - synlig
            sk.put(x + 2, yy, '↓ %d linjer til' % igjen, S(fg='tekst', bg='kode_bg', b=1))
            sk.put(x + 2 + len('↓ %d linjer til' % igjen), yy, ' · ↑ ↓ ruller', S(fg='dempet', bg='kode_bg'))
            pos = '%d–%d av %d' % (start + 1, start + synlig, len(vis))
            sk.put(x + w - 2 - len(pos), yy, pos, S(fg='dempet', bg='kode_bg'))
            # rullefelt i høyre kant av kodeflaten
            spor = synlig
            tommel = max(1, round(spor * synlig / len(vis)))
            t0 = round(spor * start / len(vis))
            for k in range(spor):
                sk.put(x + w - 1, y + 2 + k, '┃' if t0 <= k < t0 + tommel else '│', S(fg='dempet' if t0 <= k < t0 + tommel else 'dekor', bg='kode_bg'))
            return y + hh
        return y + hh


STATUS = {'done': ('●', 'ok'), 'doing': ('◐', 'kulor.amber'), 'todo': ('○', 'dempet')}


class Tabell:
    """Booktabs: tung strek over og under (━), lett under hodet (─), ingen loddrette streker (§4.5)."""
    def __init__(self, hode, rader, hoyre=(), tittel=None, base=None):
        self.h, self.r, self.hoyre, self.tittel, self.base = hode, rader, set(hoyre), tittel, base
    def celle(self, v):
        if isinstance(v, tuple) and v[0] == 'status':
            g, f = STATUS[v[1]]
            return [(g + ' ' + v[1], S(fg=f))]
        if isinstance(v, tuple) and v[0] == 'tom':
            return [(v[1], D + S(i=1))]
        return md(v)
    def bredder(self):
        cols = len(self.h)
        return [max([bredde(self.h[c])] + [bredde(''.join(t for t, _ in self.celle(r[c]))) for r in self.r]) for c in range(cols)]
    def hoyde(self, g, w=None):
        return len(self.r) + 4 + (1 if self.tittel else 0) + (2 if self.base else 0)
    def tegn(self, sk, g, x, y, maks_h=None):
        bw = self.bredder()
        gap = 3
        tw = sum(bw) + gap * (len(bw) - 1)
        if self.base:
            # base-hodet setter minstebredden; overskuddet går til navnekolonnen, så strekene aldri er
            # lengre enn innholdet
            src, view, n, live = self.base
            hw = len(src) + 5 + len(view) + 5 + len(n) + 4 + len(live)
            if hw > tw:
                bw[0] += hw - tw; tw = hw
        if self.base:
            src, view, n, live = self.base
            e = sk.put(x, y, src, T + S(b=1))
            e = sk.put(e, y, '  ›  ', D)
            e = sk.put(e, y, view, T + S(i=1))
            e = sk.put(e, y, '  ·  %s' % n, D)
            sk.put(x + tw - len('● ' + live), y, '●', S(fg='ok'))
            sk.put(x + tw - len(live), y, live, D)
            y += 2
        if self.tittel:
            sk.spans(x, y, md(self.tittel, D + S(i=1))); y += 1
        sk.put(x, y, '━' * tw, S(fg='strek')); y += 1
        cx = x
        for c, hd in enumerate(self.h):
            t = hd.rjust(bw[c]) if c in self.hoyre else hd
            sk.put(cx, y, t, D + S(b=1)); cx += bw[c] + gap
        y += 1
        sk.put(x, y, '─' * tw, S(fg='strek')); y += 1
        for r in self.r:
            cx = x
            for c in range(len(self.h)):
                sp = self.celle(r[c])
                cw = bredde(''.join(t for t, _ in sp))
                sk.spans(cx + (bw[c] - cw if c in self.hoyre else 0), y, sp)
                cx += bw[c] + gap
            y += 1
        sk.put(x, y, '━' * tw, S(fg='strek'))
        return y + 1


class Plassholder:
    """Diskret, stiplet ramme i målbredde (§4.7). Teksten er fast (T3); detaljlinjen er valgfri."""
    def __init__(self, tekst, detalj=None): self.t, self.d = tekst, detalj
    def hoyde(self, g, w=None): return 3 + (1 if self.d else 0)
    def tegn(self, sk, g, x, y, maks_h=None):
        w = g.maal + 4
        x -= 2  # hengende ramme, som callouts
        k = S(fg='strek')
        sk.put(x, y, '┌' + '╌' * (w - 2) + '┐', k); y += 1
        sk.put(x, y, '┆', k); sk.put(x + 2, y, self.t, D + S(b=1)); sk.put(x + w - 1, y, '┆', k); y += 1
        if self.d:
            sk.put(x, y, '┆', k); sk.put(x + 2, y, self.d, D, maks=x + w - 2); sk.put(x + w - 1, y, '┆', k); y += 1
        sk.put(x, y, '└' + '╌' * (w - 2) + '┘', k)
        return y + 1


class Bilde:
    def __init__(self, navn, alt=None): self.n, self.alt = navn, alt
    def hoyde(self, g, w=None): return 1
    def tegn(self, sk, g, x, y, maks_h=None):
        e = sk.put(x, y, '[bilde: %s]' % self.n, D)
        if self.alt:
            sk.put(e, y, '  ' + self.alt, D + S(i=1), maks=x + g.maal)
        return y + 1


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Lysbildemodell (samme som v2: tittel → agenda → overgang → innhold, «(forts.)»)
# ═════════════════════════════════════════════════════════════════════════════════════════════════

JAVA = '''var key = request.header("Idempotency-Key");
if (key == null) return chain.proceed(request);

return store.findResponse(key)
    .map(Response::replay)          // samme svar, ingen ny ordre
    .orElseGet(() -> {
      var response = chain.proceed(request);
      store.save(key, response, Duration.ofHours(24));
      return response;
    });'''

SQL = '''-- V12__partisjoner_ordre.sql
-- Partisjonerer ordre per måned. Kjøres i vedlikeholdsvindu (ca. 6 min).

BEGIN;

ALTER TABLE ordre RENAME TO ordre_gammel;

CREATE TABLE ordre (
  id            uuid        NOT NULL,
  kunde_id      uuid        NOT NULL,
  status        text        NOT NULL,
  belop_ore     bigint      NOT NULL CHECK (belop_ore >= 0),
  opprettet     timestamptz NOT NULL DEFAULT now(),
  oppdatert     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, opprettet)
) PARTITION BY RANGE (opprettet);

CREATE TABLE ordre_2026_10 PARTITION OF ordre
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE ordre_2026_11 PARTITION OF ordre
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE ordre_2026_12 PARTITION OF ordre
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE ordre_2027_01 PARTITION OF ordre
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE ordre_standard PARTITION OF ordre DEFAULT;

CREATE INDEX ordre_kunde_idx  ON ordre (kunde_id, opprettet DESC);
CREATE INDEX ordre_status_idx ON ordre (status) WHERE status <> 'levert';

INSERT INTO ordre (id, kunde_id, status, belop_ore, opprettet, oppdatert)
SELECT id, kunde_id, status, belop_ore, opprettet, oppdatert
  FROM ordre_gammel;

-- Outbox peker på ordre via id alene; fremmednøkkelen må gjenopprettes
ALTER TABLE outbox DROP CONSTRAINT outbox_ordre_fk;
ALTER TABLE outbox
  ADD CONSTRAINT outbox_ordre_fk
  FOREIGN KEY (ordre_id, ordre_opprettet)
  REFERENCES ordre (id, opprettet);

ANALYZE ordre;

-- Kontroll: like mange rader før og etter
DO $$
BEGIN
  IF (SELECT count(*) FROM ordre) <> (SELECT count(*) FROM ordre_gammel) THEN
    RAISE EXCEPTION 'Antall rader stemmer ikke';
  END IF;
END $$;

COMMIT;'''

DECK = {
    'tittel': 'Statusmøte uke 45',
    'sti': ['rapporter', 'statusmøter'],
    'ingress': 'Ordreplattformen er i rute for desemberleveransen. Idempotens er i produksjon, outbox-mønsteret er i test, og vi trenger en avklaring om lagringstid før 20. november.',
    'pre': 'Referat føres i [[Møtereferat uke 45]]. Forrige møte: [[Statusmøte uke 43]].',
    'props': [('prosjekt', [('Ordreplattform', LENKE)]), ('møtedato', [('9. nov. 2026', T)]),
              ('status', [('◐ i rute', S(fg='kulor.amber'))]), ('deltakere', [('Kari N., Ola H., Sindre V.', T)]), ('sprint', [('12', T)])],
    'endret': 'Endret 6. nov. 2026, 14.20',
    'seksjoner': [
        ('Siden sist', [
            ('Idempotente ordre-kall', [
                Avsnitt('Klienten sender `Idempotency-Key`, og svaret lagres i 24 timer.'),
                Liste(['I produksjon siden 4. november', '**0 doble ordre** siste uke (før: 3–5 per uke)', 'Beslutningen står i [[ADR-014 Idempotens]]']),
                Kode('IdempotencyFilter.java', 'java', JAVA),
            ], []),
            ('Outbox-mønsteret', [
                Avsnitt('Ordren og hendelsen skrives i samme transaksjon. En relay publiserer fra outbox-tabellen til Kafka.'),
                Plassholder('Mermaid-diagram – vises i web-leseren', 'flowchart LR · 7 noder · «Ordre-API → outbox → Relay → Kafka»'),
                Sitat('Ingen hendelse uten ordre, ingen ordre uten hendelse.', 'ADR-016'),
                Bilde('outbox-sekvens.png', 'Sekvensdiagram fra arkitekturmøtet'),
                Tabell(['Måling', 'Før', 'Etter'], [['Ordre per minutt, p95', '1 900', '2 400'], ['Forsinkelse til Kafka, p95', '–', '180 ms'],
                                                    ['Tapte hendelser per døgn', '7', '0'], ['Doble hendelser per døgn', '–', '0[^2]']],
                       hoyre=(1, 2), tittel='Målinger i staging[^1]'),
                Avsnitt('Relayen kjører i to instanser med ledervalg i Postgres (`pg_advisory_lock`). Detaljer i [runbook for relay](https://wiki.eksempel.invalid/ordre/relay).'),
            ], ['Staging 2.–6. november, syntetisk last på 2 400 ordre per minutt.',
                'Konsumentene er idempotente, så eventuelle duplikater ville uansett blitt forkastet.']),
        ]),
        ('Jobbes med nå', [
            ('Java 21-migrering', [
                Avsnitt('To av seks tjenester gjenstår etter planen. `varsling` mangler eier.'),
                Tabell(['Tjeneste', 'Status', 'Java', 'Eier', 'Ferdig'], [
                    ['[[ordre-api]]', ('status', 'done'), '21', 'Kari', '30.10.2026'],
                    ['[[betaling]]', ('status', 'doing'), '17 → 21', 'Ola', '15.11.2026'],
                    ['[[lager]]', ('status', 'doing'), '17 → 21', 'Sindre', '20.11.2026'],
                    ['[[faktura]]', ('status', 'todo'), '17', 'Ola', '04.12.2026'],
                    ['[[varsling]]', ('status', 'todo'), '11', ('tom', 'ikke satt'), '11.12.2026'],
                    ['[[rapport-batch]]', ('status', 'todo'), '11', 'Kari', '18.12.2026']],
                    hoyre=(4,), base=('Tjenester.base', 'Java 21-migrering', '6 tjenester', 'live')),
                Plassholder('Kanban: Sprinttavle – vises i web-leseren', 'Oppgaver.base · 11 kort: todo 3 · doing 3 · review 2 · done 3'),
            ], []),
        ]),
        ('Relativt nær framtid', [
            ('Flyway V12: partisjonert ordretabell', [
                Callout('question', 'Hvor lenge beholder vi ordrehistorikk?', 'Juridisk anbefaler fem år (bokføringsloven), produkt ønsker tre. Beslutning trengs innen **20. november**, ellers lages partisjonene for fem år.'),
                Kode('V12__partisjoner_ordre.sql', 'sql', SQL or '-- mangler mockup-v12.sql'),
            ], []),
        ]),
    ],
}


def referanser(b):
    """Fotnotenumre som står i en blokk ([^n] i tekst, tabelltittel og celler)."""
    tekst = json.dumps(b.__dict__, default=str, ensure_ascii=False)
    return sorted({int(n) for n in re.findall(r'\[\^(\d+)\]', tekst)})


def notehoyde(g, noter, blokker):
    refs = sorted({n for b in blokker for n in referanser(b)})
    if not refs:
        return 0, []
    valgt = [(n, noter[n - 1]) for n in refs if n <= len(noter)]
    if g.sats - g.maal - 6 >= 34:
        return 0, valgt  # marginalia: tar ingen høyde fra lysbildet
    return 1 + sum(len(bryt(md(t, D), g.maal - 3)) for _, t in valgt), valgt


def paginer(deck, g, uten_agenda=False):
    """Lysbilder for et rutenett (§2.6). Innholdslysbilder deles MELLOM blokker («(forts.)») når de ikke får
    plass. Fotnoter følger delen der henvisningen står. En blokk som er for stor også alene, blir stående og
    ruller internt (ingen foreldreløse lysbilder). Enkeregel: en siste del på under en firedel av høyden får
    med seg blokken foran, hvis begge delene da får plass."""
    ut = [{'type': 'tittel'}, {'type': 'agenda'}]
    tilgjengelig = g.bunn - (g.topp + 3) + 1  # under nummer, tittel og én tom rad

    def hoyde(bl, noter):
        nh = notehoyde(g, noter, bl)[0]
        return sum(b.hoyde(g) for b in bl) + max(0, len(bl) - 1) + nh + (1 if nh else 0)

    for si, (stittel, slides) in enumerate(deck['seksjoner']):
        ut.append({'type': 'overgang', 'sek': si})
        for tittel, blokker, noter in slides:
            deler, cur = [], []
            for b in blokker:
                if cur and hoyde(cur + [b], noter) > tilgjengelig and b.hoyde(g) <= tilgjengelig:
                    deler.append(cur); cur = [b]
                elif cur and b.hoyde(g) > tilgjengelig and any(x.hoyde(g) > tilgjengelig for x in cur):
                    deler.append(cur); cur = [b]   # to rullende blokker deler aldri lysbilde
                else:
                    cur.append(b)                  # også en for stor blokk: den blir her og ruller
            deler.append(cur)
            while len(deler) >= 2 and hoyde(deler[-1], noter) < tilgjengelig / 4 and len(deler[-2]) >= 2 \
                    and hoyde(deler[-2][:-1], noter) >= tilgjengelig / 4 \
                    and hoyde([deler[-2][-1]] + deler[-1], noter) <= tilgjengelig:
                deler[-1].insert(0, deler[-2].pop())
            for k, d in enumerate(deler):
                ut.append({'type': 'innhold', 'sek': si, 'tittel': tittel, 'blokker': d, 'forts': k > 0,
                           'noter': notehoyde(g, noter, d)[1]})
    # progresjon i seksjonen og første lysbilde per seksjon
    for i, s in enumerate(ut):
        s['nr'] = i + 1
    for si in range(len(deck['seksjoner'])):
        inn = [s for s in ut if s['type'] == 'innhold' and s['sek'] == si]
        for k, s in enumerate(inn):
            s['prog'] = (k + 1, len(inn))
    return ut


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Krom: agendalinje (tabline) og statuslinje (§2.3–2.4)
# ═════════════════════════════════════════════════════════════════════════════════════════════════

def kort(t, n):
    return t if bredde(t) <= n else t[:max(1, n - 1)].rstrip() + '…'


def agendalinje(sk, g, deck, cur_sek, prog):
    W = sk.W
    sk.fyll(0, 0, W, 1, 'linje_bg')
    navn = [s[0] for s in deck['seksjoner']]
    ledig = g.sats

    def bygg(idx, forkort_nabo=None, forkort_cur=None):
        deler = []
        if idx[0] > 0: deler.append(('…', None))
        for i in idx:
            t = navn[i]
            if i != cur_sek and forkort_nabo: t = kort(t, forkort_nabo)
            if i == cur_sek and forkort_cur: t = kort(t, forkort_cur)
            deler.append((t, i))
        if idx[-1] < len(navn) - 1: deler.append(('…', None))
        return deler

    def lengde(deler):
        n = 0
        for t, i in deler:
            n += (bredde(t) + 2 if i is None else len(str(i + 1)) + 1 + bredde(t) + 2 + (len('%d/%d' % prog) + 1 if i == cur_sek else 0)) + 1
        return n

    alle = list(range(len(navn)))
    naer = [i for i in (cur_sek - 1, cur_sek, cur_sek + 1) if 0 <= i < len(navn)]
    for kandidat in (bygg(alle), bygg(naer), bygg(naer, forkort_nabo=14), bygg(naer, forkort_nabo=8, forkort_cur=ledig // 3), bygg([cur_sek], forkort_cur=ledig - 16)):
        if lengde(kandidat) <= ledig:
            break
    x = g.x - 1
    for k, (t, i) in enumerate(kandidat):
        if k:
            sk.put(x, 0, '│', S(fg='dekor', bg='linje_bg')); x += 1
        if i is None:
            x = sk.put(x, 0, ' … ', S(fg='dempet', bg='linje_bg'))
            continue
        if i == cur_sek:
            # valgt fane = smelter sammen med lerretet (vims TabLineSel), nummer i aksent, navn fet med aksentstrek
            st = S(bg='bg')
            x = sk.put(x, 0, ' ', st)
            x = sk.put(x, 0, str(i + 1) + ' ', st + S(fg='aksent', b=1))
            x = sk.put(x, 0, t, st + S(fg='tekst', b=1, ul=1, uc='aksent'))
            x = sk.put(x, 0, ' %d/%d ' % prog, st + S(fg='dempet'))
        else:
            x = sk.put(x, 0, ' %d %s ' % (i + 1, t), S(fg='dempet', bg='linje_bg'))


def fremdrift(slides, nr):
    """━ for passerte lysbilder, ─ for gjenstående, mellomrom mellom seksjoner. Maks 1 tegn per lysbilde."""
    ut = []
    forrige = None
    for s in slides:
        sek = s.get('sek', -1) if s['type'] != 'agenda' else -1
        if forrige is not None and sek != forrige:
            ut.append((' ', None))
        forrige = sek
        ut.append(('━', 'fremdrift') if s['nr'] <= nr else ('─', 'fremdrift_spor'))
    return ut


def statuslinje(sk, g, deck, slides, nr, tittelside=False, hint=None, modus=None):
    y = sk.H - 1
    sk.fyll(0, y, sk.W, 1, 'linje_bg')
    L = S(bg='linje_bg')
    x = g.x - 1
    if modus:
        x = sk.put(x, y, ' %s ' % modus, S(fg='invertert_tekst', bg='aksent', b=1)) + 1
    if tittelside:
        # tittelsiden: ingen folio og ingen fremdrift (PO-95), bare starthintet
        e = sk.put(x + 1, y, 'Presentasjon', L + S(fg='tekst', b=1))
        if sk.W > 160:
            # Brede terminaler gir liten skrift i delt skjerm: foreslå større skrift (bare på tittelsiden)
            sk.spans(e, y, [('  ·  %d × %d: ' % (sk.W, sk.H), L + S(fg='dempet')), ('Ctrl +', L + S(fg='tekst', b=1)), (' gir større tekst i Teams og Zoom', L + S(fg='dempet'))])
        taster = [('→', 'neste'), ('o', 'oversikt'), ('?', 'taster'), ('q', 'avslutt')]
        hint_sp = []
        for k, (t, f) in enumerate(taster):
            hint_sp += [(('  ·  ' if k else ''), L + S(fg='dempet')), (t, L + S(fg='tekst', b=1)), (' ' + f, L + S(fg='dempet'))]
        hb = bredde(''.join(t for t, _ in hint_sp))
        sk.spans(g.x + g.sats - hb, y, hint_sp)
        return
    x = sk.put(x + 1, y, deck['tittel'], L + S(fg='dempet'))
    # høyre: hint · fremdrift · n/N  (n/N står ALLTID sist på raden, høyrejustert mot satsen)
    folio = [(str(nr), L + S(fg='tekst', b=1)), ('/%d' % len(slides), L + S(fg='dempet'))]
    fw = bredde(''.join(t for t, _ in folio))
    fr = fremdrift(slides, nr)
    taster = hint if hint is not None else ([('j k', 'blar'), ('o', 'oversikt'), (':', 'kommando'), ('?', 'hjelp')] if g.sats >= 100 else [('?', 'hjelp')])
    hint_sp = []
    for k, (t, f) in enumerate(taster):
        hint_sp += [(('  ·  ' if k else ''), L + S(fg='dempet')), (t, L + S(fg='tekst', b=1)), (' ' + f, L + S(fg='dempet'))]
    hb = bredde(''.join(t for t, _ in hint_sp))
    hoyre = g.x + g.sats
    sk.spans(hoyre - fw, y, folio)
    fx = hoyre - fw - 2 - len(fr)
    for k, (t, r) in enumerate(fr):
        if r: sk.put(fx + k, y, t, L + S(fg=r))
    if fx - 3 - hb > x + 2:
        sk.spans(fx - 3 - hb, y, hint_sp)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Lysbildetyper (§2)
# ═════════════════════════════════════════════════════════════════════════════════════════════════

def tegn_tittel(sk, g, deck, slides):
    # Hodet: figlet av tittelen (maks 2 linjer), ellers kompakt, ellers fet tekst (§3)
    blokk_h = 1 + 1 + 13 + 1 + 4 + 1 + 1 + len(deck['props']) + 2
    y = max(g.topp, round((sk.H - blokk_h) * 0.38))
    e = sk.put(g.x, y, '~/', A + S(b=1))
    for k, s in enumerate(deck['sti']):
        e = sk.put(e, y, (' / ' if k else '') + s, D)
    y += 2
    y, nivaa = tegn_figlet(sk, g.x, y, deck['tittel'], g.sats, max(3, (sk.H - 14) // 1), 2)
    y += 1
    for l in bryt(md(deck['ingress'], D + S(i=1)), g.maal):
        sk.spans(g.x, y, l); y += 1
    y += 1
    for l in bryt(md(deck['pre']), g.maal):
        sk.spans(g.x, y, l); y += 1
    y += 1
    kw = max(len(k) for k, _ in deck['props'])
    if sk.H - 3 - y >= len(deck['props']) + 2:
        for k, v in deck['props']:
            sk.put(g.x, y, '│', S(fg='dekor'))
            sk.put(g.x + 2, y, k.ljust(kw), D)
            sk.spans(g.x + 2 + kw + 3, y, v); y += 1
        y += 1
    if y < sk.H - 2:
        sk.put(g.x, y, deck['endret'], D)
    statuslinje(sk, g, deck, slides, 1, tittelside=True)
    return nivaa


def agendaliste(sk, g, deck, slides, y, cur=None):
    """Innholdsfortegnelse: 01  Navn · · · · · · 4 (lysbildenummer der seksjonen starter)."""
    w = min(g.sats, g.maal + 8)
    luft = 1 if (sk.H >= 30 or cur is None) else 0
    start = {s['sek']: s['nr'] for s in reversed(slides) if s['type'] == 'overgang'}
    sk.put(g.x + w - len('lysbilde'), y, 'lysbilde', D); y += 1 + (1 if sk.H >= 30 else 0)
    for i, (navn, sl) in enumerate(deck['seksjoner']):
        nr = '%02d' % (i + 1)
        side = str(start[i])
        tilst = None if cur is None else ('forbi' if i < cur else 'her' if i == cur else 'neste')
        if tilst == 'her':
            sk.fyll(g.x - 2, y, w + 4, 1, 'invertert_bg')
            st = S(fg='invertert_tekst', bg='invertert_bg')
            sk.put(g.x, y, nr, st + S(b=1))
            e = sk.put(g.x + 4, y, navn, st + S(b=1))
            ld = st
        else:
            farge = 'dempet' if tilst == 'forbi' else 'tekst'
            sk.put(g.x, y, nr, S(fg='dempet' if tilst == 'forbi' else 'aksent', b=1))
            e = sk.put(g.x + 4, y, navn, S(fg=farge, b=1 if tilst != 'forbi' else 0))
            ld = S(fg='dekor')
        # prikkede ledere: «·» annenhver celle, aldri tettere (ingen moaré i video)
        lx = e + 2 if (e + 2) % 2 == (g.x % 2) else e + 3
        for xx in range(lx, g.x + w - len(side) - 1, 2):
            sk.put(xx, y, '·', ld)
        sk.put(g.x + w - len(side), y, side, (st + S(b=1)) if tilst == 'her' else D)
        y += 1
        if tilst == 'her':
            # du er her: lysbildene i seksjonen som et tre (uten «(forts.)»)
            barn = [s for s in slides if s['type'] == 'innhold' and s['sek'] == i and not s['forts']]
            for k, b in enumerate(barn):
                sk.put(g.x + 4, y, ('└── ' if k == len(barn) - 1 else '├── '), S(fg='dekor'))
                sk.put(g.x + 8, y, b['tittel'], D)
                y += 1
        y += luft
    return y


def tegn_agenda(sk, g, deck, slides, cur=None):
    y = g.topp + (1 if sk.H >= 30 else 0)
    if cur is None:
        kicker = [('%s · %d punkter' % (deck['tittel'], len(deck['seksjoner'])), D)]
        hode = 'Agenda'
    else:
        kicker = [('%02d / %02d' % (cur + 1, len(deck['seksjoner'])), A + S(b=1)), ('  du er her', D)]
        hode = deck['seksjoner'][cur][0]
    sk.spans(g.x, y, kicker); y += 2
    rest = sk.H - 3 - y - (len(deck['seksjoner']) * 2 + 4)
    y, nivaa = tegn_figlet(sk, g.x, y, hode, g.sats, rest, 2)
    y += 2 if sk.H >= 30 else 1
    agendaliste(sk, g, deck, slides, y, cur)
    nr = [s for s in slides if (s['type'] == 'agenda' and cur is None) or (s['type'] == 'overgang' and s['sek'] == cur)][0]['nr']
    statuslinje(sk, g, deck, slides, nr)
    return nivaa


def tegn_innhold(sk, g, deck, slides, s, rull=0):
    agendalinje(sk, g, deck, s['sek'], s['prog'])
    y = g.topp
    sk.put(g.x, y, '%02d /' % (s['sek'] + 1), A + S(b=1)); y += 1
    tl = bryt([(s['tittel'], T + S(b=1))], g.sats - 12)
    for k, l in enumerate(tl):
        e = sk.spans(g.x, y, l)
        if k == len(tl) - 1:
            if s['forts']:
                e = sk.put(e + 1, y, '(forts.)', D)
            # tittelstreken: lett strek i dekor ut til satsens kant gir tittelen vekt uten større skrift
            sk.put(e + 2, y, '─' * (g.x + g.sats - e - 2), S(fg='dekor'))
        y += 1
    y += 1
    # fotnoter nederst; reserver plass
    noter = s.get('noter') or []
    notlinjer = []
    for k, n in noter:
        ls = bryt(md(n, D), g.maal - 2)
        for j, l in enumerate(ls):
            notlinjer.append([((SUP[k] + ' ') if j == 0 else '  ', S(fg='aksent', b=1) if j == 0 else D)] + l)
    # Brede terminaler (≥ 40 ledige kolonner til høyre for målbredden): fotnoter som marginalia ved siden av
    # blokken med henvisningen, som i leseren. Ellers nederst på lysbildet.
    marg_x = g.x + g.maal + 6
    marginalia = notlinjer and (g.x + g.sats - marg_x) >= 34
    bunn = g.bunn - (len(notlinjer) + 1 if notlinjer and not marginalia else 0)
    for k, b in enumerate(s['blokker']):
        if k:
            y += 1
        if marginalia and referanser(b):
            my = y
            sk.put(marg_x - 3, my, '│', S(fg='dekor'))
            for n, t in noter:
                if n not in referanser(b): continue
                for j, l in enumerate(bryt(md(t, D), min(48, g.x + g.sats - marg_x))):
                    if j == 0: sk.put(marg_x - 2, my, SUP[n], S(fg='aksent', b=1))
                    sk.spans(marg_x, my, l); sk.put(marg_x - 3, my, '│', S(fg='dekor')); my += 1
                my += 1
        if isinstance(b, Kode):
            b.start = rull
            y = b.tegn(sk, g, g.x, y, maks_h=bunn - y + 1)
        else:
            y = b.tegn(sk, g, g.x, y)
    if notlinjer and not marginalia:
        y = g.bunn - len(notlinjer) + 1
        sk.put(g.x, y - 1, '────────', S(fg='dekor'))
        for l in notlinjer:
            sk.spans(g.x, y, l); y += 1
    statuslinje(sk, g, deck, slides, s['nr'])


def tegn_lysbilde(W, H, nr, deck=DECK, rull=0):
    g = Rutenett(W, H)
    slides = paginer(deck, g)
    sk = Skjerm(W, H)
    s = slides[nr - 1]
    if s['type'] == 'tittel': tegn_tittel(sk, g, deck, slides)
    elif s['type'] == 'agenda': tegn_agenda(sk, g, deck, slides)
    elif s['type'] == 'overgang': tegn_agenda(sk, g, deck, slides, cur=s['sek'])
    else: tegn_innhold(sk, g, deck, slides, s, rull)
    return sk, g, slides


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Overlegg og tilstander (§5)
# ═════════════════════════════════════════════════════════════════════════════════════════════════

def flytevindu(sk, x, y, w, h, tittel, hoyre=None):
    """nvim-flytevindu: runde hjørner i strek, tittel i rammen, flate i linje_bg (§5)."""
    sk.fyll(x, y, w, h, 'flate_bg', tom=True)
    k = S(fg='strek', bg='flate_bg')
    sk.put(x, y, '╭' + '─' * (w - 2) + '╮', k)
    for yy in range(y + 1, y + h - 1):
        sk.put(x, yy, '│', k); sk.put(x + w - 1, yy, '│', k)
    sk.put(x, y + h - 1, '╰' + '─' * (w - 2) + '╯', k)
    sk.put(x + 2, y, ' %s ' % tittel, S(fg='tekst', bg='flate_bg', b=1))
    if hoyre:
        sk.put(x + w - 3 - len(hoyre), y, ' %s ' % hoyre, S(fg='dempet', bg='flate_bg'))


def oversikt(W, H, cur_nr, markor_nr):
    g = Rutenett(W, H)
    slides = paginer(DECK, g)
    sk = Skjerm(W, H)
    y = g.topp
    sk.put(g.x, y, 'Oversikt', T + S(b=1))
    sk.put(g.x + 10, y, '%d lysbilder · %d punkter' % (len(slides), len(DECK['seksjoner'])), D)
    y += 2
    w = min(g.sats, 84)
    rader = []
    for s in slides:
        if s['type'] == 'tittel': t, typ, inn = DECK['tittel'], 'tittel', 0
        elif s['type'] == 'agenda': t, typ, inn = 'Agenda', 'agenda', 0
        elif s['type'] == 'overgang': t, typ, inn = '%02d  %s' % (s['sek'] + 1, DECK['seksjoner'][s['sek']][0]), 'overgang', 0
        else:
            t, typ, inn = s['tittel'] + (' (forts.)' if s['forts'] else ''), '', 1
            innh = [type(b).__name__ for b in s['blokker']]
            typ = ' · '.join(dict.fromkeys({'Kode': 'kode', 'Tabell': 'tabell', 'Callout': 'callout', 'Plassholder': 'plassholder', 'Bilde': 'bilde'}.get(n, '') for n in innh if n in ('Kode', 'Tabell', 'Callout', 'Plassholder', 'Bilde')))
        rader.append((s, t, typ, inn))
    for s, t, typ, inn in rader:
        er_markor = s['nr'] == markor_nr
        er_naa = s['nr'] == cur_nr
        if s['type'] == 'overgang':
            y += 1 if H >= 30 else 0
        base = S(fg='markor_tekst', bg='markor_bg') if er_markor else S()
        if er_markor:
            sk.fyll(g.x - 2, y, w + 4, 1, 'markor_bg')
        sk.put(g.x - 2, y, '▌' if er_markor else ' ', S(fg='fokus', bg='markor_bg') if er_markor else S())
        sk.put(g.x, y, str(s['nr']).rjust(2), base + (S(fg='aksent', b=1) if not er_markor else S(b=1)))
        x = g.x + 5 + (4 if inn else 0)
        if inn:
            sk.put(g.x + 5, y, '│', base + (S(fg='dekor') if not er_markor else S()))
        st = base + (S(fg='tekst', b=1 if s['type'] != 'innhold' else 0) if not er_markor else S(b=1))
        e = sk.put(x, y, t, st)
        if s.get('forts'):
            pass
        if er_naa:
            sk.put(e + 2, y, ' NÅ ', S(fg='invertert_tekst', bg='aksent', b=1))
        sk.put(g.x + w - len(typ), y, typ, base + (D if not er_markor else S()))
        y += 1
    # Brede terminaler: forhåndsvisning av lysbildet under markøren i høyre rute (som Telescope i nvim).
    px = g.x + w + 6
    pw = g.x + g.sats - px
    if pw >= 80:
        ph = min(H - 2 - g.topp, round(pw * 0.30) + 2)
        flytevindu(sk, px, g.topp - 1, pw, ph, 'Forhåndsvisning', 'lysbilde %d' % markor_nr)
        mal = slides[markor_nr - 1]
        pg = Rutenett(pw - 2, ph - 2)
        for kand in paginer(DECK, pg):
            if kand['type'] == mal['type'] and kand.get('sek') == mal.get('sek') and kand.get('tittel') == mal.get('tittel') and kand.get('forts') == mal.get('forts'):
                sub, _, _ = tegn_lysbilde(pw - 2, ph - 2, kand['nr'])
                for yy in range(ph - 2):
                    for xx in range(pw - 2):
                        sk.c[g.topp + yy][px + 1 + xx] = sub.c[yy][xx]
                break
    statuslinje(sk, g, DECK, slides, cur_nr, hint=[('j k', 'flytter'), ('↵', 'hopper'), ('Esc', 'lukker')], modus='OVERSIKT')
    return sk


def hjelp(W, H, under_nr):
    sk, g, slides = tegn_lysbilde(W, H, under_nr)
    sk.demp()
    taster = [
        ('Blaing', [('j  →  n  Space  PgDn', 'neste'), ('k  ←  p  PgUp', 'forrige'), ('gg  /  G', 'første / siste'), ('↑  ↓', 'rull en stor blokk')]),
        ('Visning', [('o', 'oversikt'), ('b  .', 'svart skjerm'), ('?', 'denne hjelpen')]),
        ('Kommandoer', [(':presenter h<n>', 'lysbildenivå (h2–h6)'), (':agenda av', 'uten overganger'), (':palett <navn>', 'fosfor, signal, papir, cyanotypi'), (':farger terminal', 'terminalens 16 farger'), (':q', 'avslutt')]),
        ('Avslutt', [('q  Esc  Ctrl-c', 'avslutt og gjenopprett terminalen')]),
    ]
    kw = max(len(k) for _, ts in taster for k, _ in ts)
    fw = max(len(f) for _, ts in taster for _, f in ts)
    w = min(sk.W - 4, kw + fw + 9)
    h = sum(len(ts) + 2 for _, ts in taster) + 1
    x = (sk.W - w) // 2
    y = max(1, (sk.H - h) // 2)
    flytevindu(sk, x, y, w, h, 'Hurtigtaster', '? lukker')
    yy = y + 1
    for gruppe, ts in taster:
        yy += 1 if gruppe != 'Blaing' else 0
        sk.put(x + 3, yy, gruppe, S(fg='aksent', bg='flate_bg', b=1)); yy += 1
        for k, f in ts:
            sk.put(x + 3, yy, k, S(fg='tekst', bg='flate_bg', b=1))
            sk.put(x + 3 + kw + 3, yy, f, S(fg='dempet', bg='flate_bg'))
            yy += 1
    return sk


def kommandolinje(W, H, nr, skrevet, feil=None, meny=None):
    """`:` erstatter statuslinjen (cmdheight=0). Feil: vim-kode i fet feilfarge, forklaring på raden over."""
    sk, g, slides = tegn_lysbilde(W, H, nr)
    y = H - 1
    sk.fyll(0, y, W, 1, 'bg')
    for xx in range(W):
        sk.put(xx, y, ' ', S(bg='bg'))
    if meny:
        # wildmenu: flytevindu rett over kommandolinjen, kolonne ved markøren
        mw = max(len(k) + len(f) for k, f in meny) + 8
        mx = g.x - 1
        my = y - len(meny) - 2
        flytevindu(sk, mx, my, mw, len(meny) + 2, 'Kommandoer', 'Tab')
        for k, (kmd, f) in enumerate(meny):
            st = S(fg='markor_tekst', bg='markor_bg') if k == 0 else S(fg='tekst', bg='flate_bg')
            if k == 0:
                sk.fyll(mx + 1, my + 1 + k, mw - 2, 1, 'markor_bg')
            sk.put(mx + 2, my + 1 + k, kmd, st + S(b=1))
            sk.put(mx + 2 + max(len(c) for c, _ in meny) + 2, my + 1 + k, f, st if k == 0 else S(fg='dempet', bg='flate_bg'))
    if feil:
        kode, kort_, forklaring = feil
        # vim viser lange meldinger over flere rader; her: rad H-2 = forklaring, rad H-1 = feilkode + kortmelding
        sk.fyll(0, y - 1, W, 1, 'bg')
        for xx in range(W):
            sk.put(xx, y - 1, ' ', S(bg='bg'))
            sk.put(xx, y - 2, '─', S(fg='dekor', bg='bg'))
        e = sk.put(g.x - 1, y - 1, kode + ':', S(fg='feil', b=1))
        sk.spans(e + 1, y - 1, md(kort_))
        sk.spans(g.x - 1, y, md(forklaring, D))
        sk.put(g.x + g.sats - len('trykk en tast'), y, 'trykk en tast', D)
        return sk
    e = sk.put(g.x - 1, y, ':', S(fg='aksent', b=1))
    e = sk.put(e, y, skrevet, S(fg='tekst'))
    sk.put(e, y, ' ', S(fg='bg', bg='tekst'))  # blokkmarkør (statisk)
    return sk


def svart(W, H):
    sk = Skjerm(W, H, bg='svart')
    return sk


def for_liten(W, H):
    sk = Skjerm(W, H)
    linjer = [
        [('Terminalen er for liten', T + S(b=1))],
        [],
        [('%d' % W, S(fg='feil' if W < 80 else 'tekst', b=1)), (' × ', D), ('%d' % H, S(fg='feil' if H < 24 else 'tekst', b=1)), ('  –  presentasjonen trenger minst ', D), ('80 × 24', T + S(b=1))],
        [],
        [('Gjør vinduet større eller skriften mindre (', D), ('Ctrl -', T + S(b=1)), (').', D)],
        [('Lysbildet tegnes straks det er plass.  ', D), ('q', T + S(b=1)), (' avslutter', D)],
    ]
    y = (H - len(linjer)) // 2
    for l in linjer:
        w = bredde(''.join(t for t, _ in l))
        sk.spans(max(1, (W - w) // 2), y, l); y += 1
    return sk


NOTATER = [
    ('Statusmøte uke 45', 'rapporter/statusmøter', '6. nov.'), ('Statusmøte uke 43', 'rapporter/statusmøter', '23. okt.'),
    ('Statusmøte uke 41', 'rapporter/statusmøter', '9. okt.'), ('Månedsrapport oktober', 'rapporter', '1. nov.'),
    ('Kvartalsgjennomgang Q3', 'rapporter', '2. okt.'), ('Sprintoversikt', 'prosjekter/ordreplattform', '5. nov.'),
    ('Driftsnotat 3. november', 'drift', '3. nov.'), ('ADR-014 Idempotens', 'arkitektur/adr', '28. okt.'),
]


def notatliste(W, H, sok, markor=0):
    g = Rutenett(W, H)
    sk = Skjerm(W, H)
    y = g.topp
    sk.put(g.x, y, '~/', A + S(b=1)); e = sk.put(g.x + 2, y, 'vault', D)
    sk.put(e + 2, y, '·  velg notatet du vil presentere', D)
    y += 2
    # søkefeltet: vims «/» som ledetekst, blokkmarkør
    e = sk.put(g.x, y, '/', A + S(b=1))
    e = sk.put(e + 1, y, sok, T + S(b=1))
    sk.put(e, y, ' ', S(bg='tekst'))
    treff = [n for n in NOTATER if all(c in n[0].lower() for c in sok.replace(' ', ''))]
    sk.put(g.x + g.sats - len('%d / 214' % len(treff)), y, '%d / 214' % len(treff), D)
    y += 1
    sk.put(g.x, y, '─' * g.sats, S(fg='dekor')); y += 1 + (1 if H >= 30 else 0)
    for k, (navn, sti, dato) in enumerate(treff):
        m = k == markor
        if m:
            sk.fyll(g.x - 2, y, g.sats + 4, 1, 'markor_bg')
            sk.put(g.x - 2, y, '▌', S(fg='fokus', bg='markor_bg'))
        base = S(fg='markor_tekst', bg='markor_bg') if m else S(fg='tekst')
        # fuzzy-treff: fet + understrek (aksent utenfor markørraden; ensfarget på markørraden)
        q = list(sok.replace(' ', '').lower())
        x = g.x
        for ch in navn:
            if q and ch.lower() == q[0]:
                q.pop(0)
                st = base + S(b=1, ul=1, uc='markor_tekst' if m else 'aksent') + (S() if m else S(fg='aksent'))
            else:
                st = base
            x = sk.put(x, y, ch, st)
        sk.put(g.x + 34, y, sti, base if m else D)
        sk.put(g.x + g.sats - len(dato), y, dato, base if m else D)
        y += 1
    statuslinje_enkel(sk, g, [('↑ ↓', 'flytter'), ('↵', 'presenterer'), ('Esc', 'avslutter')], 'Notater')
    return sk


def statuslinje_enkel(sk, g, taster, venstre):
    y = sk.H - 1
    sk.fyll(0, y, sk.W, 1, 'linje_bg')
    L = S(bg='linje_bg')
    sk.put(g.x, y, venstre, L + S(fg='dempet'))
    hint_sp = []
    for k, (t, f) in enumerate(taster):
        hint_sp += [(('  ·  ' if k else ''), L + S(fg='dempet')), (t, L + S(fg='tekst', b=1)), (' ' + f, L + S(fg='dempet'))]
    hb = bredde(''.join(t for t, _ in hint_sp))
    sk.spans(g.x + g.sats - hb, y, hint_sp)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Skriv mockupene
# ═════════════════════════════════════════════════════════════════════════════════════════════════

def skriv(navn, sk, palett='fosfor', modus='dark', ansi16=False):
    f = (Ansi16 if ansi16 else Truecolor)(palett, modus)
    fil = '%s-%dx%d-%s.ans' % (navn, sk.W, sk.H, f.navn if ansi16 else f.navn)
    with open(os.path.join(UT, fil), 'w', encoding='utf-8') as h:
        h.write(sk.ansi(f))
    return fil


def main():
    os.makedirs(UT, exist_ok=True)
    for f in os.listdir(UT):
        if f.endswith('.ans'):
            os.remove(os.path.join(UT, f))
    laget = []
    # Statusmøtet ved 120×36 (standard: Fosfor mørk), alle lysbilder
    g = Rutenett(120, 36)
    slides = paginer(DECK, g)
    navn = {'tittel': 'tittel', 'agenda': 'agenda', 'overgang': 'overgang', 'innhold': 'innhold'}
    for s in slides:
        sk, _, _ = tegn_lysbilde(120, 36, s['nr'])
        laget.append(skriv('%02d-%s' % (s['nr'], navn[s['type']] + ('-forts' if s.get('forts') else '')), sk))
    # Tilstander ved 120×36
    laget.append(skriv('20-oversikt', oversikt(120, 36, 6, 8)))
    laget.append(skriv('21-hjelp', hjelp(120, 36, 8)))
    laget.append(skriv('22-kommando-meny', kommandolinje(120, 36, 8, 'pa', meny=[('palett', 'fosfor, signal, papir, cyanotypi'), ('presenter', 'h2–h6')])))
    laget.append(skriv('23-kommando-e475', kommandolinje(120, 36, 8, '', feil=('E475', 'Ugyldig argument: «h9»', 'Skriv `:presenter h2` til `:presenter h6`. Notatet har overskrifter på nivå h2 og h3.'))))
    laget.append(skriv('24-kommando-e486', kommandolinje(120, 36, 8, '', feil=('E486', 'Ingen overskrifter på nivå h5 i notatet', 'Lysbildene deles ikke annerledes. Notatet har overskrifter på nivå h2 og h3. Valget er ikke lagret.'))))
    laget.append(skriv('25-svart', svart(120, 36)))
    laget.append(skriv('26-notatliste', notatliste(120, 36, 'stat')))
    laget.append(skriv('27-for-liten', for_liten(79, 23)))
    laget.append(skriv('28-rullet', tegn_lysbilde(120, 36, 10, rull=14)[0]))
    # Paletter (120×36)
    laget.append(skriv('30-tittel', tegn_lysbilde(120, 36, 1)[0], 'signal', 'dark'))
    laget.append(skriv('31-innhold', tegn_lysbilde(120, 36, 4)[0], 'papir', 'light'))
    laget.append(skriv('32-overgang', tegn_lysbilde(120, 36, 7)[0], 'cyanotypi', 'light'))
    laget.append(skriv('33-innhold', tegn_lysbilde(120, 36, 8)[0], 'signal', 'light'))
    laget.append(skriv('34-innhold-forts', tegn_lysbilde(120, 36, 6)[0], 'cyanotypi', 'dark'))
    laget.append(skriv('35-innhold', tegn_lysbilde(120, 36, 10)[0], 'papir', 'dark'))
    laget.append(skriv('36-tittel', tegn_lysbilde(120, 36, 1)[0], 'fosfor', 'light'))
    # Terminalens egne farger (ansi16)
    laget.append(skriv('40-overgang', tegn_lysbilde(120, 36, 7)[0], 'fosfor', 'dark', ansi16=True))
    laget.append(skriv('41-innhold', tegn_lysbilde(120, 36, 8)[0], 'fosfor', 'dark', ansi16=True))
    laget.append(skriv('42-innhold', tegn_lysbilde(120, 36, 4)[0], 'papir', 'light', ansi16=True))
    # 80×24
    g80 = Rutenett(80, 24)
    s80 = paginer(DECK, g80)
    for s in s80:
        if s['type'] in ('tittel', 'agenda') or (s['type'] == 'overgang' and s['sek'] == 2) or s['type'] == 'innhold' and s['tittel'] in ('Idempotente ordre-kall', 'Java 21-migrering', 'Flyway V12: partisjonert ordretabell'):
            sk, _, _ = tegn_lysbilde(80, 24, s['nr'])
            laget.append(skriv('50-%02d-%s' % (s['nr'], s['type'] + ('-forts' if s.get('forts') else '')), sk))
    # 200×50
    g200 = Rutenett(200, 50)
    s200 = paginer(DECK, g200)
    for s in s200:
        if s['type'] in ('tittel', 'agenda') or (s['type'] == 'overgang' and s['sek'] == 0) or s['type'] == 'innhold' and s['tittel'] in ('Outbox-mønsteret', 'Java 21-migrering'):
            sk, _, _ = tegn_lysbilde(200, 50, s['nr'])
            laget.append(skriv('60-%02d-%s' % (s['nr'], s['type']), sk))
    laget.append(skriv('61-oversikt', oversikt(200, 50, 5, 7)))
    print('\n'.join(laget))
    print('120×36: %d lysbilder · 80×24: %d · 200×50: %d' % (len(slides), len(s80), len(s200)))


if __name__ == '__main__':
    main()
