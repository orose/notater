// Felles hjelpere for v3-akseptansetestene (presentasjon i terminalen, docs/test/testplan-v3.md).
//
// Teknisk oppsett (testplanen §2): presentasjonen kjøres i en EKTE pseudoterminal i en headless `tmux`-server
// (én privat tmux-sokkel per terminal, `-f /dev/null`, ingen brukeroppsett). tmux er terminalemulatoren:
//   - skjermbufferet leses med `capture-pane` (tekst) og `capture-pane -e` (SGR-farger/attributter per celle),
//   - taster sendes med `send-keys`, vindusstørrelse endres med `resize-window` (gir SIGWINCH),
//   - terminaltilstand leses med `display -p '#{alternate_on} #{cursor_flag}'`,
//   - råstrømmen fra appen (OSC 8, ?1049h/l, ?25l/h, fargekoder) logges med `pipe-pane`.
// Appen startes av et lite skall-skript som venter på «go», kjører `npm run present -- …`, skriver `stty -g` før og
// etter, og så `QA-EXIT=<kode>` – slik kan testene sjekke at terminalen er gjenopprettet ETTER at prosessen er ute.
// Ingen nye avhengigheter (ADR-006). Endres en kontrakt her, endres testplanen §6 i samme commit.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test as base, type TestInfo } from '@playwright/test';
import { copyTestVault, E2E_PORT, makeTempDir, REPO, removeDir, writeConfig } from './real-server';

// ---------------------------------------------------------------------------------------------
// Fasit (docs/test/v3-fasit.json + v2-fasit.json)
// ---------------------------------------------------------------------------------------------

export interface Størrelse {
  readonly cols: number;
  readonly rows: number;
}

export interface V3Lysbilde {
  readonly type: 'tittel' | 'agenda' | 'overgang' | 'innhold';
  readonly overskrift: string | null;
  readonly agendapunkt?: string | null;
  readonly progresjon?: string | null;
  readonly inneholder?: readonly string[];
}

export interface V3Notat {
  readonly sti: string;
  readonly tittel?: string;
  readonly agenda?: readonly string[];
  readonly lysbilder: readonly V3Lysbilde[];
}

/** Bevisst løst typet: fasiten er data, og testene leser bare feltene de trenger. */
export type V3Fasit = Readonly<Record<string, unknown>> & {
  readonly storrelser: { readonly standard: readonly Størrelse[]; readonly minimum: Størrelse; readonly forLite: readonly Størrelse[]; readonly forLiteMelding: { readonly inneholder: readonly string[]; readonly monstre: readonly string[] } };
  readonly kanter: V3Notat;
};

export const fasit3 = JSON.parse(readFileSync(join(REPO, 'docs/test/v3-fasit.json'), 'utf8')) as V3Fasit;
export const fasit2Rå = JSON.parse(readFileSync(join(REPO, 'docs/test/v2-fasit.json'), 'utf8')) as Record<string, V3Notat & Record<string, unknown>>;

/** Notatnøkkel i fasiten ('statusmote', 'kanter' …) → fasitnotat. */
export function fasitNotat(nøkkel: string): V3Notat {
  if (nøkkel === 'kanter') return fasit3.kanter;
  const n = fasit2Rå[nøkkel];
  if (!n) throw new Error(`ukjent fasitnotat ${nøkkel}`);
  return n;
}

export const STANDARDSTØRRELSER = fasit3.storrelser.standard;

// ---------------------------------------------------------------------------------------------
// Figlet (ADR-011 §5): UX sine .flf-fonter og fallback-kjeden, regnet ut uavhengig av appen
// ---------------------------------------------------------------------------------------------

export interface FlfFont {
  readonly hoyde: number;
  readonly glyfer: ReadonlyMap<string, readonly string[]>;
}

const TYSKE = [196, 214, 220, 228, 246, 252, 223];

/** Minimal FIGlet-leser (flf2a): header, hardblank, endemerker, 32–126 + de 7 tyske, så kodemerkede tegn. Bredde 0 = mangler. */
export function lesFlf(fil: string): FlfFont {
  const linjer = readFileSync(fil, 'utf8').split('\n');
  const [sig, h, , , , kommentarer] = linjer[0]!.split(' ');
  const hard = sig!.at(-1)!;
  const hoyde = Number(h);
  const glyfer = new Map<string, string[]>();
  let i = 1 + Number(kommentarer);
  const les = (fra: number): string[] =>
    linjer.slice(fra, fra + hoyde).map((r) => {
      const ende = r.at(-1) ?? '@';
      let x = r;
      while (x.endsWith(ende)) x = x.slice(0, -1);
      return x.split(hard).join(' ');
    });
  const legg = (kode: number, rader: string[]) => {
    if (Math.max(...rader.map((r) => r.length)) > 0) glyfer.set(String.fromCodePoint(kode), rader);
  };
  for (const kode of [...Array.from({ length: 95 }, (_, k) => 32 + k), ...TYSKE]) {
    legg(kode, les(i));
    i += hoyde;
  }
  while (i < linjer.length && /^\d+/.test(linjer[i]!)) {
    legg(Number(/^\d+/.exec(linjer[i]!)![0]), les(i + 1));
    i += 1 + hoyde;
  }
  return { hoyde, glyfer };
}

