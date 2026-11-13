/** draw: HAST → rader med roller (inline, reflow, lister, sitat, callout, kode, tabell, Bases, plassholdere). */
export { layoutCode, codeLines, type CodeLayout } from './code';
export { BREAK, imageName, inlineRuns, obsidianUrl, superscript, wrapRuns, type InlineContext } from './inline';
export { layoutBlocks, layoutNode, mermaidDetail, placeholder, type BlockContext } from './blocks';
export { EMPTY_ROW, createCanvas, paintRows, rowOf, rowText, runsText, runsWidth, shiftRows, type Canvas, type Row, type Run, type Seg } from './rows';
export { layoutTable, type Align, type TableModel } from './table';
