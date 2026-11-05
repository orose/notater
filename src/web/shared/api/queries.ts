import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  DocPath,
  DocumentResponse,
  SearchResponse,
  TreeResponse,
  VaultId,
  VaultsResponse,
} from '../../../shared/api-types';
import { ApiRequestError, apiGet } from './client';
import { queryKeys } from './query-keys';

const v = (vaultId: VaultId) => encodeURIComponent(vaultId);

export function useVaults() {
  return useQuery({
    queryKey: queryKeys.vaults(),
    queryFn: ({ signal }) => apiGet<VaultsResponse>('/api/vaults', signal),
    staleTime: 30_000,
  });
}

export function useTree(vaultId: VaultId) {
  return useQuery({
    queryKey: queryKeys.tree(vaultId),
    queryFn: ({ signal }) => apiGet<TreeResponse>(`/api/vaults/${v(vaultId)}/tree`, signal),
    staleTime: Infinity, // invalideres av live reload (SSE)
  });
}

export function useDocument(vaultId: VaultId, docPath: DocPath, enabled = true) {
  return useQuery({
    queryKey: queryKeys.document(vaultId, docPath),
    queryFn: ({ signal }) =>
      apiGet<DocumentResponse>(`/api/vaults/${v(vaultId)}/document?path=${encodeURIComponent(docPath)}`, signal),
    enabled: enabled && docPath.length > 0,
    staleTime: Infinity,
    // Vis forrige notat til det nye er klart (designsystem §9: ingen skeleton).
    placeholderData: keepPreviousData,
    retry: (count, error) => !(error instanceof ApiRequestError && error.status < 500) && count < 2,
  });
}

export function useSearch(vaultId: VaultId, query: string, limit = 20) {
  const q = query.trim();
  return useQuery({
    queryKey: queryKeys.search(vaultId, `${q}|${limit}`),
    queryFn: ({ signal }) =>
      apiGet<SearchResponse>(
        `/api/vaults/${v(vaultId)}/search?q=${encodeURIComponent(q)}&limit=${limit}`,
        signal,
      ),
    enabled: q.length > 0,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

/**
 * FORSLAG (ikke i kontrakten ennå): `GET /api/vaults/:vaultId/tags` → `TagsResponse`.
 * Brukes til taggseksjonen i sidepanelet. Svarer serveren 404, skjules seksjonen.
 */
export interface TagCount {
  readonly tag: string;
  readonly count: number;
}
export interface TagsResponse {
  readonly vaultId: VaultId;
  readonly tags: readonly TagCount[];
}

export function useTags(vaultId: VaultId) {
  return useQuery({
    queryKey: queryKeys.tags(vaultId),
    queryFn: ({ signal }) => apiGet<TagsResponse>(`/api/vaults/${v(vaultId)}/tags`, signal),
    staleTime: Infinity,
    retry: false,
  });
}
