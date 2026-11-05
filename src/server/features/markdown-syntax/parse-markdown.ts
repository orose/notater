import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { transformBlockIds, transformLatexBlocks, transformSoftBreaks, transformTaskStatuses } from './block-syntax';
import { transformInlineSyntax } from './inline-syntax';
import './obsidian-nodes';
import { preprocessObsidian, stripSentinels } from './preprocess';

const processor = unified().use(remarkParse).use(remarkGfm);

/**
 * Obsidian-markdown (brødtekst UTEN frontmatter) → mdast med Obsidian-noder.
 * Ren og synkron. Brukes av både vault-indeksen (metadata) og render-pipelinen.
 */
export function parseObsidianMarkdown(body: string): Root {
  const source = preprocessObsidian(body);
  const tree = processor.runSync(processor.parse(source)) as Root;
  transformLatexBlocks(tree, source);
  transformInlineSyntax(tree);
  transformBlockIds(tree);
  transformTaskStatuses(tree);
  transformSoftBreaks(tree);
  removeSentinels(tree);
  return tree;
}

function removeSentinels(tree: Root): void {
  visit(tree, (node) => {
    if ('value' in node && typeof node.value === 'string') node.value = stripSentinels(node.value);
    if (node.type === 'image' && node.alt) node.alt = stripSentinels(node.alt);
  });
}
