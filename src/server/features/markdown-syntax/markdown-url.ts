const EXTERNAL_URL = /^[a-z][a-z0-9+.-]*:/i;

/** Intern markdown-lenke → sti + anker (URL-dekodet). `null` for eksterne og rene `#anker`. */
export function parseMarkdownUrl(url: string): { target: string; anchor: string | null } | null {
  if (url === '' || url.startsWith('#') || EXTERNAL_URL.test(url) || url.startsWith('//')) return null;
  const hash = url.indexOf('#');
  const rawPath = hash === -1 ? url : url.slice(0, hash);
  const rawAnchor = hash === -1 ? null : url.slice(hash + 1);
  return { target: safeDecode(rawPath), anchor: rawAnchor ? safeDecode(rawAnchor) : null };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** http(s)/mailto eller annen URL med skjema. */
export function isExternalUrl(url: string): boolean {
  return EXTERNAL_URL.test(url) || url.startsWith('//');
}
