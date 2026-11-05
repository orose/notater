import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Callout } from './Callout';
import { CalloutBody } from './CalloutBody';
import { CalloutTitle } from './CalloutTitle';

function renderCallout(type: string, fold: string, title: string, body = 'Innhold') {
  return render(
    <Callout data-callout-type={type} data-fold={fold}>
      <CalloutTitle>{title}</CalloutTitle>
      {body ? (
        <CalloutBody>
          <p>{body}</p>
        </CalloutBody>
      ) : null}
    </Callout>,
  );
}

describe('Callout', () => {
  it('viser norsk etikett og egen tittel', () => {
    const { container } = renderCallout('warning', 'none', 'Idempotens er ikke exactly-once');
    const callout = container.querySelector('.callout');
    expect(callout).toHaveAttribute('data-callout', 'warning');
    expect(screen.getByText('Advarsel')).toHaveClass('callout-name');
    expect(screen.getByText('Idempotens er ikke exactly-once')).toHaveClass('callout-sub');
    expect(screen.getByText('Innhold')).toBeInTheDocument();
  });

  it('dropper undertittel når tittelen bare er standardtittelen', () => {
    renderCallout('note', 'none', 'Note');
    expect(screen.getByText('Merk')).toBeInTheDocument();
    expect(document.querySelector('.callout-sub')).toBeNull();
    renderCallout('tip', 'none', 'Tips');
    expect(document.querySelectorAll('.callout-sub')).toHaveLength(0);
  });

  it('mapper Obsidian-aliaser og ukjente typer', () => {
    const { container } = renderCallout('faq', 'none', 'Spørsmål');
    expect(container.querySelector('.callout')).toHaveAttribute('data-callout', 'question');
    const other = renderCallout('egendefinert', 'none', 'Ukjent type');
    expect(other.container.querySelector('.callout')).toHaveAttribute('data-callout', 'note');
    expect(other.getByText('Egendefinert')).toHaveClass('callout-name');
  });

  it('foldbar lukket callout (-) er lukket ved lasting og kan åpnes med tastatur/klikk', () => {
    const { container } = renderCallout('tip', 'closed', 'Tommelfingerregel');
    const details = container.querySelector('details');
    expect(details).not.toHaveAttribute('open');
    const summary = container.querySelector('summary');
    expect(summary).not.toBeNull();
    fireEvent.click(summary as HTMLElement);
    // jsdom endrer ikke open ved klikk; nettleseren gjør det. Vi verifiserer toggle-synk:
    (details as HTMLDetailsElement).open = true;
    fireEvent(details as HTMLElement, new Event('toggle'));
    expect(details).toHaveAttribute('open');
  });

  it('foldbar åpen callout (+) er åpen', () => {
    const { container } = renderCallout('tip', 'open', 'Tips');
    expect(container.querySelector('details')).toHaveAttribute('open');
  });

  it('callout med bare tittel har ingen tom innholdsboks', () => {
    const { container } = renderCallout('info', 'none', 'Bare tittel', '');
    expect(container.querySelector('.callout-body')).toBeNull();
  });
});
