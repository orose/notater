import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock';

afterEach(() => {
  vi.useRealTimers();
});

function renderCode(props: Record<string, string>) {
  return render(
    <CodeBlock {...props}>
      <pre className="shiki vault-leser">
        <code>
          <span className="line">kode</span>
        </code>
      </pre>
    </CodeBlock>,
  );
}

describe('CodeBlock', () => {
  it('er en figur med filnavn, språkmerke og kopier-knapp', () => {
    const { container } = renderCode({ 'data-lang': 'java', 'data-title': 'OrdreProdusent.java', 'data-code': 'x' });
    const figure = container.querySelector('figure.code');
    expect(figure).toHaveAttribute('data-lang', 'java');
    expect(screen.getByText('OrdreProdusent.java')).toHaveClass('file');
    expect(screen.getByText('java')).toHaveClass('lang');
    expect(screen.getByRole('button', { name: 'Kopier kode' })).toBeInTheDocument();
  });

  it('gjør <pre> fokuserbar så tastaturbrukere kan scrolle', () => {
    const { container } = renderCode({ 'data-lang': 'bash', 'data-code': 'x' });
    expect(container.querySelector('pre')).toHaveAttribute('tabindex', '0');
  });

  it('utelater filnavn og språkmerke når de mangler', () => {
    const { container } = renderCode({ 'data-lang': '', 'data-code': 'x' });
    expect(container.querySelector('.file')).toBeNull();
    expect(container.querySelector('.lang')).toBeNull();
  });

  it('kopierer rå kildetekst og annonserer det', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderCode({ 'data-lang': 'bash', 'data-code': '\tif x; then\n  echo "hei"\nfi' });
    const button = screen.getByRole('button', { name: 'Kopier kode' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith('\tif x; then\n  echo "hei"\nfi');
    expect(button).toHaveTextContent('Kopiert');
    expect(button).toHaveAttribute('data-state', 'copied');
    expect(screen.getByRole('status')).toHaveTextContent('Kopiert til utklippstavlen');
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(button).toHaveTextContent('Kopier');
  });
});
