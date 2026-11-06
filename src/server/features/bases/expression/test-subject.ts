/** Testhjelper: håndlaget `FileSubject`/`EvalContext` uten vault (kun brukt av *.test.ts). */
import type { EvalContext } from './context';
import type { FileSubject, LinkValue, Value } from './values';

export interface FakeFile {
  readonly path: string;
  readonly tags?: readonly string[];
  readonly props?: Readonly<Record<string, Value>>;
  readonly links?: readonly string[];
  readonly size?: number;
  readonly mtimeMs?: number;
  readonly ctimeMs?: number;
}

export function fakeSubject(spec: FakeFile): FileSubject {
  const slash = spec.path.lastIndexOf('/');
  const fullName = spec.path.slice(slash + 1);
  const dot = fullName.lastIndexOf('.');
  const ext = dot > 0 ? fullName.slice(dot + 1).toLowerCase() : '';
  const props = spec.props ?? {};
  return {
    filePath: spec.path,
    docPath: ext === 'md' ? spec.path.slice(0, -3) : spec.path,
    name: dot > 0 ? fullName.slice(0, dot) : fullName,
    fullName,
    ext,
    folder: slash === -1 ? '/' : spec.path.slice(0, slash),
    size: spec.size ?? 100,
    mtimeMs: spec.mtimeMs ?? Date.UTC(2026, 10, 1, 12),
    ctimeMs: spec.ctimeMs ?? Date.UTC(2026, 0, 1),
    tags: () => spec.tags ?? [],
    links: () => (spec.links ?? []).map((l) => fakeLink(l)),
    property: (key) => props[key] ?? null,
    propertyKeys: () => Object.keys(props),
  };
}

/** Lenker løses ved å legge på `.md`; «Finnes ikke» er brutt. */
export function fakeLink(text: string): LinkValue {
  const target = text.replace(/^\[\[|\]\]$/g, '');
  if (target === 'Finnes ikke') return { kind: 'link', filePath: null, docPath: null, display: target };
  const filePath = target.includes('.') ? target : `${target}.md`;
  return { kind: 'link', filePath, docPath: filePath.replace(/\.md$/, ''), display: target };
}

export function fakeContext(file: FileSubject, formulas: Readonly<Record<string, Value>> = {}, nowMs = Date.UTC(2026, 10, 5, 13, 30)): EvalContext {
  return {
    file,
    thisFile: null,
    formula: (name) => formulas[name] ?? null,
    resolveLink: (text) => fakeLink(text),
    nowMs: () => nowMs,
  };
}
