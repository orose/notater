import './embed.css';
import { Children, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { VaultId } from '../../../shared/api-types';
import { docUrl } from '../../shared/api';
import { Icon } from '../../shared/ui/Icon';

interface EmbedProps {
  readonly vaultId: VaultId;
  readonly 'data-status'?: string;
  readonly 'data-target'?: string;
  readonly 'data-anchor'?: string;
  readonly 'data-title'?: string;
  readonly 'data-raw'?: string;
  /** Diskré embedding (F2): satt av disposisjonen (`buildOutline`), aldri av serveren. */
  readonly 'data-vr-discreet'?: string;
  readonly children?: ReactNode;
}

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;

/** Embed-målet uten syntaks: `![[x|200]]` → `x`, `![alt](<sti>)` → `sti`. */
function embedTargetText(raw: string): string {
  const wiki = /^!\[\[(.*)\]\]$/.exec(raw.trim());
  if (wiki) return (wiki[1] ?? '').split('|')[0]?.trim() ?? '';
  const md = /^!\[[^\]]*\]\((.*)\)$/.exec(raw.trim());
  if (md) return (md[1] ?? '').replace(/^<(.*)>$/, '$1').trim();
  return raw.trim();
}

function isEmpty(children: ReactNode): boolean {
  return Children.toArray(children).every((child) => typeof child === 'string' && child.trim() === '');
}

/** `vr-embed` (designsystem §7.6). Barna er ferdig rendret innhold fra målet. */
export function Embed(props: EmbedProps) {
  const status = props['data-status'] ?? 'missing';
  const target = props['data-target'];
  const anchor = props['data-anchor'];
  const title = props['data-title'] ?? target ?? props['data-raw'] ?? '';
  const link = target ? (
    <Link className="link wikilink" to={docUrl(props.vaultId, target, anchor)}>
      {title}
    </Link>
  ) : null;

  if (status === 'ok' && props['data-vr-discreet'] === 'true') {
    // Designsystem §11.4: ingen ramme/etikett/knapp; kildelenken er siste barn og vises ved hover/fokus.
    const label = anchor?.startsWith('^') ? `${title} ${anchor}` : title;
    return (
      <div className="embed is-diskret" data-vr-discreet="true">
        {props.children}
        {target ? (
          <Link className="embed-src" to={docUrl(props.vaultId, target, anchor)} aria-label={`Kilde: ${label}`}>
            <span className="src-k">fra</span>
            <span className="t">{label}</span>
          </Link>
        ) : null}
      </div>
    );
  }

  if (status === 'ok') {
    return (
      <section className="embed" aria-label={`Innebygd: ${title}`}>
        <header className="embed-head">
          <span className="label">Innebygd fra</span>
          {link}
          {target ? (
            <Link className="open" to={docUrl(props.vaultId, target)}>
              Åpne notat →
            </Link>
          ) : null}
        </header>
        <div className="embed-body">
          {isEmpty(props.children) ? <p className="embed-empty">Notatet er tomt.</p> : props.children}
        </div>
      </section>
    );
  }

  if (status === 'cycle') {
    return (
      <EmbedState title="Innbygging stoppet: syklus">
        {link ? <>Notatet {link} bygger inn seg selv. Det vises som lenke i stedet.</> : 'Notatet vises som lenke i stedet.'}
      </EmbedState>
    );
  }

  if (status === 'depth-limit') {
    return <EmbedState title="Innbygging stoppet: for mange nivåer">{link ? <>Åpne {link} for å lese videre.</> : null}</EmbedState>;
  }

  const missing = embedTargetText(props['data-raw'] ?? title);
  if (IMAGE.test(missing.split('#')[0] ?? '')) {
    return (
      <EmbedState label="Innebygd bilde" title={`Bildet finnes ikke: ${missing}`}>
        Sjekk filnavnet og at bildet ligger i vaultet.
      </EmbedState>
    );
  }
  return (
    <EmbedState title={`Fant ikke «${missing}»`}>
      Notatet eller seksjonen finnes ikke i vaultet. Når du oppretter det i Obsidian, dukker innholdet opp her.
    </EmbedState>
  );
}

/**
 * Feilkort for embeds (designsystem §11.4, PO-79): blokk-ikon, etiketten «Innebygd notat», fet tittel og én
 * setning. Identisk i rammet og diskré modus – kortet skal skille seg ut nettopp når resten glir inn.
 */
function EmbedState({ label = 'Innebygd notat', title, children }: { readonly label?: string; readonly title: string; readonly children?: ReactNode }) {
  return (
    <div className="mini-state embed-state" role="note">
      <Icon name="block" />
      <div>
        <span className="label">{label}</span>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}
