/** Ren tolkning av innholdet mellom `[[` og `]]`. */

export interface WikiLinkParts {
  readonly target: string;
  readonly anchor: string | null;
  readonly alias: string | null;
}

export function parseWikiLinkInner(inner: string): WikiLinkParts {
  const pipe = inner.indexOf('|');
  const linkPart = pipe === -1 ? inner : inner.slice(0, pipe);
  const alias = pipe === -1 ? null : inner.slice(pipe + 1).trim();
  const hash = linkPart.indexOf('#');
  const target = (hash === -1 ? linkPart : linkPart.slice(0, hash)).trim();
  const anchor = hash === -1 ? null : linkPart.slice(hash + 1).trim() || null;
  return { target, anchor, alias: alias === '' ? null : alias };
}

/** `#H1#H2` → `H2` (Obsidian bruker siste ledd). */
export function lastAnchorSegment(anchor: string): string {
  const parts = anchor.split('#').filter((p) => p.trim() !== '');
  return (parts[parts.length - 1] ?? anchor).trim();
}

export interface ImageAlias {
  readonly alt: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

const SIZE = /^(\d+)(?:x(\d+))?$/;

/** `![[bilde.png|alt|300x200]]`: siste ledd kan være størrelse, resten er alt-tekst. */
export function parseImageAlias(alias: string | null): ImageAlias {
  if (alias === null) return { alt: null, width: null, height: null };
  const parts = alias.split('|').map((p) => p.trim());
  const size = SIZE.exec(parts[parts.length - 1] ?? '');
  if (!size) return { alt: alias.trim() || null, width: null, height: null };
  const alt = parts.slice(0, -1).join('|').trim();
  return {
    alt: alt === '' ? null : alt,
    width: Number(size[1]),
    height: size[2] === undefined ? null : Number(size[2]),
  };
}
