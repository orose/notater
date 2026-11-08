/**
 * Port og implementasjon for Bases-evaluering (ADR-003). Resultater caches per snapshot (WeakMap):
 * en endring i vaultet gir et nytt snapshot og dermed nye resultater (live reload, AK12).
 */
import type { BaseResult } from '../../../shared/api-types';
import type { LinkResolver } from '../links';
import type { VaultSnapshot } from '../vault-index';
import type { BaseRequest } from './base-request';
import { parseBaseDefinition } from './definition/parse-base';
import type { ParsedBase } from './definition/base-definition';
import { runBase } from './query/run-base';
import type { RecordSource } from './query/record-source';
import { createVaultRecordSource } from './vault-record-source';

/** Det evaluatoren får se av vaultet (RecordSource i ADR-003 bygges av dette). */
export interface BaseVaultContext {
  readonly snapshot: VaultSnapshot;
  readonly links: LinkResolver;
}

export interface BaseEvaluator {
  evaluate(request: BaseRequest, vault: BaseVaultContext): BaseResult;
}

export interface BaseEvaluatorOptions {
  /** Klokke for `now()`/`today()` (injiseres i tester). */
  readonly now?: () => number;
}

const MAX_CACHED_DEFINITIONS = 100;

export function createBaseEvaluator(options: BaseEvaluatorOptions = {}): BaseEvaluator {
  const now = options.now ?? Date.now;
  const sources = new WeakMap<VaultSnapshot, RecordSource>();
  const results = new WeakMap<VaultSnapshot, Map<string, BaseResult>>();
  const definitions = new Map<string, ParsedBase>();

  const definitionFor = (source: string): ParsedBase => {
    let parsed = definitions.get(source);
    if (!parsed) {
      parsed = parseBaseDefinition(source);
      if (definitions.size >= MAX_CACHED_DEFINITIONS) definitions.delete(definitions.keys().next().value!);
      definitions.set(source, parsed);
    }
    return parsed;
  };

  const recordsFor = (vault: BaseVaultContext): RecordSource => {
    let source = sources.get(vault.snapshot);
    if (!source) {
      source = createVaultRecordSource(vault.snapshot, vault.links);
      sources.set(vault.snapshot, source);
    }
    return source;
  };

  return {
    evaluate(request, vault) {
      const text = request.kind === 'file' ? vault.snapshot.baseSources.get(request.filePath) : request.source;
      if (text === undefined) {
        return { views: [], warnings: [{ code: 'missing-base', message: 'Base-fila finnes ikke i vaultet.', source: request.kind === 'file' ? request.filePath : undefined }] };
      }
      const cacheKey = request.kind === 'file' ? `file\u0000${request.filePath}\u0000${request.view ?? ''}` : `inline\u0000${request.hostFilePath}\u0000${text}`;
      let cache = results.get(vault.snapshot);
      const cached = cache?.get(cacheKey);
      if (cached) return cached;

      const parsed = definitionFor(text);
      if (!parsed.ok) return { views: [], warnings: [parsed.error] };
      const records = recordsFor(vault);
      const thisFile = records.record(request.kind === 'file' ? request.filePath : request.hostFilePath);
      const { result, usesClock } = runBase(parsed.definition, records, {
        view: request.kind === 'file' ? request.view : null,
        thisFile,
        nowMs: now(),
      });
      if (!usesClock) {
        if (!cache) {
          cache = new Map();
          results.set(vault.snapshot, cache);
        }
        cache.set(cacheKey, result);
      }
      return result;
    },
  };
}
