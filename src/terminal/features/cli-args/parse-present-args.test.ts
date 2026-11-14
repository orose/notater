import { describe, expect, it } from 'vitest';
import { PresentArgsError, parsePresentArgs } from './index';

describe('argumentene til npm run present (ADR-011 §7)', () => {
  it('setter sammen notatnavnet og sender delte flagg videre til konfigurasjonen', () => {
    const args = parsePresentArgs(['Statusmøte', 'uke', '45', '--vault', './test-vault', '--vault-id', 'test']);
    expect(args.note).toBe('Statusmøte uke 45');
    expect(args.configArgv).toEqual(['--vault', './test-vault', '--vault-id', 'test']);
    expect(args).toMatchObject({ level: null, palette: null, colors: null, transitions: true, help: false });
  });

  it('tolker terminalflaggene', () => {
    expect(parsePresentArgs(['--niva', 'h3', '--palett', 'fosfor', '--farger', 'terminal', '--uten-agenda'])).toMatchObject({
      note: null,
      level: 3,
      palette: 'fosfor',
      colors: 'terminal',
      transitions: false,
    });
    expect(parsePresentArgs(['--niva', 'auto']).level).toBe('auto');
    expect(parsePresentArgs(['-h']).help).toBe(true);
  });

  it('gir norske feilmeldinger med vim-kode for ugyldig nivå', () => {
    expect(() => parsePresentArgs(['--niva', 'h9'])).toThrow('E475 Ugyldig nivå «h9»');
    expect(() => parsePresentArgs(['--farger', 'rgb'])).toThrow(PresentArgsError);
    expect(() => parsePresentArgs(['--port', '4317'])).toThrow(PresentArgsError);
  });
});
