// CLI-argumentene til `npm run present` (ADR-011 §7, v3 «Start»). Ren funksjon.
//
// Delte flagg (`--vault`, `--config`, `--vault-id`) sendes uendret videre til serverens `resolveConfig`, så
// presedensen CLI > env > fil er nøyaktig som for web-leseren (ADR-005). Terminalflaggene tolkes her.
// Posisjonsargumentene settes sammen med mellomrom: `npm run present -- Statusmøte uke 45` virker uten anførselstegn.

import { parseArgs } from 'node:util';

export type LevelArg = 1 | 2 | 3 | 4 | 5 | 6 | 'auto';
export type ColorsArg = 'palett' | 'terminal';

export interface PresentArgs {
  /** Navn, alias eller sti (fuzzy-treff); `null` = søkbar notatliste. */
  readonly note: string | null;
  /** Videre til `resolveConfig` (ADR-005). */
  readonly configArgv: readonly string[];
  /** `--niva h<n>` / `auto`; `null` = ikke oppgitt (automatisk). */
  readonly level: LevelArg | null;
  /** `--palett <navn>`; valideres mot UX' fargefil når temaet lastes (slice 3-b). */
  readonly palette: string | null;
  /** `--farger terminal` = terminalens egne farger (standard, PO-132); `palett` = vaultleserens palett. `null` = ikke oppgitt. */
  readonly colors: ColorsArg | null;
  /** `--uten-agenda` = `:agenda av` fra start. */
  readonly transitions: boolean;
  readonly help: boolean;
}

export class PresentArgsError extends Error {
  override readonly name = 'PresentArgsError';
}

export const PRESENT_USAGE = [
  'Bruk: npm run present -- ["<notat>"] [flagg]',
  '',
  '  <notat>              Navn, alias eller sti (fuzzy). Uten notat: søkbar liste.',
  '  --vault <sti>        Vault-mappe (som web-leseren).',
  '  --config <fil>       Konfigurasjonsfil (som web-leseren).',
  '  --vault-id <id>      Vault fra konfigurasjonen (som web-leseren).',
  '  --niva h<n>|auto     Lysbildenivå (som :presenter h<n>).',
  '  --palett <navn>      Vaultleserens palett (papir, cyanotypi, fosfor, signal) i stedet for terminalens farger.',
  '  --farger terminal    Terminalens egne farger (standard); «palett» gir vaultleserens palett.',
  '  --uten-agenda        Uten overgangslysbilder (som :agenda av).',
  '  -h, --hjelp          Vis denne hjelpen.',
].join('\n');

function parseLevel(value: string): LevelArg {
  if (value === 'auto') return 'auto';
  const m = /^h([1-6])$/i.exec(value);
  if (!m) throw new PresentArgsError(`E475 Ugyldig nivå «${value}» – bruk auto eller h1–h6.`);
  return Number(m[1]) as LevelArg;
}

function parseColors(value: string): ColorsArg {
  if (value === 'terminal' || value === 'palett') return value;
  throw new PresentArgsError(`Ugyldig verdi for --farger: «${value}». Bruk «terminal» eller «palett».`);
}

export function parsePresentArgs(argv: readonly string[]): PresentArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: true,
      options: {
        vault: { type: 'string' },
        config: { type: 'string' },
        'vault-id': { type: 'string' },
        niva: { type: 'string' },
        palett: { type: 'string' },
        farger: { type: 'string' },
        'uten-agenda': { type: 'boolean' },
        hjelp: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PresentArgsError(`Ugyldige argumenter: ${reason}\n\n${PRESENT_USAGE}`);
  }
  const { values, positionals } = parsed;
  const configArgv: string[] = [];
  for (const name of ['vault', 'config', 'vault-id'] as const) {
    const value = values[name];
    if (value !== undefined) configArgv.push(`--${name}`, value);
  }
  const note = positionals.join(' ').trim();
  return {
    note: note === '' ? null : note,
    configArgv,
    level: values.niva === undefined ? null : parseLevel(values.niva),
    palette: values.palett ?? null,
    colors: values.farger === undefined ? null : parseColors(values.farger),
    transitions: !values['uten-agenda'],
    help: values.hjelp ?? false,
  };
}
