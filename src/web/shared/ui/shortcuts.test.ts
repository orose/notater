import { afterEach, describe, expect, it, vi } from 'vitest';
import { isApplePlatform, isModifierPressed, modifierLabel, shortcutLabel } from './shortcuts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isApplePlatform (PO-36)', () => {
  it('kjenner igjen macOS og iOS', () => {
    expect(isApplePlatform({ platform: 'MacIntel', userAgent: '' })).toBe(true);
    expect(isApplePlatform({ platform: 'iPhone', userAgent: '' })).toBe(true);
    expect(isApplePlatform({ platform: '', userAgent: '', userAgentData: { platform: 'macOS' } })).toBe(true);
  });

  it('er usann for Windows, Linux og ukjent', () => {
    expect(isApplePlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe(false);
    expect(isApplePlatform({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe(false);
    expect(isApplePlatform({ platform: '', userAgent: '' })).toBe(false);
  });

  it('faller tilbake til userAgent når platform mangler', () => {
    expect(isApplePlatform({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' })).toBe(true);
  });
});

describe('shortcutLabel / modifierLabel', () => {
  it('viser ⌘K på macOS', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    expect(shortcutLabel('K')).toBe('⌘K');
    expect(modifierLabel()).toBe('⌘');
  });

  it('viser Ctrl K ellers', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    expect(shortcutLabel('K')).toBe('Ctrl K');
    expect(modifierLabel()).toBe('Ctrl');
  });
});

describe('isModifierPressed', () => {
  it('godtar både Meta og Ctrl uansett plattform', () => {
    expect(isModifierPressed({ metaKey: true, ctrlKey: false })).toBe(true);
    expect(isModifierPressed({ metaKey: false, ctrlKey: true })).toBe(true);
    expect(isModifierPressed({ metaKey: false, ctrlKey: false })).toBe(false);
  });
});
