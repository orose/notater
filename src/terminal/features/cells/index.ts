/** cells: cellemodell, Unicode-bredde og diff til ANSI (ADR-011 §3–4). Ren TS. */
export { graphemeWidth, graphemes, textWidth, type CellWidth } from './cell-width';
export { DEFAULT_COLOR, PLAIN, blankCell, cellAt, createFrame, frameToLines, writeText, type Cell, type CellStyle, type Color, type Frame } from './frame';
export { renderFrame, rgbTo256, sameStyle, sgr, type ColorDepth, type RenderOptions } from './frame-diff';
