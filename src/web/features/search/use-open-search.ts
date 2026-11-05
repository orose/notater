import { useContext } from 'react';
import { SearchContext, type OpenSearch } from './search-context';

const noop: OpenSearch = () => {};

/** Åpner ⌘K-paletten (valgfritt med forhåndsutfylt spørring, f.eks. `#tag`). */
export function useOpenSearch(): OpenSearch {
  return useContext(SearchContext) ?? noop;
}
