import type { Root, RootContent } from 'hast';
import { toJsxRuntime, type Components } from 'hast-util-to-jsx-runtime';
import { memo, useMemo, type ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { BaseResult, VaultId } from '../../../shared/api-types';
import { BaseBlock } from '../bases';
import { Callout, CalloutBody, CalloutTitle } from '../callout';
import { CodeBlock } from '../code-block';
import { Embed } from '../embed';
import { MermaidDiagram } from '../mermaid';
import { ContentLink } from './ContentLink';
import {
  ContentH1,
  ContentH2,
  ContentH3,
  ContentH4,
  ContentH5,
  ContentH6,
  ContentImage,
  ContentInput,
  ContentTable,
  Footnotes,
  Sidenote,
  Unsupported,
} from './content-elements';
import { useFoldedContent } from '../outline';
import { prepareContent } from './prepare-content';

/** Komponenter for HAST-elementer; overstyringer flettes over standard-mappingen (ADR-010 §6, AR-2-23). */
export type ContentComponents = Partial<Components>;
export type ComponentOverrides = (defaults: ContentComponents) => ContentComponents;

interface HastContentProps {
  readonly vaultId: VaultId;
  readonly content: Root;
  readonly bases: Readonly<Record<string, BaseResult>>;
  /** Innholdet er allerede kjørt gjennom `prepareContent` (og `buildOutline`). */
  readonly prepared?: boolean;
  /** Valgfrie overstyringer (presentasjonen: overskrifter, sidenoter, fotnotereferanser, Mermaid i måling). */
  readonly components?: ComponentOverrides;
}

type Props = Record<string, unknown> & { children?: ReactNode };

function createComponents(vaultId: VaultId, bases: Readonly<Record<string, BaseResult>>): ContentComponents {
  const custom: Record<string, (props: never) => ReactNode> = {
    a: (props: Props) => <ContentLink vaultId={vaultId} {...props} />,
    h1: ContentH1,
    h2: ContentH2,
    h3: ContentH3,
    h4: ContentH4,
    h5: ContentH5,
    h6: ContentH6,
    table: ContentTable,
    img: ContentImage,
    input: ContentInput,
    'vr-callout': Callout,
    'vr-callout-title': CalloutTitle,
    'vr-callout-body': CalloutBody,
    'vr-code': CodeBlock,
    'vr-mermaid': MermaidDiagram,
    'vr-embed': (props: Props) => <Embed vaultId={vaultId} {...props} />,
    'vr-unsupported': Unsupported,
    'vr-sidenote': Sidenote,
    'vr-footnotes': Footnotes,
    'vr-base': (props: Props) => {
      const id = String(props['data-base-id'] ?? '');
      const source = props['data-source-path'];
      const view = props['data-view'];
      return (
        <BaseBlock
          vaultId={vaultId}
          result={bases[id]}
          sourcePath={typeof source === 'string' ? source : undefined}
          viewName={typeof view === 'string' ? view : undefined}
        />
      );
    },
  };
  // vr-*-tagger finnes ikke i JSX.IntrinsicElements; derfor en eksplisitt typekonvertering.
  return custom as unknown as Partial<Components>;
}

const OPTIONS = {
  Fragment,
  jsx,
  jsxs,
  passKeys: true,
  ignoreInvalidStyle: true,
  elementAttributeNameCase: 'react',
  stylePropertyNameCase: 'dom',
} as const;

/**
 * Én toppnivåblokk, memoisert på node-identitet (ADR-009 §5): en fold gir nye noder bare langs stiene som
 * endret seg, så bare de blokkene rendres på nytt (AK17).
 */
export const HastBlock = memo(function HastBlock({ node, components }: { readonly node: RootContent; readonly components: ContentComponents }) {
  return toJsxRuntime({ type: 'root', children: [node] }, { ...OPTIONS, components }) as ReactNode;
});
const Block = HastBlock;

/** Komponent-mappingen for et vault og dokumentets baser, med valgfrie overstyringer. Stabil så lenge inndata er det. */
export function useContentComponents(vaultId: VaultId, bases: Readonly<Record<string, BaseResult>>, overrides?: ComponentOverrides): ContentComponents {
  return useMemo(() => {
    const defaults = createComponents(vaultId, bases);
    return overrides ? { ...defaults, ...overrides(defaults) } : defaults;
  }, [vaultId, bases, overrides]);
}

/** Rendrer sanitert HAST fra serveren til React – aldri innerHTML (ADR-002). */
export const HastContent = memo(function HastContent({ vaultId, content, bases, prepared = false, components: overrides }: HastContentProps) {
  const ready = useMemo(() => (prepared ? content : prepareContent(content)), [content, prepared]);
  const components = useContentComponents(vaultId, bases, overrides);
  const shown = useFoldedContent(ready);
  return (
    <>
      {shown.children.map((node, index) => (
        <Block key={index} node={node} components={components} />
      ))}
    </>
  );
});