export const FIGLET = {
  blokk: lesFlf(join(REPO, 'docs/design/terminal/figlet/vr-blokk.flf')),
  smal: lesFlf(join(REPO, 'docs/design/terminal/figlet/vr-smal.flf')),
} as const;

function glyfFor(font: FlfFont, tegn: string): readonly string[] | null {
  const stor = tegn.toLocaleUpperCase('nb');
  const utenAksent = stor.normalize('NFD').replace(/\p{M}/gu, '');
  return font.glyfer.get(stor) ?? font.glyfer.get(tegn) ?? font.glyfer.get(utenAksent) ?? null;
}

/** Bredden på teksten i fonten (full width, ingen smushing), eller null hvis et tegn mangler. */
export function figletBredde(tekst: string, font: FlfFont): number | null {
  let sum = 0;
  for (const tegn of segmenter(tekst.normalize('NFC'))) {
    const g = glyfFor(font, tegn);
    if (!g) return null;
    sum += Math.max(...g.map(visningsbredde));
  }
  return sum;
}

/** Antall linjer med grådig ordbryting innenfor `rom`, eller null (tegn mangler / et ord er for bredt). */
function figletLinjer(tekst: string, font: FlfFont, rom: number): number | null {
  if (figletBredde(tekst, font) === null) return null;
  let antall = 0;
  let rad = '';
  for (const ord of tekst.split(' ')) {
    const kandidat = rad ? `${rad} ${ord}` : ord;
    if (figletBredde(kandidat, font)! <= rom) rad = kandidat;
    else {
      if (figletBredde(ord, font)! > rom) return null;
      antall++;
      rad = ord;
    }
  }
  return antall + (rad ? 1 : 0);
}

export type FigletValg = { readonly font: 'blokk' | 'smal' | 'fallback'; readonly linjer: number };

/** Fallback-kjeden i ADR-011 §5 som ren funksjon (QAs egen implementasjon, brukes til å kontrollere fasiten). */
export function figletKjede(tekst: string, s: Størrelse, tittel: boolean, marg: number): FigletValg {
  const rom = s.cols - 2 * marg;
  const maksHøyde = s.rows / 3;
  const b = figletLinjer(tekst, FIGLET.blokk, rom);
  if (b === 1 && FIGLET.blokk.hoyde <= maksHøyde) return { font: 'blokk', linjer: 1 };
  const maksLinjer = tittel && s.rows >= 36 ? 3 : 2;
  if (b !== null && b <= maksLinjer && FIGLET.blokk.hoyde * b <= maksHøyde) return { font: 'blokk', linjer: b };
  const sm = figletLinjer(tekst, FIGLET.smal, rom);
  if (sm !== null && sm <= 2 && FIGLET.smal.hoyde * sm <= maksHøyde) return { font: 'smal', linjer: sm };
  return { font: 'fallback', linjer: 0 };
}

/** Tegner teksten med fonten (selvtesten av figlet-gjenkjenningen). */
export function tegnFiglet(tekst: string, font: FlfFont): string[] {
  const glyfer = segmenter(tekst).map((t) => glyfFor(font, t)!);
  return Array.from({ length: font.hoyde }, (_, r) => glyfer.map((g) => g[r] ?? '').join(''));
}

/** UX sine fargeroller (docs/design/terminal/farger.json). */
export const fargeroller = JSON.parse(readFileSync(join(REPO, 'docs/design/terminal/farger.json'), 'utf8')) as {
  readonly standard: { readonly palett: string; readonly modus: string };
  readonly truecolor: Readonly<Record<string, Readonly<Record<'light' | 'dark', { readonly roller: Readonly<Record<string, string>> }>>>>;
  readonly ansi16: { readonly aksentAvPalett: Readonly<Record<string, Readonly<Record<'light' | 'dark', number>>>> };
};

// ---------------------------------------------------------------------------------------------
// tmux
// ---------------------------------------------------------------------------------------------

export function harTmux(): boolean {
  return spawnSync('tmux', ['-V'], { encoding: 'utf8' }).status === 0;
}

let teller = 0;

export interface Miljø {
  readonly TERM?: string;
  readonly COLORTERM?: string;
  readonly NO_COLOR?: string;
  readonly [navn: string]: string | undefined;
}

