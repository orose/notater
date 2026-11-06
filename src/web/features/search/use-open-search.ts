import { useContext } from 'react';
import { SearchContext, type OpenSearch, type SearchContextValue } from './search-context';

const noop: OpenSearch = () => {};

/** Åpner paletten i søkemodus (valgfritt med forhåndsutfylt spørring, f.eks. `#tag`). */
export function useOpenSearch(): OpenSearch {
  return useContext(SearchContext)?.openSearch ?? noop;
}

const NOOP_CONTEXT: SearchContextValue = { openSearch: noop, openCommands: noop, setCommandSource: () => {} };

/** Hele palett-API-et (`openSearch`, `openCommands`, `setCommandSource`). Brukes av `commands`. */
export function usePalette(): SearchContextValue {
  return useContext(SearchContext) ?? NOOP_CONTEXT;
}
