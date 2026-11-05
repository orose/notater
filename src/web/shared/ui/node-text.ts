import { Children, isValidElement, type ReactNode } from 'react';

/** Ren tekst fra et React-tre (for sammenligning/aria), uten å rendre. */
export function nodeText(node: ReactNode): string {
  let out = '';
  Children.forEach(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') out += String(child);
    else if (isValidElement<{ children?: ReactNode }>(child)) out += nodeText(child.props.children);
  });
  return out;
}
