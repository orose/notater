import type { DocPath, VaultId } from '../../../shared/api-types';

/** Nettleser-URL for et dokument: `/v/:vaultId/<DocPath>` med per-segment-enkoding (api.md). */
export function docUrl(vaultId: VaultId, docPath: DocPath, anchor?: string): string {
  const encoded = docPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const base = encoded ? `/v/${encodeURIComponent(vaultId)}/${encoded}` : `/v/${encodeURIComponent(vaultId)}`;
  return anchor ? `${base}#${encodeURIComponent(anchor)}` : base;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Inversen av `docUrl` (uten anker). */
export function docPathFromPathname(pathname: string, vaultId: VaultId): DocPath {
  const prefix = `/v/${encodeURIComponent(vaultId)}`;
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return rest
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(safeDecode)
    .join('/')
    .normalize('NFC');
}

export function assetUrl(vaultId: VaultId, docPath: DocPath): string {
  return `/api/vaults/${encodeURIComponent(vaultId)}/assets?path=${encodeURIComponent(docPath)}`;
}

export function folderOf(docPath: DocPath): string {
  const i = docPath.lastIndexOf('/');
  return i === -1 ? '' : docPath.slice(0, i);
}

export function baseName(docPath: DocPath): string {
  const i = docPath.lastIndexOf('/');
  return i === -1 ? docPath : docPath.slice(i + 1);
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

export function isImagePath(docPath: DocPath): boolean {
  return IMAGE_EXT.test(docPath);
}
