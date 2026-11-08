// Shiki-tema for vault-leseren. Alle farger er CSS-variabler, så ett tema dekker
// alle paletter × lys/mørk; bytte av tema krever ingen ny highlighting.
// Variablene er definert per palett i docs/design/tokens.css.
// Kompatibelt med Shikis innebygde `css-variables`-tema (samme --shiki-*-prefiks),
// men med finere scope-mapping og fire ekstra tokens: number, type, property, operator.
// Verifisert mot shiki@4.6.0 (java, json, bash, yaml).
import type { ThemeRegistration } from 'shiki';

const v = (n: string) => `var(--shiki-token-${n})`;

export const vaultLeserTema: ThemeRegistration = {
  name: 'vault-leser',
  type: 'light', // irrelevant: fargene kommer fra CSS-variabler
  colors: {
    'editor.foreground': 'var(--shiki-foreground)',
    'editor.background': 'var(--shiki-background)',
  },
  tokenColors: [
    { scope: ['variable', 'variable.other', 'meta.definition.variable'], settings: { foreground: 'var(--shiki-foreground)' } },
    { scope: ['comment', 'punctuation.definition.comment', 'string.comment'], settings: { foreground: v('comment'), fontStyle: 'italic' } },
    { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string', 'string.unquoted.plain'], settings: { foreground: v('string') } },
    { scope: ['constant.character.escape', 'string.regexp', 'punctuation.definition.template-expression', 'punctuation.section.embedded', 'variable.other.normal.shell', 'variable.parameter.positional.shell'], settings: { foreground: v('string-expression') } },
    { scope: ['constant.numeric'], settings: { foreground: v('number') } },
    { scope: ['constant.language', 'constant.other', 'variable.other.constant', 'variable.other.enummember', 'entity.name.constant', 'support.constant'], settings: { foreground: v('constant') } },
    { scope: ['keyword', 'storage', 'storage.modifier', 'storage.type.primitive', 'keyword.control', 'keyword.other', 'variable.language', 'storage.type.function'], settings: { foreground: v('keyword') } },
    { scope: ['keyword.operator', 'keyword.operator.assignment', 'keyword.operator.arrow', 'punctuation.separator.key-value'], settings: { foreground: v('operator') } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call.generic', 'entity.name.command', 'support.function.builtin.shell'], settings: { foreground: v('function') } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type', 'storage.type.java', 'storage.type.generic.java', 'storage.type.object.array.java', 'entity.other.inherited-class', 'storage.type.annotation', 'punctuation.definition.annotation'], settings: { foreground: v('type') } },
    { scope: ['variable.parameter', 'meta.parameter'], settings: { foreground: v('parameter') } },
    { scope: ['support.type.property-name', 'punctuation.support.type.property-name', 'meta.object-literal.key', 'entity.name.tag.yaml', 'entity.name.tag', 'variable.other.property'], settings: { foreground: v('property') } },
    { scope: ['punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator'], settings: { foreground: v('punctuation') } },
    { scope: ['markup.underline.link', 'string.other.link'], settings: { foreground: v('link') } },
    { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: v('keyword'), fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
  ],
};