/** Ghostty-lignende standard: truecolor, Unicode. */
export const GHOSTTY: Miljø = { TERM: 'xterm-ghostty', COLORTERM: 'truecolor', TERM_PROGRAM: 'ghostty' };
export const XTERM_256: Miljø = { TERM: 'xterm-256color', COLORTERM: '', TERM_PROGRAM: '' };

export interface StartValg {
  /** Argumenter etter `npm run present --`. */
  readonly args?: readonly string[];
  readonly størrelse?: Størrelse;
  readonly miljø?: Miljø;
  /** Vaultet appen skal lese (standard: arbeiderens kopi via `--config`). Legges til som `--config <fil> --vault-id test`. */
  readonly konfig?: string | null;
  /** Kommando i stedet for `npm run present --` (brukes av selvtesten av riggen). */
  readonly kommando?: string;
}

export interface Tilstand {
  readonly alternativSkjerm: boolean;
  readonly markørSynlig: boolean;
  readonly bredde: number;
  readonly høyde: number;
}

const sh = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

/** Inngangen til terminalappen (ADR-011): brukes for å finne prosessene som skal få signaler. */
export const APP_INNGANG = 'src/terminal/main.ts';
/** `npm run present` kjører bunten fra `scripts/present.mjs` i én prosess (ADR-011 M2, PO-119); tsx-veien har `APP_INNGANG`. */
export const APP_INNGANGER: readonly string[] = [APP_INNGANG, 'scripts/present.mjs'];

export class Terminal {
  readonly dir: string;
  private readonly sokkel: string;
  private readonly økt = 'qa';
  private størrelse: Størrelse;

  private constructor(dir: string, sokkel: string, størrelse: Størrelse) {
    this.dir = dir;
    this.sokkel = sokkel;
    this.størrelse = størrelse;
  }

  private static tmuxRå(sokkel: string, args: readonly string[]): string {
    const r = spawnSync('tmux', ['-L', sokkel, '-f', '/dev/null', ...args], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`tmux ${args.join(' ')} feilet: ${r.stderr}`);
    return r.stdout;
  }

  tmux(...args: string[]): string {
    return Terminal.tmuxRå(this.sokkel, args);
  }

  static async start(valg: StartValg & { konfig: string | null }): Promise<Terminal> {
    const størrelse = valg.størrelse ?? { cols: 120, rows: 36 };
    const dir = makeTempDir('vault-leser-v3-term-');
    const sokkel = `qa-v3-${process.pid}-${++teller}`;
    const t = new Terminal(dir, sokkel, størrelse);
    const miljø: Record<string, string> = {
      LANG: 'nb_NO.UTF-8',
      LC_ALL: 'C.UTF-8',
      TZ: 'Europe/Oslo',
      npm_config_update_notifier: 'false',
      QA_NETTLOGG: join(dir, 'nett.log'),
      NODE_OPTIONS: `--import ${new URL('./terminal-nettvakt.mjs', import.meta.url).href}`,
      ...GHOSTTY,
    };
    for (const [k, v] of Object.entries(valg.miljø ?? {})) if (v !== undefined) miljø[k] = v;
    const args = [...(valg.konfig ? ['--config', valg.konfig, '--vault-id', 'test'] : []), ...(valg.args ?? [])];
    const kommando = valg.kommando ?? `npm run --silent present -- ${args.map(sh).join(' ')}`;
    const eksport = Object.entries(miljø)
      .map(([k, v]) => (v === '' ? `unset ${k}` : `export ${k}=${sh(v)}`))
      .join('\n');
    writeFileSync(
      join(dir, 'kjør.sh'),
      [
        `cd ${sh(REPO)}`,
        'unset TMUX TMUX_PANE NO_COLOR FORCE_COLOR COLORFGBG',
        eksport,
        `while [ ! -f ${sh(join(dir, 'go'))} ]; do sleep 0.02; done`,
        `stty -g > ${sh(join(dir, 'stty-før'))}`,
        // Skallet må overleve Ctrl c/SIGINT til forgrunnsgruppen for å kunne rapportere exit-koden. En trap med
        // handler (ikke '') nullstilles til standard i barnet ved exec, så appen får SIGINT som vanlig.
        "trap 'true' INT TERM HUP",
        `( ${kommando} )`,
        'kode=$?',
        `stty -g > ${sh(join(dir, 'stty-etter'))}`,
        'printf "\\nQA-EXIT=%s\\n" "$kode"',
        'sleep 3600',
        '',
      ].join('\n'),
    );
    Terminal.tmuxRå(sokkel, ['new-session', '-d', '-s', t.økt, '-x', String(størrelse.cols), '-y', String(størrelse.rows), `sh ${sh(join(dir, 'kjør.sh'))}`]);
    t.tmux('set-option', '-g', 'status', 'off');
    t.tmux('set-option', '-g', 'escape-time', '0');
    t.tmux('set-window-option', '-g', 'aggressive-resize', 'off');
    t.tmux('pipe-pane', '-o', '-t', t.økt, `cat >> ${sh(join(dir, 'rå.log'))}`);
    writeFileSync(join(dir, 'go'), '');
    return t;
  }

