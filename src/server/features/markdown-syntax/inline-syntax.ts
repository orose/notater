/**
 * Inline Obsidian-syntaks i mdast-tekstnoder: wikilinks/embeds, `==markering==`, `#tagger`,
 * inline-LaTeX og inline-fotnoter `^[…]`. Virker kun på `text`-noder, så kode røres aldri.
 */
import type { FootnoteDefinition, PhrasingContent, Root } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';
import type { RegExpMatchObject } from 'mdast-util-find-and-replace';
import type { Highlight, ObsidianTag, UnsupportedNode, WikiLink } from './obsidian-nodes';
import { parseWikiLinkInner } from './wikilink-syntax';

const WIKILINK = /(!?)\[\[([^[\]\n]+)\]\]/g;
const HIGHLIGHT = /==(?=[^\s=])([^\n]*?[^\s=])==/g;
// Tagg: «#» etter linjestart/mellomrom, minst ett tegn som ikke er et siffer.
const TAG = /(?<=^|\s)#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu;
// Inline-LaTeX: $…$ der åpning ikke følges av mellomrom og lukking ikke følges av et siffer.
const INLINE_LATEX = /(?<![\\$\w])\$(?=[^\s$])([^$\n]*?[^\s$\\])\$(?![\d$])/g;
const INLINE_FOOTNOTE = /\^\[([^[\]\n]+)\]/g;

/** Overordnede noder der inline Obsidian-syntaks ikke skal tolkes. */
const IGNORED_PARENTS = ['link', 'linkReference'];

export function transformInlineSyntax(tree: Root): void {
  findAndReplace(tree, [[WIKILINK, replaceWikiLink]], { ignore: IGNORED_PARENTS });
  findAndReplace(tree, [[HIGHLIGHT, replaceHighlight]], { ignore: IGNORED_PARENTS });
  findAndReplace(tree, [[TAG, replaceTag]], { ignore: IGNORED_PARENTS });
  findAndReplace(tree, [[INLINE_LATEX, replaceInlineLatex]], { ignore: IGNORED_PARENTS });
  transformInlineFootnotes(tree);
}

function replaceWikiLink(value: string, bang: string, inner: string): WikiLink | false {
  const parts = parseWikiLinkInner(inner);
  if (parts.target === '' && parts.anchor === null) return false;
  return { type: 'wikiLink', value, embed: bang === '!', ...parts };
}

function replaceHighlight(_value: string, inner: string): Highlight {
  return { type: 'highlight', children: [{ type: 'text', value: inner }] };
}

function replaceTag(_value: string, tag: string): ObsidianTag {
  return { type: 'obsidianTag', value: tag.replace(/\/+$/, '') };
}

function replaceInlineLatex(value: string): UnsupportedNode {
  return { type: 'unsupported', kind: 'latex', value, inline: true };
}

function transformInlineFootnotes(tree: Root): void {
  const definitions: FootnoteDefinition[] = [];
  findAndReplace(
    tree,
    [
      [
        INLINE_FOOTNOTE,
        (_value: string, content: string, match: RegExpMatchObject): PhrasingContent | false => {
          const parent = match.stack[match.stack.length - 2];
          if (parent?.type === 'footnoteDefinition') return false;
          const identifier = `inline-${definitions.length + 1}`;
          definitions.push({
            type: 'footnoteDefinition',
            identifier,
            label: identifier,
            children: [{ type: 'paragraph', children: [{ type: 'text', value: content }] }],
          });
          return { type: 'footnoteReference', identifier, label: identifier };
        },
      ],
    ],
    { ignore: IGNORED_PARENTS },
  );
  tree.children.push(...definitions);
}
