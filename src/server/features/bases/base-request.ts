import type { FilePath } from '../../../shared/api-types';

/** En base som skal evalueres. Produseres av rendering (embeds/```base) og dokument-API-et. */
export type BaseRequest =
  | { readonly kind: 'file'; readonly filePath: FilePath; readonly view: string | null }
  | { readonly kind: 'inline'; readonly source: string; readonly hostFilePath: FilePath };
