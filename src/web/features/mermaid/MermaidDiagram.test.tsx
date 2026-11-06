import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../theme';
import { MermaidDiagram } from './MermaidDiagram';
import { mermaidCaption, mermaidConfig } from './mermaid-config';
import { renderMermaid } from './mermaid-loader';

vi.mock('./mermaid-loader', () => ({ renderMermaid: vi.fn() }));
const renderMock = vi.mocked(renderMermaid);

function wrap(node: ReactNode) {
  return render(<ThemeProvider>{node}</ThemeProvider>);
}

beforeEach(() => {
  renderMock.mockReset();
  renderMock.mockImplementation(async (source) => `<svg data-src="${source.length}"><g/></svg>`);
});

describe('MermaidDiagram', () => {
  it('rendrer SVG i en figur med Forstørr-knapp', async () => {
    const { container } = wrap(<MermaidDiagram data-source={'flowchart LR\n  A-->B'} />);
    await waitFor(() => expect(container.querySelector('.diagram-frame svg')).not.toBeNull());
    expect(container.querySelector('figure.diagram')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Diagram' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forstørr/ })).toBeInTheDocument();
    expect(renderMock).toHaveBeenCalledWith('flowchart LR\n  A-->B', expect.objectContaining({ securityLevel: 'strict' }));
  });

  it('bruker %% caption som bildetekst og tilgjengelig navn', async () => {
    wrap(<MermaidDiagram data-source={'%% caption: Retry uten idempotens\nflowchart LR\n A-->B'} />);
    expect(await screen.findByRole('img', { name: 'Retry uten idempotens' })).toBeInTheDocument();
    expect(screen.getByText('Retry uten idempotens', { selector: 'figcaption span' })).toBeInTheDocument();
  });

  it('re-rendrer ved temabytte', async () => {
    wrap(<MermaidDiagram data-source="pie\n a: 1" />);
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));
    act(() => {
      fireEvent.keyDown(document, { key: '.', metaKey: true });
    });
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2));
  });

  it('viser «ikke støttet»-kort med kilde ved syntaksfeil', async () => {
    renderMock.mockRejectedValueOnce(new Error('Parse error on line 2'));
    wrap(<MermaidDiagram data-source="flowchart ugyldig ((" />);
    const card = await screen.findByRole('note');
    expect(card).toHaveTextContent('Diagrammet kunne ikke tegnes.');
    expect(card).toHaveTextContent('Parse error on line 2');
    expect(card).toHaveTextContent('flowchart ugyldig ((');
  });

  it('Forstørr åpner diagrammet i en dialog', async () => {
    wrap(<MermaidDiagram data-source="flowchart LR\n A-->B" />);
    const button = await screen.findByRole('button', { name: /Forstørr/ });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Diagram, forstørret' });
    expect(dialog.querySelector('svg')).not.toBeNull();
    fireEvent.keyDown(dialog.querySelector('.zoom-stage') as HTMLElement, { key: '+' });
    expect((dialog.querySelector('.zoom-content') as HTMLElement).style.transform).toContain('scale(1.25)');
    fireEvent.keyDown(dialog.querySelector('.zoom-stage') as HTMLElement, { key: '0' });
    expect((dialog.querySelector('.zoom-content') as HTMLElement).style.transform).toContain('scale(1)');
  });
});

describe('mermaidCaption', () => {
  it('finner caption-kommentar', () => {
    expect(mermaidCaption('%% caption: Hei\nflowchart')).toBe('Hei');
    expect(mermaidCaption('flowchart')).toBeNull();
  });
});

describe('mermaidConfig – bredde', () => {
  it('gir gantt rammens bredde slik at diagrammet ikke skaleres ned til smått (QA-MER-01)', () => {
    expect(mermaidConfig(document.documentElement, 612).gantt).toEqual({ axisFormat: '%d.%m', useWidth: 612 });
  });

  it('lar Mermaid velge bredde når rammen ikke er målt', () => {
    expect(mermaidConfig(document.documentElement, 0).gantt).toEqual({ axisFormat: '%d.%m' });
  });
});
