import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Embed } from './Embed';

function wrap(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('Embed', () => {
  it('viser innebygd innhold med kilde og «Åpne notat»', () => {
    wrap(
      <Embed vaultId="test" data-status="ok" data-target="teknisk/Kafka/Kafka-grunnleggende" data-anchor="partisjoner" data-title="Kafka-grunnleggende › Partisjoner">
        <p>Innhold fra kilden</p>
      </Embed>,
    );
    const region = screen.getByRole('region', { name: 'Innebygd: Kafka-grunnleggende › Partisjoner' });
    expect(region).toHaveClass('embed');
    expect(screen.getByText('Innhold fra kilden')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kafka-grunnleggende › Partisjoner' })).toHaveAttribute(
      'href',
      '/v/test/teknisk/Kafka/Kafka-grunnleggende#partisjoner',
    );
    expect(screen.getByRole('link', { name: 'Åpne notat →' })).toHaveAttribute('href', '/v/test/teknisk/Kafka/Kafka-grunnleggende');
  });

  it('viser «Notatet er tomt» for tom embed (QA-EMB-11)', () => {
    wrap(<Embed vaultId="test" data-status="ok" data-target="edge/Tomt notat" data-title="Tomt notat" />);
    expect(screen.getByText('Notatet er tomt.')).toBeInTheDocument();
  });

  it('manglende mål gir diskret kort', () => {
    wrap(<Embed vaultId="test" data-status="missing" data-raw="Finnes ikke" />);
    expect(screen.getByText('Fant ikke «Finnes ikke»')).toBeInTheDocument();
    expect(document.querySelector('.mini-state')).not.toBeNull();
  });

  it('viser embed-målet uten ![[ ]]-syntaks (QA-EMB-08)', () => {
    wrap(<Embed vaultId="test" data-status="missing" data-raw="![[Kafka-grunnleggende#Seksjon som ikke finnes]]" />);
    expect(screen.getByText('Fant ikke «Kafka-grunnleggende#Seksjon som ikke finnes»')).toBeInTheDocument();
  });

  it('manglende bilde sier «Bildet finnes ikke» (QA-IMG-10)', () => {
    wrap(
      <>
        <Embed vaultId="test" data-status="missing" data-raw="![[mangler.png]]" />
        <Embed vaultId="test" data-status="missing" data-raw="![Mangler](../attachments/mangler.png)" />
      </>,
    );
    expect(screen.getByText('Bildet finnes ikke: mangler.png')).toBeInTheDocument();
    expect(screen.getByText('Bildet finnes ikke: ../attachments/mangler.png')).toBeInTheDocument();
  });

  it('syklus stoppes med kort og lenke', () => {
    wrap(<Embed vaultId="test" data-status="cycle" data-target="lenker/Syklus A" data-title="Syklus A" />);
    expect(screen.getByText('Innbygging stoppet: syklus')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Syklus A' })).toHaveAttribute('href', '/v/test/lenker/Syklus%20A');
  });

  it('dybdegrense stoppes med kort', () => {
    wrap(<Embed vaultId="test" data-status="depth-limit" data-target="lenker/Kjede 3" data-title="Kjede 3" />);
    expect(screen.getByText('Innbygging stoppet: for mange nivåer')).toBeInTheDocument();
  });
});
