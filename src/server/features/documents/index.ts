/** documents: GET /document – setter sammen indeks, rendering, properties, backlinks og baser. */
export { ALWAYS_HIDDEN_PROPERTIES, countWords, getBacklinks, getDocument } from './document-service';
export type { DocumentOptions } from './document-service';
export { createDocumentsRoutes } from './documents-routes';
export type { DocumentSource, HiddenPropertiesLookup } from './documents-routes';
