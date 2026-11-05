/**
 * Port for Bases-evaluering (ADR-003). Selve evaluatoren kommer i slice 3; inntil da returnerer
 * `createPendingBaseEvaluator` et tomt resultat med en advarsel, slik at klienten kan vise et kort.
 */
import type { BaseResult } from '../../../shared/api-types';
import type { LinkResolver } from '../links';
import type { VaultSnapshot } from '../vault-index';
import type { BaseRequest } from './base-request';

/** Det evaluatoren får se av vaultet (RecordSource i ADR-003 bygges av dette). */
export interface BaseVaultContext {
  readonly snapshot: VaultSnapshot;
  readonly links: LinkResolver;
}

export interface BaseEvaluator {
  evaluate(request: BaseRequest, vault: BaseVaultContext): BaseResult;
}

export const BASES_NOT_IMPLEMENTED_CODE = 'not-implemented';

export function createPendingBaseEvaluator(): BaseEvaluator {
  return {
    evaluate: () => ({
      views: [],
      warnings: [{ code: BASES_NOT_IMPLEMENTED_CODE, message: 'Visning av baser kommer i en senere leveranse.' }],
    }),
  };
}