  /** Taster med tmux-navn: 'j', 'Right', 'PageDown', 'Space', 'Escape', 'C-c', 'Enter', 'Up' … */
  async trykk(...taster: string[]): Promise<void> {
    for (const tast of taster) {
      if (tast === 'g g') this.tmux('send-keys', '-t', this.økt, 'g', 'g');
      else this.tmux('send-keys', '-t', this.økt, tast);
    }
  }

  /** Bokstavelig tekst (ingen tastenavn-tolkning). */
  async skriv(tekst: string): Promise<void> {
    this.tmux('send-keys', '-t', this.økt, '-l', tekst);
  }

  /** `:`-kommando: `:` + tekst + Enter. */
  async kommando(tekst: string): Promise<void> {
    await this.trykk(':');
    await this.skriv(tekst);
    await this.trykk('Enter');
  }

  async endreStørrelse(s: Størrelse): Promise<void> {
    this.størrelse = s;
    this.tmux('resize-window', '-t', this.økt, '-x', String(s.cols), '-y', String(s.rows));
  }

  get gjeldendeStørrelse(): Størrelse {
    return this.størrelse;
  }

  /** Skjermen som tekst, én streng per rad (uten SGR). */
  skjerm(): string[] {
    return this.tmux('capture-pane', '-p', '-t', this.økt).replace(/\n$/, '').split('\n');
  }

  /** Skjermen med celleattributter. */
  celler(): Celle[][] {
    return tolkSgr(this.tmux('capture-pane', '-p', '-e', '-t', this.økt));
  }

  tilstand(): Tilstand {
    const [alt, cur, w, h] = this.tmux('display', '-p', '-t', this.økt, '#{alternate_on} #{cursor_flag} #{pane_width} #{pane_height}').trim().split(' ');
    return { alternativSkjerm: alt === '1', markørSynlig: cur === '1', bredde: Number(w), høyde: Number(h) };
  }

  /** Alt appen har skrevet til terminalen (rå bytes som UTF-8). */
  råstrøm(): string {
    const f = join(this.dir, 'rå.log');
    return existsSync(f) ? readFileSync(f, 'utf8') : '';
  }

  /** TCP-tilkoblinger appen har forsøkt (nettverksvakten). */
  nettforsøk(): string[] {
    const f = join(this.dir, 'nett.log');
    return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];
  }

  /** Exit-koden når prosessen er ute, ellers null. */
  exitkode(): number | null {
    const m = /QA-EXIT=(\d+)/.exec(this.tmux('capture-pane', '-p', '-S', '-200', '-t', this.økt));
    return m ? Number(m[1]) : null;
  }

  /** `stty -g` før start og etter avslutning (lik = rå modus/echo er gjenopprettet). */
  stty(): { før: string; etter: string | null } {
    const les = (n: string) => (existsSync(join(this.dir, n)) ? readFileSync(join(this.dir, n), 'utf8').trim() : null);
    return { før: les('stty-før') ?? '', etter: les('stty-etter') };
  }

  async ventPåTekst(mønster: string | RegExp, timeout = 10_000): Promise<string[]> {
    const treff = (rader: string[]) => (typeof mønster === 'string' ? rader.join('\n').includes(mønster) : mønster.test(rader.join('\n')));
    await expect.poll(() => treff(this.skjerm()), { message: `venter på ${String(mønster)} i terminalen`, timeout, intervals: [20, 50, 100] }).toBe(true);
    return this.skjerm();
  }

  async ventPåExit(timeout = 10_000): Promise<number> {
    await expect.poll(() => this.exitkode(), { message: 'venter på at prosessen avslutter', timeout, intervals: [20, 50, 100] }).not.toBeNull();
    return this.exitkode()!;
  }

  /**
   * Sender et signal til appens prosesser: etterkommerne av skall-skriptet som kjører `src/terminal/main.ts`. Skallet
   * som rapporterer exit-koden og npm selv signaleres ikke (npm sin signalhåndtering er ikke vår).
   */
  signal(sig: 'SIGTERM' | 'SIGHUP' | 'SIGINT', hvem: 'appen' | 'gruppen' = 'appen'): void {
    const rot = Number(this.tmux('display', '-p', '-t', this.økt, '#{pane_pid}').trim());
    const ps = spawnSync('ps', ['-ww', '-e', '-o', 'pid=,ppid=,args='], { encoding: 'utf8' }).stdout;
    const rader = ps
      .split('\n')
      .map((l) => l.trim().split(/\s+/))
      .filter((r) => r.length >= 3)
      .map(([pid, ppid, ...args]) => ({ pid: Number(pid), ppid: Number(ppid), args: args.join(' ') }));
    const etterkommere = new Set<number>([rot]);
    for (let endret = true; endret; ) {
      endret = false;
      for (const r of rader) if (etterkommere.has(r.ppid) && !etterkommere.has(r.pid)) {
          etterkommere.add(r.pid);
          endret = true;
        }
    }
    const app = rader.filter((r) => etterkommere.has(r.pid) && /node/.test(r.args) && APP_INNGANGER.some((inngang) => r.args.includes(inngang)));
    // 'appen' = `kill <pid>` på den innerste Node-prosessen (tsx starter appen i en barneprosess); 'gruppen' = tsx og
    // appen samtidig, slik terminalen gjør med forgrunnsgruppen når vinduet lukkes (SIGHUP).
    const mål = hvem === 'gruppen' ? app : app.filter((r) => !app.some((a) => a.ppid === r.pid));
    for (const r of mål) spawnSync('kill', [`-${sig.replace('SIG', '')}`, String(r.pid)]);
  }

  async lukk(): Promise<void> {
    spawnSync('tmux', ['-L', this.sokkel, 'kill-server']);
    removeDir(this.dir);
  }
}

