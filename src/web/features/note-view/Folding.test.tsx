import type { Element, Root } from 'hast';
import { act, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test-support/render-with-providers';
import { FoldingProvider, OutlineHost, buildOutline, useOutlineControl } from '../outline';
import { HastContent } from './HastContent';
import { prepareContent } from './prepare-content';

const h = (level: number, id: string, text: string): Element => ({ type: 'element', tagName: `h${level}`, properties: { id }, children: [{ type: 'text', value: text }] });
const p = (text: string, id?: string): Element => ({ type: 'element', tagName: 'p', properties: id ? { id } : {}, children: [{ type: 'text', value: text }] });

const content: Root = {
  type: 'root',
  children: [p('Intro.'), h(2, 'a', 'Seksjon A'), p('Markør A-2.'), h(3, 'a1', 'Seksjon A.1'), p('Markør A-3.', '^blokk'), h(2, 'b', 'Seksjon B'), p('Markør B-2.')],
};

const probe: { control: ReturnType<typeof useOutlineControl>; navigate: ReturnType<typeof useNavigate> | null } = { control: null, navigate: null };
function Probe() {
  const control = useOutlineControl();
  const navigate = useNavigate();
  useEffect(() => {
    probe.control = control;
    probe.navigate = navigate;
  });
  return null;
}

function setup() {
  const outline = buildOutline(prepareContent(content), []);
  return renderWithProviders(
    <OutlineHost>
      <Probe />
      <FoldingProvider outline={outline} docKey="test\nDyp">
        <article className="prose">
          <HastContent vaultId="test" content={outline.content} bases={{}} prepared />
        </article>
      </FoldingProvider>
    </OutlineHost>,
    { route: '/v/test/Dyp' },
  );
}

const visible = (text: string) => !screen.getByText(text).closest('[hidden]');

describe('folding i notatvisningen (F3)', () => {
  it('pilen folder seksjonen sammen og ut, med aria-expanded, navn og fold-linje', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Fold sammen «Seksjon A»' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAccessibleName('Fold ut «Seksjon A»');
    expect(visible('Markør A-2.')).toBe(false);
    expect(visible('Markør A-3.')).toBe(false);
    expect(visible('Markør B-2.')).toBe(true);
    const heading = document.getElementById('a') as HTMLElement;
    expect(heading).toHaveAttribute('data-vr-folded');
    expect(heading.querySelector('[data-testid="fold-indikator"] .fl-text')).toHaveAttribute('data-text', '6 ord');
    fireEvent.click(heading.querySelector('.fold-line') as HTMLElement);
    expect(visible('Markør A-2.')).toBe(true);
    expect(heading).not.toHaveAttribute('data-vr-folded');
  });

  it('§-nummer på H2 fra disposisjonen', () => {
    setup();
    expect(document.getElementById('a')).toHaveAttribute('data-vr-sec', '1');
    expect(document.getElementById('b')).toHaveAttribute('data-vr-sec', '2');
    expect(document.getElementById('a1')).not.toHaveAttribute('data-vr-sec');
  });

  it('kontrollen for kommandoene: zM folder alle, zR folder ut, antall foldbare', () => {
    setup();
    expect(probe.control?.foldableHeadings).toBe(3);
    act(() => probe.control?.foldAll());
    expect(visible('Markør B-2.')).toBe(false);
    expect(visible('Intro.')).toBe(true);
    act(() => probe.control?.unfoldAll());
    expect(visible('Markør B-2.')).toBe(true);
  });

  it('navigasjon til #blokk folder ut seksjonene rundt målet, og bare dem', () => {
    setup();
    act(() => probe.control?.foldAll());
    act(() => void probe.navigate?.({ hash: '#%5Eblokk' }));
    expect(visible('Markør A-3.')).toBe(true);
    expect(screen.getByRole('button', { name: /Seksjon B/ })).toHaveAttribute('aria-expanded', 'false');
  });
});
