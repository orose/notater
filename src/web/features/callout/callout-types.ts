import type { IconName } from '../../shared/ui/Icon';

export type CalloutType =
  | 'note'
  | 'abstract'
  | 'info'
  | 'todo'
  | 'tip'
  | 'success'
  | 'question'
  | 'warning'
  | 'failure'
  | 'danger'
  | 'bug'
  | 'example'
  | 'quote';

interface CalloutMeta {
  readonly label: string;
  /** Obsidians engelske standardtittel (serveren kan sende den når tittel mangler). */
  readonly english: string;
  readonly icon: IconName;
}

export const CALLOUT_META: Readonly<Record<CalloutType, CalloutMeta>> = {
  note: { label: 'Merk', english: 'Note', icon: 'note' },
  abstract: { label: 'Sammendrag', english: 'Abstract', icon: 'abstract' },
  info: { label: 'Info', english: 'Info', icon: 'info' },
  todo: { label: 'Gjøremål', english: 'Todo', icon: 'todo' },
  tip: { label: 'Tips', english: 'Tip', icon: 'tip' },
  success: { label: 'Suksess', english: 'Success', icon: 'success' },
  question: { label: 'Spørsmål', english: 'Question', icon: 'question' },
  warning: { label: 'Advarsel', english: 'Warning', icon: 'warning' },
  failure: { label: 'Feilet', english: 'Failure', icon: 'failure' },
  danger: { label: 'Fare', english: 'Danger', icon: 'danger' },
  bug: { label: 'Feil', english: 'Bug', icon: 'bug' },
  example: { label: 'Eksempel', english: 'Example', icon: 'example' },
  quote: { label: 'Sitat', english: 'Quote', icon: 'quote' },
};

// Obsidian-aliaser (designsystem §7.7). Serveren normaliserer også; dette er et sikkerhetsnett.
const ALIASES: Readonly<Record<string, CalloutType>> = {
  summary: 'abstract',
  tldr: 'abstract',
  hint: 'tip',
  important: 'tip',
  check: 'success',
  done: 'success',
  help: 'question',
  faq: 'question',
  caution: 'warning',
  attention: 'warning',
  fail: 'failure',
  missing: 'failure',
  error: 'danger',
  cite: 'quote',
};

export interface ResolvedCallout {
  readonly type: CalloutType;
  readonly label: string;
  readonly icon: IconName;
  /** Titler som regnes som «standardtittel» (vises ikke som undertittel). */
  readonly defaultTitles: readonly string[];
}

export function resolveCallout(rawType: string): ResolvedCallout {
  const t = rawType.trim().toLowerCase();
  const known = (t in CALLOUT_META ? t : ALIASES[t]) as CalloutType | undefined;
  if (known) {
    const meta = CALLOUT_META[known];
    const raw = t.charAt(0).toUpperCase() + t.slice(1);
    return { type: known, label: meta.label, icon: meta.icon, defaultTitles: [meta.label, meta.english, raw] };
  }
  const label = t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Merk';
  return { type: 'note', label, icon: 'note', defaultTitles: [label] };
}
