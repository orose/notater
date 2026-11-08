import { describe, expect, it } from 'vitest';
import { imageMimeType, isImageExtension } from './asset-types';

describe('imageMimeType', () => {
  it('kjenner hvitelistede bildetyper, case-insensitivt', () => {
    expect(imageMimeType('png')).toBe('image/png');
    expect(imageMimeType('JPG')).toBe('image/jpeg');
    expect(imageMimeType('svg')).toBe('image/svg+xml');
  });

  it('avviser alt annet', () => {
    expect(imageMimeType('html')).toBeNull();
    expect(imageMimeType('md')).toBeNull();
    expect(isImageExtension('pdf')).toBe(false);
  });
});
