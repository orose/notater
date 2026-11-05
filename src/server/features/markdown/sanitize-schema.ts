import { defaultSchema } from 'rehype-sanitize';
import type { Options as Schema } from 'rehype-sanitize';

/**
 * Sikkerhetsgrensen (ADR-002): GitHub-skjemaet, utvidet med det minimum våre markdown-steg trenger
 * FØR sanering. Alle egne `vr-*`-elementer og alle `data-vr-link`-attributter legges på ETTER
 * sanering, så de er ikke tillatt her (forfalskning fra rå HTML fjernes).
 *
 * - `data-vr-ref` (kun på span/div): plassholder for pålitelige noder; verdien må inneholde
 *   per-render-nonce for å bli ekspandert, ellers fjernes elementet.
 * - `data-vr-heading-id` / `data-vr-block-id`: valideres og gjøres om til `id` etter sanering.
 * - `data-task`: egendefinert oppgavestatus på `li`.
 * - `mark` for `==markering==`.
 * - `style` og `script` strippes helt (innholdet vises heller ikke som tekst).
 */
export function createSanitizeSchema(): Schema {
  const attributes = defaultSchema.attributes ?? {};
  return {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), 'mark'],
    strip: [...(defaultSchema.strip ?? []), 'style', 'script', 'template', 'noscript', 'textarea', 'title'],
    attributes: {
      ...attributes,
      span: [...(attributes.span ?? []), 'dataVrRef'],
      div: [...(attributes.div ?? []), 'dataVrRef'],
      li: [...(attributes.li ?? []), 'dataTask'],
      '*': [...(attributes['*'] ?? []), 'dataVrHeadingId', 'dataVrBlockId'],
    },
  };
}
