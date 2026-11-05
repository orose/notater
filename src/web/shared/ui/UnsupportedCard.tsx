import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface UnsupportedCardProps {
  readonly title: string;
  readonly text?: ReactNode;
  readonly source?: string;
}

/** «Ikke støttet»-kortet (designsystem §7.13): rolig, tydelig, aldri en krasj. */
export function UnsupportedCard({ title, text, source }: UnsupportedCardProps) {
  return (
    <div className="unsupported" role="note">
      <Icon name="block" />
      <p>
        <strong>{title}</strong>
        {text ? <> {text}</> : null}
      </p>
      {source ? (
        <details>
          <summary>Vis kilde</summary>
          <pre>{source}</pre>
        </details>
      ) : null}
    </div>
  );
}

const TEXTS: Readonly<Record<string, { readonly title: string; readonly text: string }>> = {
  dataview: { title: 'Dataview vises ikke her.', text: 'Spørringen kjøres bare i Obsidian.' },
  latex: { title: 'LaTeX vises ikke her.', text: 'Formelen står som kildetekst.' },
  canvas: { title: 'Canvas støttes ikke.', text: 'Tegningen kan åpnes i Obsidian.' },
  excalidraw: { title: 'Excalidraw støttes ikke.', text: 'Skissen kan åpnes i Obsidian.' },
  other: { title: 'Dette innholdet støttes ikke.', text: 'Det vises bare i Obsidian.' },
};

export function unsupportedText(kind: string): { readonly title: string; readonly text: string } {
  return TEXTS[kind] ?? (TEXTS.other as { title: string; text: string });
}
