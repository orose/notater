import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseResult } from '../../../shared/api-types';
import { h, root } from '../../test-support/hast';
import { renderWithProviders } from '../../test-support/render-with-providers';
import { SearchProvider } from '../search';
import { HastContent } from './HastContent';

vi.mock('../mermaid/mermaid-loader', () => ({ renderMermaid: vi.fn(async () => '<svg></svg>') }));

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderContent(tree: ReturnType<typeof root>, bases: Record<string, BaseResult> = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"vaults":[],"defaultVaultId":"test"}')));
  return renderWithProviders(
    <SearchProvider vaultId="test">
      <HastContent vaultId="test" content={tree} bases={bases} />
    </SearchProvider>,
    { route: '/v/test/lenker/Lenketest' },
  );
}

describe('HastContent – lenker (AK7, AK9)', () => {
  it('interne wikilinks navigerer klientside', () => {
    renderContent(
      root(h('p', {}, h('a', { href: '/v/test/domene/Ordre', dataVrLink: 'internal', dataVrTarget: 'domene/Ordre' }, 'ordrene våre'))),
    );
    const link = screen.getByRole('link', { name: 'ordrene våre' });
    expect(link).toHaveClass('wikilink');
    fireEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent('/v/test/domene/Ordre');
  });

  it('brutte lenker navigerer ikke, men forklarer og foreslår alias (PO-7)', () => {
    renderContent(
      root(
        h(
          'p',
          {},
          h(
            'a',
            { dataVrLink: 'unresolved', dataVrRaw: 'Bestilling', dataVrSuggest: 'domene/Ordre', dataVrSuggestTitle: 'Ordre' },
            'Bestilling',
          ),
        ),
      ),
    );
    const broken = screen.getByRole('button', { name: 'Bestilling' });
    expect(broken).toHaveClass('wikilink', 'broken');
    expect(broken).toHaveAttribute('aria-expanded', 'false');
    expect(broken).toHaveAttribute('title', 'Notatet «Bestilling» finnes ikke ennå. Mente du «Ordre»?');
    fireEvent.click(broken);
    expect(broken).toHaveAttribute('aria-expanded', 'true');
    const pop = screen.getByRole('note');
    expect(pop).toHaveTextContent('Notatet «Bestilling» finnes ikke ennå.');
    expect(within(pop).getByRole('link', { name: 'Ordre' })).toHaveAttribute('href', '/v/test/domene/Ordre');
    fireEvent.keyDown(broken, { key: 'Escape' });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/v/test/lenker/Lenketest');
  });

  it('eksterne lenker åpnes i ny fane', () => {
    renderContent(root(h('p', {}, h('a', { href: 'https://spring.io', dataVrLink: 'external', rel: ['noopener', 'noreferrer'] }, 'Spring'))));
    const link = screen.getByRole('link', { name: 'Spring' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('external');
  });

  it('tagger åpner søk på taggen', () => {
    renderContent(root(h('p', {}, h('a', { dataVrLink: 'tag', dataVrTag: 'task/backend' }, '#task/backend'))));
    fireEvent.click(screen.getByRole('button', { name: '#task/backend' }));
    expect(screen.getByRole('combobox')).toHaveValue('#task/backend');
  });
});

describe('HastContent – elementer', () => {
  it('overskrifter får ankerlenke', () => {
    renderContent(root(h('h2', { id: 'brutte-lenker' }, 'Brutte lenker')));
    expect(screen.getByRole('heading', { level: 2, name: /Brutte lenker/ })).toHaveAttribute('id', 'brutte-lenker');
    expect(screen.getByRole('link', { name: 'Lenke til seksjonen «Brutte lenker»' })).toHaveAttribute(
      'href',
      '/v/test/lenker/Lenketest#brutte-lenker',
    );
  });

  it('tabeller pakkes i scrollbar region', () => {
    renderContent(root(h('table', {}, h('tbody', {}, h('tr', {}, h('td', {}, 'x'))))));
    expect(screen.getByRole('region', { name: 'Tabell' })).toHaveAttribute('tabindex', '0');
  });

  it('mapper vr-callout, vr-code, vr-embed og vr-unsupported', () => {
    renderContent(
      root(
        h('vr-callout', { dataCalloutType: 'tip', dataFold: 'none' }, h('vr-callout-title', {}, 'Tips'), h('vr-callout-body', {}, h('p', {}, 'Innhold'))),
        h('vr-code', { dataLang: 'java', dataCode: 'x' }, h('pre', { className: ['shiki'] }, h('code', {}, 'x'))),
        h('vr-embed', { dataStatus: 'missing', dataRaw: 'Finnes ikke' }),
        h('vr-unsupported', { dataKind: 'dataview', dataSource: 'TABLE x' }),
      ),
    );
    expect(document.querySelector('.callout[data-callout="tip"]')).not.toBeNull();
    expect(document.querySelector('figure.code')).not.toBeNull();
    expect(screen.getByText('Fant ikke «Finnes ikke»')).toBeInTheDocument();
    expect(screen.getByText('Dataview vises ikke her.')).toBeInTheDocument();
  });

  it('oppgavelister er skrivebeskyttede', () => {
    renderContent(
      root(h('ul', { className: ['contains-task-list'] }, h('li', { className: ['task-list-item'] }, h('input', { type: 'checkbox', checked: true, disabled: true }), ' gjort'))),
    );
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('manglende bilde gir plassholder', () => {
    renderContent(root(h('p', {}, h('img', { src: '/api/vaults/test/assets?path=mangler.png', alt: 'mangler.png' }))));
    fireEvent.error(screen.getByRole('img', { name: 'mangler.png' }));
    expect(screen.getByText('Bildet finnes ikke')).toBeInTheDocument();
  });

  it('eksterne bilder lastes ikke (B10, PO-13)', () => {
    renderContent(root(h('p', {}, h('img', { src: 'https://example.com/sporingspiksel.png', alt: 'spor' }))));
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByRole('link', { name: /Eksternt bilde/ })).toHaveAttribute('href', 'https://example.com/sporingspiksel.png');
  });

  it('vr-base viser base-komponenten med resultat', () => {
    const result: BaseResult = { views: [], warnings: [] };
    renderContent(root(h('vr-base', { dataBaseId: 'b1', dataSourcePath: 'Oppgaver.base' })), { b1: result });
    expect(screen.getByRole('region', { name: /Base: Oppgaver/ })).toBeInTheDocument();
  });
});
