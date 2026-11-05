import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../shared/ui/Icon';

interface CodeBlockProps {
  readonly 'data-lang'?: string;
  readonly 'data-title'?: string;
  readonly 'data-code'?: string;
  readonly children?: ReactNode;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Reserve for eldre nettlesere / ikke-sikker kontekst.
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'absolute';
  area.style.left = '-9999px';
  document.body.append(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

/** `vr-code`: kodeblokk som figur (designsystem §5.2). Barna er Shikis ferdige `pre.shiki`. */
export function CodeBlock(props: CodeBlockProps) {
  const lang = props['data-lang'] ?? '';
  const title = props['data-title'];
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = async () => {
    try {
      await copyText(props['data-code'] ?? '');
      setAnnouncement('Kopiert til utklippstavlen');
    } catch {
      setAnnouncement('Kunne ikke kopiere');
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      setAnnouncement('');
    }, 1600);
  };

  const body = Children.map(props.children, (child) =>
    isValidElement<{ tabIndex?: number }>(child) && child.type === 'pre' ? cloneElement(child, { tabIndex: 0 }) : child,
  );

  return (
    <figure className="code" data-lang={lang || undefined}>
      <figcaption className="code-head">
        {title ? <span className="file">{title}</span> : null}
        {lang ? <span className="lang">{lang}</span> : null}
        <button
          type="button"
          className="copy"
          data-state={copied ? 'copied' : undefined}
          aria-label="Kopier kode"
          onClick={() => void onCopy()}
        >
          <Icon name="copy" />
          <span>{copied ? 'Kopiert' : 'Kopier'}</span>
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      </figcaption>
      {body}
    </figure>
  );
}
