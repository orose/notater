import type { BaseDocument, NoteDocument, TreeResponse, VaultsResponse } from '../../shared/api-types';
import { h, root } from '../../core/test-support/hast';

export const vaultsFixture: VaultsResponse = {
  defaultVaultId: 'test',
  vaults: [
    { id: 'test', name: 'Testvault', status: 'ready', noteCount: 80, revision: 3 },
    { id: 'jobb', name: 'Jobb', status: 'not-indexed', noteCount: null, revision: null },
  ],
};

export const treeFixture: TreeResponse = {
  vaultId: 'test',
  revision: 3,
  root: {
    kind: 'folder',
    name: '',
    path: '',
    children: [
      {
        kind: 'folder',
        name: 'domene',
        path: 'domene',
        children: [
          {
            kind: 'folder',
            name: 'delt',
            path: 'domene/delt',
            children: [{ kind: 'note', name: 'Adresse', path: 'domene/delt/Adresse' }],
          },
          { kind: 'note', name: 'Kunde', path: 'domene/Kunde' },
          { kind: 'note', name: 'Ordre', path: 'domene/Ordre' },
        ],
      },
      {
        kind: 'folder',
        name: 'teknisk',
        path: 'teknisk',
        children: [{ kind: 'note', name: 'Callouts', path: 'teknisk/Callouts' }],
      },
      { kind: 'base', name: 'Oppgaver.base', path: 'Oppgaver.base' },
      { kind: 'unsupported', name: 'Tegning.canvas', path: 'Tegning.canvas' },
      { kind: 'note', name: 'Velkommen', path: 'Velkommen' },
    ],
  },
};

export function noteFixture(overrides: Partial<NoteDocument> = {}): NoteDocument {
  return {
    kind: 'note',
    vaultId: 'test',
    revision: 3,
    path: 'domene/Ordre',
    filePath: 'domene/Ordre.md',
    title: 'Ordre',
    mtime: '2026-11-03T13:02:00.000Z',
    ctime: '2026-11-01T10:00:00.000Z',
    aliases: ['Bestilling'],
    tags: ['domene', 'kafka/topic'],
    properties: [
      { key: 'description', value: { type: 'string', value: 'Hvordan en ordre flyter gjennom systemet.' } },
      { key: 'status', value: { type: 'string', value: 'aktiv' } },
      { key: 'relatert', value: { type: 'link', target: 'domene/Kunde', display: 'Kunde' } },
    ],
    content: root(
      h('p', {}, 'En ordre opprettes når ', h('a', { href: '/v/test/domene/Kunde', dataVrLink: 'internal', dataVrTarget: 'domene/Kunde' }, 'kunden'), ' bestiller.'),
      h('h2', { id: 'livslop' }, 'Livsløp'),
      h('p', {}, 'Tekst.'),
      h('h2', { id: 'hendelser' }, 'Hendelser'),
      h('p', {}, 'Tekst.'),
      h('h3', { id: 'opprettet' }, 'Opprettet'),
      h('p', {}, 'Tekst.'),
    ),
    toc: [
      { depth: 2, text: 'Livsløp', id: 'livslop' },
      { depth: 2, text: 'Hendelser', id: 'hendelser' },
      { depth: 3, text: 'Opprettet', id: 'opprettet' },
    ],
    bases: {},
    backlinks: [{ source: 'domene/Betaling', sourceTitle: 'Betaling', snippet: 'Betaling hører til en Ordre.', count: 1 }],
    ...overrides,
  };
}

export function baseDocFixture(): BaseDocument {
  return {
    kind: 'base',
    vaultId: 'test',
    revision: 3,
    path: 'Oppgaver.base',
    filePath: 'Oppgaver.base',
    title: 'Oppgaver',
    mtime: '2026-11-03T13:02:00.000Z',
    ctime: '2026-11-01T10:00:00.000Z',
    backlinks: [],
    result: { views: [], warnings: [] },
  };
}
