import { describe, expect, it } from 'vitest';
import { effectiveKeyTarget, hasOpenModal, isSpaceActivationTarget, isTextEntryTarget } from './dom-guard';

function el(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as Element;
}

describe('dom-guard (P7)', () => {
  it('kjenner igjen tekstfelt', () => {
    expect(isTextEntryTarget(el('<input type="search">'))).toBe(true);
    expect(isTextEntryTarget(el('<input>'))).toBe(true);
    expect(isTextEntryTarget(el('<textarea></textarea>'))).toBe(true);
    expect(isTextEntryTarget(el('<div role="combobox"></div>'))).toBe(true);
    expect(isTextEntryTarget(el('<input type="checkbox">'))).toBe(false);
    expect(isTextEntryTarget(el('<button></button>'))).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });

  it('Space tilhører knapper, avkrysning, faner og trenoder', () => {
    expect(isSpaceActivationTarget(el('<button></button>'))).toBe(true);
    expect(isSpaceActivationTarget(el('<div role="tab"></div>'))).toBe(true);
    expect(isSpaceActivationTarget(el('<a href="/x">x</a>'))).toBe(false);
    expect(isSpaceActivationTarget(el('<main></main>'))).toBe(false);
  });

  it('åpen modal dialog', () => {
    expect(hasOpenModal(document)).toBe(false);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    expect(hasOpenModal(document)).toBe(true);
    dialog.remove();
  });

  it('PO-81: fokus i en dialog som akkurat er lukket regnes som dokumentet', () => {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<input type="search">';
    document.body.append(dialog);
    const input = dialog.querySelector('input') as HTMLInputElement;
    dialog.setAttribute('open', '');
    expect(effectiveKeyTarget(input)).toBe(input);
    dialog.removeAttribute('open');
    expect(effectiveKeyTarget(input)).toBe(document.body);
    expect(isTextEntryTarget(effectiveKeyTarget(input))).toBe(false);
    const outside = document.createElement('input');
    expect(effectiveKeyTarget(outside)).toBe(outside);
    dialog.remove();
  });
});
