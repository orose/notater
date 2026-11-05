import type { Root } from 'mdast';
import { gfmFootnoteFromMarkdown } from 'mdast-util-gfm-footnote';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { gfmFootnote } from 'micromark-extension-gfm-footnote';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Processor } from 'unified';
import { transformLatexBlocks } from './block-syntax';
import { transformObsidianSyntax } from './obsidian-transform';
import './obsidian-nodes';
import { preprocessObsidian } from './preprocess';

/**
 * GFM uten «autolink literal» (rene URL-er som `https://x.no` → lenke). Den utvidelsen koster ~1/3
 * av parsetiden og påvirker bare eksterne URL-er, som aldri er vault-lenker. Brukes av indeksen.
 */
function remarkGfmWithoutAutolinkLiterals(this: Processor): void {
  const data = this.data();
  (data.micromarkExtensions ??= []).push(gfmTable(), gfmFootnote(), gfmTaskListItem(), gfmStrikethrough());
  (data.fromMarkdownExtensions ??= []).push(
    gfmTableFromMarkdown(),
    gfmFootnoteFromMarkdown(),
    gfmTaskListItemFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
  );
}

const fullProcessor = unified().use(remarkParse).use(remarkGfm);
const indexProcessor = unified().use(remarkParse).use(remarkGfmWithoutAutolinkLiterals);

export interface ParseOptions {
  /**
   * `full` (standard, rendering): all GFM. `index` (metadata): GFM uten autolink-literaler – raskere,
   * og gir identiske wikilinks, tagger, overskrifter og blokk-id-er.
   */
  readonly profile?: 'full' | 'index';
}

/**
 * Obsidian-markdown (brødtekst UTEN frontmatter) → mdast med Obsidian-noder.
 * Ren og synkron. Brukes av både vault-indeksen (metadata) og render-pipelinen.
 */
export function parseObsidianMarkdown(body: string, options: ParseOptions = {}): Root {
  const source = preprocessObsidian(body);
  const processor = options.profile === 'index' ? indexProcessor : fullProcessor;
  const tree = processor.runSync(processor.parse(source)) as Root;
  if (source.includes('$$')) transformLatexBlocks(tree, source);
  transformObsidianSyntax(tree, source);
  return tree;
}
