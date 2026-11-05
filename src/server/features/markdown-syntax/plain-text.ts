import type { Nodes } from 'mdast';

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'listItem',
  'table',
  'tableRow',
  'code',
  'thematicBreak',
  'footnoteDefinition',
]);

/**
 * Ren tekst fra et mdast-tre (for TOC, snippets og søk). Blokker skilles med linjeskift,
 * tabellceller med mellomrom. Wikilinks gir alias eller mål, tagger gir `#tagg`.
 */
export function toPlainText(node: Nodes): string {
  return collect(node).replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

/** Tekst på én linje (overskrifter, snippets). */
export function toInlineText(node: Nodes): string {
  return collect(node).replace(/\s+/g, ' ').trim();
}

function collect(node: Nodes): string {
  switch (node.type) {
    case 'text':
    case 'inlineCode':
    case 'code':
      return node.value;
    case 'wikiLink':
      return node.alias ?? (node.target || (node.anchor ?? '').replace(/^\^/, ''));
    case 'obsidianTag':
      return `#${node.value}`;
    case 'image':
      return node.alt ?? '';
    case 'break':
      return ' ';
    case 'html':
    case 'unsupported':
    case 'footnoteReference':
    case 'yaml':
    case 'definition':
      return '';
    case 'tableCell':
      return `${node.children.map(collect).join('')} `;
    default:
      break;
  }
  if (!('children' in node)) return '';
  const inner = (node.children as Nodes[]).map(collect).join('');
  return BLOCK_TYPES.has(node.type) ? `${inner}\n` : inner;
}
