// Minimal HAST-bygger for tester (speiler JSON-formen serveren sender, se api.md «HAST-kontrakt»).
import type { Element, ElementContent, Properties, Root } from 'hast';

type Child = ElementContent | string;

export function h(tagName: string, properties: Properties = {}, ...children: Child[]): Element {
  return {
    type: 'element',
    tagName,
    properties,
    children: children.map((c) => (typeof c === 'string' ? { type: 'text', value: c } : c)),
  };
}

export function root(...children: Child[]): Root {
  return { type: 'root', children: children.map((c) => (typeof c === 'string' ? { type: 'text', value: c } : c)) };
}
