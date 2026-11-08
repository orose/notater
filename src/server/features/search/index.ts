/** search: MiniSearch-indeks (tittel, aliaser, innhold) og taggsøk for ⌘K (AK13). */
export { buildSearchIndex, createSearchIndex, foldDiacritics } from './search-index';
export type { SearchDocument, SearchIndex } from './search-index';
export { createSearchRoutes, DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from './search-routes';
export type { SearchSource } from './search-routes';
