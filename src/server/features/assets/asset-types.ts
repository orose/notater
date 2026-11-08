/** Hviteliste for vedlegg som kan serveres (api.md: kun bilder i v1). */
const IMAGE_MIME_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

/** MIME-type for en hvitelistet bildeendelse (uten punktum, små bokstaver), ellers `null`. */
export function imageMimeType(ext: string): string | null {
  return IMAGE_MIME_TYPES[ext.toLowerCase()] ?? null;
}

export function isImageExtension(ext: string): boolean {
  return imageMimeType(ext) !== null;
}
