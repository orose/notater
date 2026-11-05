import type { MermaidConfig } from 'mermaid';

// Mermaid lastes lat (A10) – først når et notat faktisk har et diagram.
type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((module) => module.default);
  return mermaidPromise;
}

/**
 * Rendrer ett diagram til SVG-tekst. Kallene serialiseres fordi Mermaid har global tilstand
 * (initialize + midlertidige DOM-noder).
 */
export function renderMermaid(source: string, config: MermaidConfig): Promise<string> {
  const run = async () => {
    const mermaid = await loadMermaid();
    mermaid.initialize(config);
    const id = `vr-mermaid-${++counter}`;
    try {
      await mermaid.parse(source);
      const { svg } = await mermaid.render(id, source);
      return svg;
    } finally {
      // Mermaid kan etterlate feil-SVG-er i <body> ved syntaksfeil (QA-MER-03).
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}
