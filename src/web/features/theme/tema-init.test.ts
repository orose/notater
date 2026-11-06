import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import source from '../../public/tema-init.js?raw';
import { setMediaQuery } from '../../test-support/match-media';

// Scriptet kjøres synkront i <head> før CSS maler (ingen «flash» av feil tema).

function runScript(search = '') {
  window.history.replaceState(null, '', `/${search}`);
  new Function(source)();
  return document.documentElement.dataset;
}

describe('tema-init.js', () => {
  it('lastes blokkerende i <head> før stilarkene', () => {
    const head = indexHtml.slice(0, indexHtml.indexOf('</head>'));
    expect(head).toMatch(/<script src="\/tema-init\.js"><\/script>/);
  });

  it('bruker standardtema og OS-modus ved første besøk', () => {
    setMediaQuery('(prefers-color-scheme: dark)', true);
    expect(runScript()).toMatchObject({ type: 'tidsskrift', palette: 'papir', mode: 'dark', modePref: 'system', ornaments: 'on' });
  });

  it('bruker lagret valg', () => {
    localStorage.setItem('vault-leser.tema', JSON.stringify({ mode: 'light', type: 'terminal', palette: 'signal', ornaments: false }));
    setMediaQuery('(prefers-color-scheme: dark)', true);
    expect(runScript()).toMatchObject({ type: 'terminal', palette: 'signal', mode: 'light', ornaments: 'off' });
  });

  it('URL-parametre overstyrer (for skjermbilder og deling)', () => {
    expect(runScript('?type=terminal&palette=fosfor&mode=dark')).toMatchObject({ type: 'terminal', palette: 'fosfor', mode: 'dark' });
    expect(runScript('?type=klartekst')).toMatchObject({ type: 'klartekst' }); // PO-18
  });

  it('krasjer ikke på ugyldige verdier eller ødelagt lagring', () => {
    localStorage.setItem('vault-leser.tema', '{ødelagt');
    expect(runScript('?type=<script>')).toMatchObject({ type: 'tidsskrift', palette: 'papir', mode: 'light' });
  });
});