// ---------------------------------------------------------------------------------------------
// SGR-tolking av `capture-pane -e`
// ---------------------------------------------------------------------------------------------

export type Farge = { readonly kind: 'standard' } | { readonly kind: 'ansi'; readonly n: number } | { readonly kind: '256'; readonly n: number } | { readonly kind: 'rgb'; readonly hex: string };

export interface Celle {
  readonly tegn: string;
  readonly fg: Farge;
  readonly bg: Farge;
  readonly fet: boolean;
  readonly dempet: boolean;
  readonly kursiv: boolean;
  readonly understrek: boolean;
  readonly invertert: boolean;
}

const STANDARD: Farge = { kind: 'standard' };
const ESC = String.fromCharCode(27);
const SGR_DEL = new RegExp(`(${ESC}\\[[0-9;:]*m)`);
const SGR_HEL = new RegExp(`^${ESC}\\[([0-9;:]*)m$`);
const SGR_ALLE = new RegExp(`${ESC}\\[([0-9;:]*)m`, 'g');

/** tmux skriver bare SGR i `capture-pane -e`; alt annet ignoreres. Breddetegn tar én celle her (tmux hopper over fyllcellen). */
export function tolkSgr(tekst: string): Celle[][] {
  const rader: Celle[][] = [];
  let a = { fg: STANDARD, bg: STANDARD, fet: false, dempet: false, kursiv: false, understrek: false, invertert: false };
  for (const linje of tekst.replace(/\n$/, '').split('\n')) {
    const rad: Celle[] = [];
    const deler = linje.split(SGR_DEL);
    for (const del of deler) {
      const m = SGR_HEL.exec(del);
      if (m) {
        const p = (m[1] || '0').split(/[;:]/).map(Number);
        for (let i = 0; i < p.length; i++) {
          const k = p[i]!;
          if (k === 0) a = { fg: STANDARD, bg: STANDARD, fet: false, dempet: false, kursiv: false, understrek: false, invertert: false };
          else if (k === 1) a = { ...a, fet: true };
          else if (k === 2) a = { ...a, dempet: true };
          else if (k === 3) a = { ...a, kursiv: true };
          else if (k === 4) a = { ...a, understrek: true };
          else if (k === 7) a = { ...a, invertert: true };
          else if (k === 22) a = { ...a, fet: false, dempet: false };
          else if (k === 23) a = { ...a, kursiv: false };
          else if (k === 24) a = { ...a, understrek: false };
          else if (k === 27) a = { ...a, invertert: false };
          else if ((k >= 30 && k <= 37) || (k >= 90 && k <= 97)) a = { ...a, fg: { kind: 'ansi', n: k } };
          else if ((k >= 40 && k <= 47) || (k >= 100 && k <= 107)) a = { ...a, bg: { kind: 'ansi', n: k } };
          else if (k === 39) a = { ...a, fg: STANDARD };
          else if (k === 49) a = { ...a, bg: STANDARD };
          else if (k === 38 || k === 48) {
            let farge: Farge = STANDARD;
            if (p[i + 1] === 5) {
              farge = { kind: '256', n: p[i + 2]! };
              i += 2;
            } else if (p[i + 1] === 2) {
              const hex = `#${[p[i + 2], p[i + 3], p[i + 4]].map((x) => (x ?? 0).toString(16).padStart(2, '0')).join('')}`;
              farge = { kind: 'rgb', hex };
              i += 4;
            }
            a = k === 38 ? { ...a, fg: farge } : { ...a, bg: farge };
          }
        }
      } else {
        for (const tegn of segmenter(del)) rad.push({ tegn, ...a });
      }
    }
    rader.push(rad);
  }
  return rader;
}

