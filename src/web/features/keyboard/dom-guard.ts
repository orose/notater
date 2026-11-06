// P7 og tilgjengelighet (ADR-007 §3): når skal motoren se et tastetrykk? Bruker DOM-typer, men
// ingen React og ingen global tilstand ved import.

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden']);
const TEXT_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);
/** Roller der Space har egen betydning (aktiverer/velger). Leader (Space) må vike for disse. */
const SPACE_ROLES = new Set(['button', 'checkbox', 'switch', 'radio', 'tab', 'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'treeitem']);

function asElement(target: EventTarget | null): Element | null {
  return target !== null && typeof (target as Element).tagName === 'string' ? (target as Element) : null;
}

/** Fokus i noe man skriver i: tekst-`input`, `textarea`, `select`, contenteditable, tekstroller. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  const el = asElement(target);
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !NON_TEXT_INPUTS.has(((el as HTMLInputElement).type || 'text').toLowerCase());
  if ((el as HTMLElement).isContentEditable || el.getAttribute('contenteditable') === 'true') return true;
  return TEXT_ROLES.has(el.getAttribute('role') ?? '');
}

/** Space aktiverer/velger elementet (knapp, avkrysning, `summary`, fane …) – leader skal ikke stjele den. */
export function isSpaceActivationTarget(target: EventTarget | null): boolean {
  const el = asElement(target);
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'summary' || tag === 'select') return true;
  if (tag === 'input') return ['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'file', 'color'].includes((el as HTMLInputElement).type);
  return SPACE_ROLES.has(el.getAttribute('role') ?? '');
}

/** En modal dialog er åpen (P7): motoren er da helt inaktiv; dialogen eier sine egne taster og Esc. */
export function hasOpenModal(doc: Document): boolean {
  return doc.querySelector('dialog[open], [aria-modal="true"]') !== null;
}
