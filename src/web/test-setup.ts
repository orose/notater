import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { installMatchMedia, resetMatchMedia } from './test-support/match-media';

// jsdom mangler <dialog>.showModal()/close(). Minimal polyfill som speiler nettleseren:
// `open`-attributt, `close`-hendelse og fokus tilbake håndteres av komponentene selv.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

// jsdom mangler scrollIntoView/scrollTo.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
window.scrollTo = (() => {}) as typeof window.scrollTo;

installMatchMedia();

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // ignorer
  }
  resetMatchMedia();
  document.documentElement.removeAttribute('data-type');
  document.documentElement.removeAttribute('data-palette');
  document.documentElement.removeAttribute('data-mode');
  document.documentElement.removeAttribute('data-mode-pref');
  document.documentElement.removeAttribute('data-ornaments');
});

afterEach(() => {
  cleanup();
});
