import { useState, type HTMLAttributes, type ImgHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../shared/ui/Icon';
import { nodeText } from '../../shared/ui/node-text';
import { UnsupportedCard, unsupportedText } from '../../shared/ui/UnsupportedCard';

// Små komponenter for standard-HTML og enkle vr-*-elementer i notatinnhold.

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & { readonly children?: ReactNode };

function heading(Tag: 'h2' | 'h3') {
  function ContentHeading({ id, children, ...rest }: HeadingProps) {
    return (
      <Tag id={id} {...rest}>
        {children}
        {id ? (
          <Link
            className="heading-anchor"
            to={{ hash: `#${encodeURIComponent(id)}` }}
            aria-label={`Lenke til seksjonen «${nodeText(children).trim()}»`}
          >
            #
          </Link>
        ) : null}
      </Tag>
    );
  }
  return ContentHeading;
}

export const ContentH2 = heading('h2');
export const ContentH3 = heading('h3');

export function ContentTable(props: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabell">
      <table {...props} />
    </div>
  );
}

export function ContentInput(props: InputHTMLAttributes<HTMLInputElement>) {
  // Oppgavelister er skrivebeskyttet (B1).
  return <input {...props} readOnly disabled={props.type === 'checkbox' ? true : props.disabled} />;
}

export function ContentImage({ src, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  if (src && /^(https?:)?\/\//i.test(src)) {
    // B10/PO-13: eksterne bilder lastes ikke.
    return (
      <span className="img-placeholder">
        <Icon name="image" />
        <a className="external" href={src} target="_blank" rel="noopener noreferrer">
          Eksternt bilde{alt ? `: ${alt}` : ''}
        </a>
      </span>
    );
  }
  if (failed || !src) {
    return (
      <span className="img-placeholder" role="img" aria-label={alt ? `${alt} (finnes ikke)` : 'Bildet finnes ikke'}>
        <Icon name="image" />
        <span>Bildet finnes ikke</span>
        {alt ? <code>{alt}</code> : null}
      </span>
    );
  }
  return <img {...rest} src={src} alt={alt ?? ''} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

export function Sidenote({ 'data-number': n, children }: { readonly 'data-number'?: string; readonly children?: ReactNode }) {
  return (
    <span className="sidenote" role="note" aria-label={`Fotnote ${n ?? ''}`}>
      <span className="n">{n}</span>
      {children}
    </span>
  );
}

export function Footnotes({ children }: { readonly children?: ReactNode }) {
  return (
    <section className="footnotes" aria-label="Fotnoter">
      <span className="label">Fotnoter</span>
      {children}
    </section>
  );
}

interface UnsupportedProps {
  readonly 'data-kind'?: string;
  readonly 'data-source'?: string;
  readonly 'data-inline'?: string;
  readonly 'data-name'?: string;
}

export function Unsupported({ 'data-kind': kind = 'other', 'data-source': source, 'data-inline': inline, 'data-name': name }: UnsupportedProps) {
  // PO-13: inline-LaTeX står rått i teksten (et kort ville brutt avsnittet).
  if (inline === 'true') {
    return (
      <code className="latex-inline" title="LaTeX vises ikke her – formelen står som kildetekst.">
        {source}
      </code>
    );
  }
  const text = unsupportedText(kind);
  // QA-NS-01: plugin-blokker nevner tillegget ved navn.
  if (name && kind === 'other') {
    return <UnsupportedCard title={`Tillegget «${name}» vises ikke her.`} text="Blokken kjøres bare i Obsidian." source={source} />;
  }
  const detail = name && name !== kind ? `Blokken «${name}» kjøres bare i Obsidian.` : text.text;
  return <UnsupportedCard title={text.title} text={detail} source={source} />;
}
