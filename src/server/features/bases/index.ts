/** bases: Bases-evaluering på serveren (ADR-003): uttrykksspråk, definisjon, spørring og port. */
export { createBaseEvaluator } from './base-evaluator';
export type { BaseEvaluator, BaseEvaluatorOptions, BaseVaultContext } from './base-evaluator';
export type { BaseRequest } from './base-request';
export { parseBaseDefinition } from './definition/parse-base';
export { parseExpression } from './expression/parser';
