import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UnsupportedCard, unsupportedText } from './UnsupportedCard';

describe('UnsupportedCard', () => {
  it('er et diskret notat-kort med fet tittel, forklaring og «Vis kilde»', () => {
    render(<UnsupportedCard title="Dataview vises ikke her." text="Spørringen kjøres bare i Obsidian." source="TABLE x" />);
    const card = screen.getByRole('note');
    expect(card).toHaveClass('unsupported');
    expect(screen.getByText('Dataview vises ikke her.').tagName).toBe('STRONG');
    expect(screen.getByText('Vis kilde')).toBeInTheDocument();
    expect(screen.getByText('TABLE x').tagName).toBe('PRE');
  });

  it('utelater «Vis kilde» uten kilde', () => {
    render(<UnsupportedCard title="Canvas støttes ikke." />);
    expect(screen.queryByText('Vis kilde')).toBeNull();
  });

  it('har norske tekster per type', () => {
    expect(unsupportedText('dataview').title).toBe('Dataview vises ikke her.');
    expect(unsupportedText('latex').title).toBe('LaTeX vises ikke her.');
    expect(unsupportedText('canvas').title).toBe('Canvas støttes ikke.');
    expect(unsupportedText('excalidraw').title).toBe('Excalidraw støttes ikke.');
    expect(unsupportedText('noe-annet').title).toBe('Dette innholdet støttes ikke.');
  });
});
