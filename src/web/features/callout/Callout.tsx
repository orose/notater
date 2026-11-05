import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Icon } from '../../shared/ui/Icon';
import { nodeText } from '../../shared/ui/node-text';
import { CalloutBody } from './CalloutBody';
import { CalloutTitle } from './CalloutTitle';
import { resolveCallout } from './callout-types';

interface CalloutProps {
  readonly 'data-callout-type'?: string;
  readonly 'data-fold'?: string;
  readonly children?: ReactNode;
}

function hasContent(node: ReactNode): boolean {
  let found = false;
  Children.forEach(node, (child) => {
    if (found) return;
    if (typeof child === 'string') found = child.trim().length > 0;
    else if (child !== null && child !== undefined && typeof child !== 'boolean') found = true;
  });
  return found;
}

/** `vr-callout` (designsystem §7.7). Foldbare callouts bruker <details>/<summary>. */
export function Callout(props: CalloutProps) {
  const resolved = resolveCallout(props['data-callout-type'] ?? 'note');
  const fold = props['data-fold'] ?? 'none';
  const [open, setOpen] = useState(fold !== 'closed');

  let title: ReactNode = null;
  let body: ReactNode = null;
  Children.forEach(props.children, (child) => {
    if (isValidElement<{ children?: ReactNode }>(child)) {
      if (child.type === CalloutTitle) title = child.props.children;
      else if (child.type === CalloutBody) body = hasContent(child.props.children) ? child : null;
    }
  });

  const titleText = nodeText(title).trim();
  const showSub = titleText.length > 0 && !resolved.defaultTitles.includes(titleText);

  const head = (
    <>
      <Icon name={resolved.icon} />
      <span className="callout-name">{resolved.label}</span>
      {showSub ? <span className="callout-sub">{title}</span> : null}
    </>
  );

  if (fold === 'open' || fold === 'closed') {
    return (
      <details
        className="callout"
        data-callout={resolved.type}
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          {head}
          <Icon name="chev" className="chev" />
        </summary>
        {body}
      </details>
    );
  }

  return (
    <div className="callout" data-callout={resolved.type}>
      <div className="callout-title">{head}</div>
      {body}
    </div>
  );
}
