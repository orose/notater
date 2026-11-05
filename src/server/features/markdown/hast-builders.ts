import type { Element, ElementContent, Properties, Text } from 'hast';

export function h(tagName: string, properties: Properties = {}, children: ElementContent[] = []): Element {
  return { type: 'element', tagName, properties, children };
}

export function text(value: string): Text {
  return { type: 'text', value };
}

/** Maks lengde på kildetekst i `data-source` for «ikke støttet»-kort (api.md). */
export const MAX_SOURCE_LENGTH = 2000;

export function truncateSource(source: string): string {
  return source.length > MAX_SOURCE_LENGTH ? `${source.slice(0, MAX_SOURCE_LENGTH)}…` : source;
}
