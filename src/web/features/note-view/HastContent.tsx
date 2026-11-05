import type { Root } from 'hast';
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
  ContentH2,
  ContentH3,
  ContentImage,
  ContentInput,
  ContentTable,
  Footnotes,
  Sidenote,
  Unsupported,
} from './content-elements';
import { prepareContent } from './prepare-content';

interface HastContentProps {
  readonly vaultId: VaultId;
  readonly content: Root;
  readonly bases: Readonly<Record<string, BaseResult>>;
}

type Props = Record<string, unknown> & { children?: ReactNode };

function createComponents(vaultId: VaultId, bases: Readonly<Record<string, BaseResult>>): Partial<Components> {
  const custom: Record<string, (props: Props) => ReactNode> = {
    a: (props) => <ContentLink vaultId={vaultId} {...props} />,
    h2: ContentH2,
    h3: ContentH3,
    table: ContentTable,
    img: ContentImage,
    input: ContentInput,
    'vr-callout': Callout,
    'vr-callout-title': CalloutTitle,
    'vr-callout-body': CalloutBody,
    'vr-code': CodeBlock,
    'vr-mermaid': MermaidDiagram,
    'vr-embed': (props) => <Embed vaultId={vaultId} {...props} />,
    'vr-unsupported': Unsupported,
    'vr-sidenote': Sidenote,
    'vr-footnotes': Footnotes,
    'vr-base': (props) => {
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

/** Rendrer sanitert HAST fra serveren til React – aldri innerHTML (ADR-002). */
export const HastContent = memo(function HastContent({ vaultId, content, bases }: HastContentProps) {
  const prepared = useMemo(() => prepareContent(content), [content]);
  const components = useMemo(() => createComponents(vaultId, bases), [vaultId, bases]);
  return toJsxRuntime(prepared, {
    Fragment,
    jsx,
    jsxs,
    components,
    passKeys: true,
    ignoreInvalidStyle: true,
    elementAttributeNameCase: 'react',
    stylePropertyNameCase: 'dom',
  }) as ReactNode;
});