const grafem = new Intl.Segmenter('nb', { granularity: 'grapheme' });
export const segmenter = (s: string): string[] => [...grafem.segment(s)].map((g) => g.segment);

const BRED = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;

/** Visningsbredde i terminalkolonner (bredde-2-tegn og emoji = 2, kombinerende tegn = 0). */
export function visningsbredde(s: string): number {
  let w = 0;
  for (const g of segmenter(s)) w += BRED.test(g) ? 2 : /^\p{M}+$/u.test(g) ? 0 : 1;
  return w;
}

// ---------------------------------------------------------------------------------------------
// Lesing av et lysbilde fra skjermen (kontrakt mot TUI-en, testplanen §6)
// ---------------------------------------------------------------------------------------------

const ikkeTom = (rader: readonly string[]): number[] => rader.map((r, i) => (r.trim() ? i : -1)).filter((i) => i >= 0);

/** Statuslinjen = nederste ikke-tomme rad. */
export function statuslinje(rader: readonly string[]): string {
  const i = ikkeTom(rader).at(-1);
  return i === undefined ? '' : rader[i]!;
}

/** «7/10» sist på statuslinjen. */
export function lysbildenummer(rader: readonly string[]): { n: number; av: number } | null {
  const m = /(\d+)\s*\/\s*(\d+)\s*$/.exec(statuslinje(rader));
  return m ? { n: Number(m[1]), av: Number(m[2]) } : null;
}

/**
 * Agendalinjen = øverste ikke-tomme rad når den inneholder (begynnelsen av) et agendapunkt OG progresjonen «n/m»
 * (progresjonen vises alltid, T6). Ellers null – f.eks. på en overgang der agendapunktet står som fet fallback øverst.
 */
export function agendalinje(rader: readonly string[], agenda: readonly string[]): string | null {
  const i = ikkeTom(rader)[0];
  if (i === undefined || i === ikkeTom(rader).at(-1)) return null;
  const rad = rader[i]!;
  const harPunkt = agenda.some((p) => rad.includes(p.slice(0, Math.min(6, p.length))));
  return harPunkt && /\d+\/\d+/.test(rad) ? rad : null;
}

/** Innholdsflaten: alt mellom agendalinjen (hvis den finnes) og statuslinjen. */
export function innholdsflate(rader: readonly string[], agenda: readonly string[] = []): string[] {
  const idx = ikkeTom(rader);
  const fra = agendalinje(rader, agenda) !== null ? idx[0]! + 1 : 0;
  return rader.slice(fra, idx.at(-1) ?? rader.length);
}

/** Tekst der radene er skjøtt (for å finne innhold som er brutt over flere rader). */
export const skjøtt = (rader: readonly string[]): string => rader.map((r) => r.trim()).join(' ').replace(/\s+/g, ' ');

/** Tekst der radene er skjøtt uten mellomrom (for hardt brutte ord og URL-er; fortsettelsesmerker fjernes). */
export const skjøttHardt = (rader: readonly string[]): string =>
  rader
    .map((r) => r.replace(/[│┃║|]/g, ' ').replace(/[↪↩⏎…]/g, '').trim())
    .join('')
    .replace(/\s+/g, '');

export interface FigletBlokk {
  readonly fra: number;
  readonly til: number;
  readonly farger: readonly string[];
}

/**
 * Figlet-blokk: ≥ 3 sammenhengende rader der < 20 % av blekket (tegn utenom mellomrom) er bokstaver/sifre.
 * Begge UX-fontene (ANSI Shadow og Future) er bygget av blokk- og rammetegn. Tabeller og callouts har bokstaver i
 * annenhver rad, så de gir aldri tre slike rader på rad.
 */
export function finnFiglet(celler: readonly (readonly Celle[])[]): FigletBlokk[] {
  const erFigletRad = (rad: readonly Celle[]): boolean => {
    const blekk = rad.filter((c) => c.tegn.trim());
    if (blekk.length < 4) return false;
    const bokstaver = blekk.filter((c) => /[\p{L}\p{N}]/u.test(c.tegn)).length;
    return bokstaver / blekk.length < 0.2;
  };
  const ut: FigletBlokk[] = [];
  let start = -1;
  for (let i = 0; i <= celler.length; i++) {
    const ok = i < celler.length && erFigletRad(celler[i]!);
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      if (i - start >= 3) {
        const farger = new Set<string>();
        for (let r = start; r < i; r++) for (const c of celler[r]!) if (c.tegn.trim()) farger.add(fargeNøkkel(c.fg));
        ut.push({ fra: start, til: i - 1, farger: [...farger] });
      }
      start = -1;
    }
  }
  return ut;
}

