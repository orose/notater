// Disposisjonen (ADR-009): seksjoner, flyt og diskré embedding. Ren TS, delt av web og terminal (ADR-011 §1).
export {
  buildOutline,
  hiddenBlocks,
  type FlowBlock,
  type FlowHeading,
  type HeadingLevel,
  type Outline,
  type OutlineHeading,
  type SectionStats,
} from './build-outline';
