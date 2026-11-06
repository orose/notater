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
import { useHiddenBlocks } from '../outline';
import { prepareContent } from './prepare-content';

interface HastContentProps {
  readonly vaultId: VaultId;
  readonly content: Root;
  readonly bases: Readonly<Record<string, BaseResult>>;
  /** Innholdet er allerede kjørt gjennom `prepareContent` (og `buildOutline`). */
  readonly prepared?: boolean;
}

type Props = Record<string, unknown> & { children?: ReactNode };

function createComponents(vaultId: VaultId, bases: Readonly<Record<string, BaseResult>>): Partial<Components> {
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
 * Én toppnivåblokk, memoisert på node-identitet (ADR-009 §5): en fold rendrer bare blokkene som endret seg
 * (AK17). En skjult blokk pakkes i `div[hidden]` (komponenter som kodeblokk og embed tar ikke `hidden`).
 */
const Block = memo(function Block({
  node,
  index,
  hidden,
  components,
}: {
  readonly node: RootContent;
  readonly index: number;
  readonly hidden: boolean;
  readonly components: Partial<Components>;
}) {
  const rendered = toJsxRuntime({ type: 'root', children: [node] }, { ...OPTIONS, components }) as ReactNode;
  if (!hidden) return rendered;
  return (
    <div hidden className="folded-block" data-folded-block={index}>
      {rendered}
    </div>
  );
});

/** Rendrer sanitert HAST fra serveren til React – aldri innerHTML (ADR-002). */
export const HastContent = memo(function HastContent({ vaultId, content, bases, prepared = false }: HastContentProps) {
  const ready = useMemo(() => (prepared ? content : prepareContent(content)), [content, prepared]);
  const components = useMemo(() => createComponents(vaultId, bases), [vaultId, bases]);
  const hidden = useHiddenBlocks();
  return (
    <>
      {ready.children.map((node, index) => (
        <Block key={index} node={node} index={index} hidden={hidden.has(index)} components={components} />
      ))}
    </>
  );
});