export const fargeNøkkel = (f: Farge): string => (f.kind === 'rgb' ? f.hex : f.kind === 'standard' ? 'standard' : `${f.kind}:${f.n}`);

/** Cellene i den første raden som inneholder teksten (for å sjekke utheving/farge). */
export function cellerFor(celler: readonly (readonly Celle[])[], tekst: string): Celle[] | null {
  for (const rad of celler) {
    const s = rad.map((c) => c.tegn).join('');
    const i = s.indexOf(tekst);
    if (i >= 0) {
      // Indeksen er i UTF-16-enheter; regn om til celler.
      const før = segmenter(s.slice(0, i)).length;
      return rad.slice(før, før + segmenter(tekst).length);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Farger og kontrast
// ---------------------------------------------------------------------------------------------

const lin = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminans = (hex: string): number => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
export function kontrast(a: string, b: string): number {
  const [l1, l2] = [luminans(a), luminans(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Alle SGR-parametre i råstrømmen, som lister av tall. */
export function sgrIRåstrøm(rå: string): number[][] {
  return [...rå.matchAll(SGR_ALLE)].map((m) => (m[1] || '0').split(/[;:]/).map(Number));
}

const OSC8 = new RegExp(`${ESC}\\]8;[^;]*;([^${ESC}\\u0007]*)(?:${ESC}\\\\|\\u0007)`, 'g');

/** Alle OSC 8-mål i råstrømmen (tomme mål = slutt på lenken er filtrert bort). */
export function osc8Mål(rå: string): string[] {
  return [...rå.matchAll(OSC8)].map((m) => m[1]!).filter(Boolean);
}

/** Fargekoder i en SGR-parameterliste (30–49, 90–107; 38/48 med undertype). */
export function fargekoder(p: readonly number[]): string[] {
  const ut: string[] = [];
  for (let i = 0; i < p.length; i++) {
    const k = p[i]!;
    if (k === 38 || k === 48) {
      ut.push(`${k};${p[i + 1]}`);
      i += p[i + 1] === 2 ? 4 : 2;
    } else if ((k >= 30 && k <= 37) || (k >= 40 && k <= 47) || (k >= 90 && k <= 97) || (k >= 100 && k <= 107)) ut.push(String(k));
  }
  return ut;
}

// ---------------------------------------------------------------------------------------------
// Navigasjon
// ---------------------------------------------------------------------------------------------

export async function ventPåLysbilde(t: Terminal, n: number, timeout = 5_000): Promise<string[]> {
  await expect.poll(() => lysbildenummer(t.skjerm())?.n ?? null, { message: `venter på lysbilde ${n}`, timeout, intervals: [10, 20, 50] }).toBe(n);
  return t.skjerm();
}

export async function gåTilLysbilde(t: Terminal, n: number): Promise<string[]> {
  await t.trykk('g g');
  await ventPåLysbilde(t, 1);
  for (let i = 1; i < n; i++) {
    await t.trykk('j');
    await ventPåLysbilde(t, i + 1);
  }
  return t.skjerm();
}

/** Leser alle lysbildene fra første til siste (`gg`, så `j`). */
export async function lesAlleSkjermer(t: Terminal): Promise<string[][]> {
  await t.trykk('g g');
  const første = await ventPåLysbilde(t, 1);
  const av = lysbildenummer(første)!.av;
  const ut = [første];
  for (let i = 2; i <= av; i++) {
    await t.trykk('j');
    ut.push(await ventPåLysbilde(t, i));
  }
  return ut;
}

/** Ruller en for stor blokk med `↓` til skjermen slutter å endre seg; returnerer alle unike skjermer. */
export async function rullHeleBlokken(t: Terminal, maks = 400): Promise<string[][]> {
  const ut = [t.skjerm()];
  for (let i = 0; i < maks; i++) {
    await t.trykk('Down');
    let neste = t.skjerm();
    for (let forsøk = 0; forsøk < 10 && neste.join('\n') === ut.at(-1)!.join('\n'); forsøk++) {
      await new Promise((r) => setTimeout(r, 15));
      neste = t.skjerm();
    }
    if (neste.join('\n') === ut.at(-1)!.join('\n')) break;
    ut.push(neste);
  }
  return ut;
}

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

export interface TerminalFixtures {
  /** Starter en vilkårlig kommando i en tmux-terminal uten vault (selvtesten av riggen). Lukkes automatisk. */
  rigg: (valg: StartValg & { kommando: string }) => Promise<Terminal>;
  /** Vault-kopi for denne testen (med fixture-mtimes) og konfig som peker på den. */
  vault: { readonly dir: string; readonly konfig: string };
  /** Starter presentasjonen i en ny tmux-terminal mot testens vault-kopi. Lukkes automatisk. */
  present: (valg?: StartValg) => Promise<Terminal>;
}

/**
 * Terminaltestene trenger ingen nettleser. Kalles først i hver test/fixture som starter en terminal.
 */
export function hoppOverUtenforTerminal(testInfo: TestInfo): void {
  testInfo.skip(!['terminal', 'perf'].includes(testInfo.project.name), 'terminaltester kjører bare i prosjektene terminal og perf');
  // ADR-011 §8: mangler tmux, skal v3-testene FEILE med en tydelig melding – ikke hoppes over stille.
  if (!harTmux()) throw new Error('tmux (≥ 3.2) mangler – v3-terminaltestene krever tmux (macOS: brew install tmux). Se docs/test/testplan-v3.md §2.');
}

/**
 * Terminaltestene trenger ingen nettleser. De kjører i prosjektet `terminal` (PO-118) og `perf` (AK-3-12). Uten tmux hoppes de over med forklaring.
 */
export const test = base.extend<TerminalFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright krever objektdestrukturering av fixtures
  rigg: async ({}, use, testInfo) => {
    hoppOverUtenforTerminal(testInfo);
    const åpne: Terminal[] = [];
    await use(async (valg) => {
      const t = await Terminal.start({ ...valg, konfig: null });
      åpne.push(t);
      return t;
    });
    for (const t of åpne) await t.lukk();
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright krever objektdestrukturering av fixtures
  vault: async ({}, use, testInfo) => {
    hoppOverUtenforTerminal(testInfo);
    const dir = makeTempDir('vault-leser-v3-vault-');
    const vaultDir = copyTestVault(dir);
    // Porten er bevisst en port ingen lytter på: terminalvarianten skal ikke trenge web-serveren (T7).
    const konfig = writeConfig(dir, vaultDir, E2E_PORT + 31);
    await use({ dir: vaultDir, konfig });
    removeDir(dir);
  },
  present: async ({ vault }, use) => {
    const åpne: Terminal[] = [];
    await use(async (valg = {}) => {
      const t = await Terminal.start({ konfig: vault.konfig, ...valg });
      åpne.push(t);
      return t;
    });
    for (const t of åpne) await t.lukk();
  },
});

export { expect };

/** Starter `npm run present -- <notat> …` og venter på tittellysbildet («1/N» i statuslinjen). */
export async function presenterNotat(present: TerminalFixtures['present'], notat: string, valg: StartValg = {}): Promise<Terminal> {
  const t = await present({ ...valg, args: [notat, ...(valg.args ?? [])] });
  await ventPåLysbilde(t, 1, 20_000);
  return t;
}

/** Mønstrene meldingen «Terminalen er for liten» skal treffe ved størrelsen `s`. */
export function forLiteMønstre(s: Størrelse): RegExp[] {
  return [
    ...fasit3.storrelser.forLiteMelding.inneholder.map((t) => new RegExp(t)),
    ...fasit3.storrelser.forLiteMelding.monstre.map((m) => new RegExp(m.replace('{cols}', String(s.cols)).replace('{rows}', String(s.rows)))),
  ];
}

/** Sjekker at terminalen er gjenopprettet etter at prosessen er ute (AK-3-11, terminalhygiene). */
export async function forventGjenopprettet(t: Terminal, exitkoder: readonly number[] = [0]): Promise<void> {
  const kode = await t.ventPåExit();
  expect(exitkoder, `exit-kode ${kode}`).toContain(kode);
  expect(t.tilstand(), 'alternativ skjerm av og markøren synlig').toMatchObject({ alternativSkjerm: false, markørSynlig: true });
  const { før, etter } = t.stty();
  expect(etter, 'tty-modus (echo, kanonisk, ISIG) gjenopprettet').toBe(før);
  const rå = t.råstrøm();
  const [altPå, altAv, markørAv, markørPå] = ['\u001b[?1049h', '\u001b[?1049l', '\u001b[?25l', '\u001b[?25h'];
  expect(rå.indexOf(altPå), 'gikk inn i alternativ skjerm').toBeGreaterThanOrEqual(0);
  expect(rå.lastIndexOf(altAv), 'gikk ut av alternativ skjerm til slutt').toBeGreaterThan(rå.lastIndexOf(altPå));
  expect(rå.lastIndexOf(markørPå), 'viste markøren igjen til slutt').toBeGreaterThan(rå.lastIndexOf(markørAv));
  expect(rå.indexOf(markørAv), 'skjulte markøren').toBeGreaterThanOrEqual(0);
}

/** Skriver en fil i vault-kopien (live-testene). */
export function skrivVaultfil(vaultDir: string, rel: string, innhold: string): void {
  const fil = join(vaultDir, rel);
  mkdirSync(join(fil, '..'), { recursive: true });
  writeFileSync(fil, innhold);
}
