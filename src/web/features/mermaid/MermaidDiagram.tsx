import './mermaid.css';
import { useEffect, useState } from 'react';
import { Icon } from '../../shared/ui/Icon';
import { UnsupportedCard } from '../../shared/ui/UnsupportedCard';
import { useTheme } from '../theme';
import { ZoomDialog } from './ZoomDialog';
import { mermaidCaption, mermaidConfig } from './mermaid-config';
import { renderMermaid } from './mermaid-loader';

interface MermaidDiagramProps {
  readonly 'data-source'?: string;
}

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'ok'; readonly svg: string }
  | { readonly status: 'error'; readonly message: string };

/** `vr-mermaid` (designsystem §6, AK15). */
export function MermaidDiagram(props: MermaidDiagramProps) {
  const source = props['data-source'] ?? '';
  const caption = mermaidCaption(source);
  const { preferences, resolvedMode } = useTheme();
  const themeKey = `${preferences.type}/${preferences.palette}/${resolvedMode}`;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderMermaid(source, mermaidConfig()).then(
      (svg) => {
        if (!cancelled) setState({ status: 'ok', svg });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, themeKey]);

  if (state.status === 'error') {
    return (
      <UnsupportedCard
        title="Diagrammet kunne ikke tegnes."
        text={<span className="mermaid-error">{state.message}</span>}
        source={source}
      />
    );
  }

  const label = caption ?? 'Diagram';

  return (
    <figure className="diagram">
      <div className="diagram-frame" data-state={state.status}>
        {state.status === 'ok' ? (
          // SVG-en er generert av Mermaid med securityLevel 'strict' (DOMPurify internt).
          <div className="diagram-svg" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: state.svg }} />
        ) : (
          <div className="diagram-loading" aria-hidden="true" />
        )}
      </div>
      <figcaption>
        {caption ? <span>{caption}</span> : <span className="sr-only">Diagram</span>}
        <button
          type="button"
          className="icon-btn zoom"
          disabled={state.status !== 'ok'}
          onClick={() => setZoomOpen(true)}
        >
          <Icon name="expand" />
          Forstørr
        </button>
      </figcaption>
      {state.status === 'ok' ? (
        <ZoomDialog open={zoomOpen} onClose={() => setZoomOpen(false)} svg={state.svg} label={label} />
      ) : null}
    </figure>
  );
}
