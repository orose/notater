import type { HeadingFold } from './use-outline';

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('nb-NO')} ${n === 1 ? one : many}`;
}

/**
 * Fold-pilen (F3, designsystem §11.5): en knapp i overskriften med `aria-expanded` og navn
 * «Fold sammen «X»» / «Fold ut «X»» (PO-59). Synlig ved hover/fokus, alltid på touch.
 */
export function FoldToggle({ text, fold, sec }: { readonly text: string; readonly fold: HeadingFold; readonly sec?: string | undefined }) {
  return (
    <button
      type="button"
      className="fold"
      aria-expanded={!fold.folded}
      aria-label={`${fold.folded ? 'Fold ut' : 'Fold sammen'} «${text}»`}
      title={fold.folded ? 'Fold ut (za)' : 'Fold sammen (za)'}
      data-sec={sec}
      onClick={fold.toggle}
    >
      <svg className="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/**
 * Fold-linjen: indikator for skjult innhold (vims foldtext, per typesett i CSS), med antall ord og figurer.
 * `aria-hidden` (knappen bærer tilstanden); klikk folder ut.
 */
export function FoldLine({ fold }: { readonly fold: HeadingFold }) {
  const { words, figures } = fold.stats;
  return (
    <span className="fold-line" data-testid="fold-indikator" aria-hidden="true" onClick={fold.toggle}>
      <span className="fl-mark" />
      {/* Teksten tegnes med CSS (attr), så den ikke blir en del av overskriftens tekstinnhold. */}
      <span className="fl-text" data-text={`${plural(words, 'ord', 'ord')}${figures > 0 ? ` · ${plural(figures, 'figur', 'figurer')}` : ''}`} />
      <span className="fl-lead" />
      <span className="fl-act" />
    </span>
  );
}
