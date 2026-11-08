// Tynn mock av API-kontrakten (src/shared/api-types.ts) for visuelle UI-tester mens serveren er under
// arbeid. Innholdet speiler designprototypens notat (docs/design/prototype.html), slik at skjermbilder
// kan sammenlignes direkte med docs/design/skjermbilder/.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Element, ElementContent, Properties, Root } from 'hast';
import type { Page, Route } from '@playwright/test';
import { codeToHast } from 'shiki';
import { vaultLeserTema } from '../../docs/design/shiki-tema';
import type {
  BaseResult,
  DocumentResponse,
  NoteDocument,
  SearchResponse,
  TreeFolder,
  TreeNode,
  VaultsResponse,
} from '../../src/shared/api-types';

type Child = ElementContent | string;
function h(tagName: string, properties: Properties = {}, ...children: Child[]): Element {
  return {
    type: 'element',
    tagName,
    properties,
    children: children.map((c) => (typeof c === 'string' ? { type: 'text', value: c } : c)),
  };
}
const link = (target: string, text: string, anchor?: string) =>
  h('a', { href: `/v/test/${target.split('/').map(encodeURIComponent).join('/')}${anchor ? `#${anchor}` : ''}`, dataVrLink: 'internal', dataVrTarget: target, ...(anchor ? { dataVrAnchor: anchor } : {}) }, text);
const broken = (raw: string, text: string, suggest?: [string, string]) =>
  h('a', { dataVrLink: 'unresolved', dataVrRaw: raw, ...(suggest ? { dataVrSuggest: suggest[0], dataVrSuggestTitle: suggest[1] } : {}) }, text);
const code = (t: string) => h('code', {}, t);

async function codeBlock(lang: string, source: string, title?: string): Promise<Element> {
  const tree = (await codeToHast(source, { lang, theme: vaultLeserTema })) as Root;
  const pre = tree.children.find((c): c is Element => c.type === 'element' && c.tagName === 'pre') as Element;
  pre.properties.className = ['shiki', 'vault-leser'];
  pre.properties.tabIndex = undefined;
  return h('vr-code', { dataLang: lang, dataCode: source, ...(title ? { dataTitle: title } : {}) }, pre);
}

function callout(type: string, fold: string, title: string, ...body: Child[]): Element {
  return h('vr-callout', { dataCalloutType: type, dataFold: fold }, h('vr-callout-title', {}, title), h('vr-callout-body', {}, ...body));
}

function footnoteRef(n: number) {
  return h('sup', {}, h('a', { href: `#user-content-fn-${n}`, id: `user-content-fnref-${n}`, dataFootnoteRef: true }, String(n)));
}

const JAVA = `public final class OrdreProdusent implements AutoCloseable {

    private static final Logger logg = LoggerFactory.getLogger(OrdreProdusent.class);
    private final KafkaProducer<String, String> producer;

    public OrdreProdusent(String bootstrap) {
        var props = new Properties();
        props.put(BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        props.put(ENABLE_IDEMPOTENCE_CONFIG, true);
        props.put(ACKS_CONFIG, "all");
        props.put(MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        var ser = new StringSerializer();
        this.producer = new KafkaProducer<>(props, ser, ser);
    }

    public void publiser(Ordre ordre) {
        var rec = new ProducerRecord<>("ordre.v1", ordre.id(), ordre.tilJson());
        producer.send(rec, (meta, ex) -> {
            if (ex != null) logg.error("Sending feilet for {}", ordre.id(), ex);
        });
    }

    @Override
    public void close() { producer.close(); }
}`;

const JSON_SRC = `{
  "ordreId": "ORD-2026-00417",
  "type": "OrdreOpprettet",
  "tidspunkt": "2026-11-03T13:58:12.481Z",
  "kunde": { "id": 81234, "segment": "bedrift" },
  "betalt": true,
  "kampanje": null
}`;

const MERMAID = `%% caption: Retry uten idempotens gir to kopier i partisjonen.
flowchart LR
  P[Produsent<br/>PID 9001] -->|1 send| L[Partisjonsleder<br/>ordre.v1 / p3]
  L -.->|2 ack tapt| P
  P -->|3 retry| L
  L --> O41[offset 41<br/>seq 7]
  L --> O42[offset 42<br/>seq 7 · duplikat]`;

const baseResult: BaseResult = {
  warnings: [{ code: 'unknown-key', message: '1 ukjent nøkkel ignorert: cardSize', source: 'cardSize' }],
  views: [
    {
      type: 'table',
      name: 'Huskeliste',
      columns: [
        { id: 'file.name', label: 'file.name', width: 420 },
        { id: 'note.status', label: 'status' },
        { id: 'note.due', label: 'due' },
      ],
      grouped: true,
      indentProperties: false,
      totalRows: 5,
      warnings: [],
      groups: [
        {
          key: { type: 'string', value: 'Mine oppgaver' },
          label: 'Mine oppgaver',
          rows: [
            ['Slå på idempotens i ordre-tjenesten', 'doing', '2026-11-08'],
            ['Måle duplikatrate før/etter', 'todo', '2026-11-14'],
            ['Skrive ADR om transaksjoner', 'todo', null],
          ].map(([n, s, d]) => ({
            path: `oppgaver/${n}`,
            cells: {
              'file.name': { type: 'string', value: n as string },
              'note.status': { type: 'string', value: s as string },
              'note.due': d ? { type: 'date', value: d, hasTime: false } : { type: 'null' },
            },
          })),
        },
        {
          key: { type: 'string', value: 'Testgjengen' },
          label: 'Testgjengen',
          rows: [
            ['Kaostest: drep broker under last', 'doing', '2026-11-10'],
            ['Verifisere OutOfOrderSequence-logging', 'todo', '2026-11-21'],
          ].map(([n, s, d]) => ({
            path: `oppgaver/${n}`,
            cells: {
              'file.name': { type: 'string', value: n as string },
              'note.status': { type: 'string', value: s as string },
              'note.due': { type: 'date', value: d as string, hasTime: false },
            },
          })),
        },
      ],
    },
    {
      type: 'kanban',
      name: 'Kanban',
      groupBy: 'note.status',
      columns: [
        { id: 'file.name', label: 'file.name' },
        { id: 'file.tags', label: 'file.tags' },
      ],
      totalRows: 6,
      warnings: [],
      groups: (
        [
          ['todo', ['Måle duplikatrate før/etter', 'Skrive ADR om transaksjoner']],
          ['doing', ['Slå på idempotens i ordre-tjenesten', 'Kaostest: drep broker under last']],
          ['done', ['Oppgradere klient til 3.7']],
          [null, ['Lese KIP-939']],
        ] as const
      ).map(([key, names]) => ({
        key: key ? { type: 'string', value: key } : null,
        label: key ?? '(ingen)',
        rows: names.map((n) => ({
          path: `oppgaver/${n}`,
          cells: {
            'file.name': { type: 'string', value: n },
            'file.tags': { type: 'list', value: [{ type: 'tag', value: 'task' }, { type: 'tag', value: 'kafka' }] },
          },
        })),
      })),
    },
    { type: 'unsupported', name: 'Galleri', originalType: 'cards', warnings: [] },
  ],
};

async function kafkaNote(): Promise<NoteDocument> {
  const content: Root = {
    type: 'root',
    children: [
      h(
        'p',
        {},
        'Nettverk svikter på de mest ubeleilige tidspunktene. En produsent som sender en melding, men aldri får kvittering, har bare ett fornuftig valg: å prøve igjen. Uten ekstra tiltak betyr det at samme hendelse kan havne to ganger i loggen.',
        footnoteRef(1),
        ' Idempotent produsent er Kafkas svar på nettopp det – og den er slått på som standard.',
      ),
      h('h2', { id: 'problemet' }, 'Problemet: duplikater ved retry'),
      h('p', {}, 'Tenk deg at produsenten sender en batch til partisjonslederen. Brokeren skriver batchen til loggen, men svaret går tapt på vei tilbake. Produsenten får tidsavbrudd, sender batchen på nytt – og konsumentene ser nå ordren ', code('ORD-2026-00417'), ' to ganger.'),
      h('vr-mermaid', { dataSource: MERMAID }),
      h('p', {}, 'For en betalingshendelse er det mildt sagt uheldig. Det vanlige mottiltaket er å gjøre konsumentene idempotente, gjerne med ', broken('Outbox-mønster', 'outbox og dedup-tabell'), '. Det er fortsatt lurt, men Kafka kan ta en god del av jobben selv.'),
      h('h2', { id: 'slik-virker-det' }, 'Slik virker det'),
      h('p', {}, 'Når idempotens er slått på, får produsenten en ', h('em', {}, 'producer id'), ' (PID) fra brokeren ved oppstart. Hver batch merkes med PID og et sekvensnummer per partisjon. Brokeren husker de fem siste batchene per PID og partisjon,', footnoteRef(2), ' og avviser to ting:'),
      h('ul', {}, h('li', {}, h('strong', {}, 'Duplikater'), ' – samme sekvensnummer en gang til. Brokeren svarer «ok» uten å skrive batchen på nytt.'), h('li', {}, h('strong', {}, 'Hull'), ' – et sekvensnummer som hopper over ett. Da får produsenten ', code('OutOfOrderSequenceException'), '.')),
      callout('note', 'none', 'Standard siden Kafka 3.0', h('p', {}, code('enable.idempotence=true'), ' og ', code('acks=all'), ' er standard fra og med Kafka 3.0. Eldre klienter må konfigureres eksplisitt – og en eksplisitt ', code('acks=1'), ' slår idempotensen av uten advarsel.')),
      h('h3', { id: 'konfigurasjon' }, 'Konfigurasjon'),
      h('p', {}, 'I Java-klienten holder det i praksis å være eksplisitt om tre innstillinger, slik at ingen ved et uhell overstyrer dem i en felles konfigurasjon:'),
      await codeBlock('java', JAVA, 'OrdreProdusent.java'),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Innstilling'), h('th', {}, 'Krav'), h('th', {}, 'Standard ≥ 3.0'), h('th', {}, 'Merknad'))), h('tbody', {},
        h('tr', {}, h('td', {}, code('enable.idempotence')), h('td', {}, 'true'), h('td', {}, 'true'), h('td', {}, 'PID og sekvensnumre')),
        h('tr', {}, h('td', {}, code('acks')), h('td', {}, 'all'), h('td', {}, 'all'), h('td', {}, 'Alle ISR må bekrefte')),
        h('tr', {}, h('td', {}, code('max.in.flight.requests.per.connection')), h('td', {}, '≤ 5'), h('td', { align: 'right' }, '5'), h('td', {}, 'Brokeren husker fem batcher')),
      )),
      h('h3', { id: 'hendelsen' }, 'Hendelsen på tråden'),
      h('p', {}, 'Meldingsverdien er vanlig JSON. Legg merke til at ', code('ordreId'), ' også brukes som nøkkel, slik at alle hendelser for samme ordre havner i samme partisjon.'),
      await codeBlock('json', JSON_SRC, 'ordre.v1 · eksempel'),
      h('h2', { id: 'hvor-garantien-slutter' }, 'Hvor garantien slutter'),
      callout('warning', 'open', 'Idempotens er ikke exactly-once', h('p', {}, 'Garantien gjelder innenfor én produsentsesjon og én partisjon. Restarter applikasjonen, får den ny PID. For å overleve restart trenger du ', code('transactional.id'), '; se ', link('domene/kafka/Kafka-transaksjoner', 'zombie-fencing', 'zombie-fencing'), '.')),
      h('p', {}, 'Det samme gjelder atomisk skriving til flere partisjoner eller topics. Der er transaksjoner riktig verktøy. Begrepene er definert slik:'),
      h('vr-embed', { dataStatus: 'ok', dataTarget: 'domene/kafka/Leveransegarantier', dataAnchor: 'definisjoner', dataTitle: 'Leveransegarantier › Definisjoner' },
        h('ul', {}, h('li', {}, h('strong', {}, 'At-most-once'), ' – leveres null eller én gang. Ingen retry.'), h('li', {}, h('strong', {}, 'At-least-once'), ' – leveres minst én gang. Duplikater må håndteres.'), h('li', {}, h('strong', {}, 'Exactly-once'), ' – effekten skjer én gang.'))),
      callout('tip', 'closed', 'Tommelfingerregel', h('p', {}, 'La idempotens stå på overalt.')),
      h('blockquote', {}, h('p', {}, 'Exactly-once er ikke en egenskap ved én komponent, men ved hele kjeden.')),
      h('p', {}, 'Se også ', broken('Bestilling', 'Bestilling', ['domene/Ordre', 'Ordre']), ', ', h('a', { href: 'https://kafka.apache.org', dataVrLink: 'external' }, 'Kafka-dokumentasjonen'), ' og ', h('a', { dataVrLink: 'tag', dataVrTag: 'kafka' }, '#kafka'), '. Inline ', h('mark', {}, 'markering'), ' og ', h('kbd', {}, '⌘K'), '.'),
      h('h2', { id: 'oppgaver' }, 'Relaterte oppgaver'),
      h('vr-base', { dataBaseId: 'b1', dataSourcePath: 'Oppgaver.base' }),
      h('vr-unsupported', { dataKind: 'dataview', dataSource: 'TABLE status, due FROM #kafka AND #task\nSORT due ASC' }),
      h('section', { dataFootnotes: true, className: ['footnotes'] }, h('h2', { id: 'footnote-label', className: ['sr-only'] }, 'Footnotes'), h('ol', {},
        h('li', { id: 'user-content-fn-1' }, h('p', {}, 'Dette er klassisk ', h('em', {}, 'at-least-once'), '-levering. Se ', link('domene/kafka/Leveransegarantier', 'Leveransegarantier'), ' for hele bildet. ', h('a', { href: '#user-content-fnref-1', dataFootnoteBackref: '' }, '↩'))),
        h('li', { id: 'user-content-fn-2' }, h('p', {}, 'Derfor må ', code('max.in.flight.requests.per.connection'), ' være fem eller lavere. ', h('a', { href: '#user-content-fnref-2', dataFootnoteBackref: '' }, '↩'))),
      )),
    ],
  };
  return {
    kind: 'note',
    vaultId: 'test',
    revision: 1,
    path: 'domene/kafka/Idempotent produsent',
    filePath: 'domene/kafka/Idempotent produsent.md',
    title: 'Idempotent produsent i Kafka',
    mtime: '2026-11-03T13:02:00.000Z',
    ctime: '2026-10-01T09:00:00.000Z',
    aliases: ['idempotens', 'enable.idempotence'],
    tags: ['kafka', 'java', 'leveransegaranti', 'arkitektur/meldinger'],
    properties: [
      { key: 'description', value: { type: 'string', value: 'Hvordan brokeren luker ut duplikater når produsenten prøver på nytt – og hvor garantien slutter.' } },
      { key: 'type', value: { type: 'string', value: 'konsept' } },
      { key: 'status', value: { type: 'string', value: 'aktiv' } },
      { key: 'kilde', value: { type: 'string', value: 'https://cwiki.apache.org/KIP-98' } },
      { key: 'relatert', value: { type: 'link', target: 'domene/kafka/Kafka-transaksjoner', display: 'Kafka-transaksjoner' } },
      { key: 'eier', value: { type: 'null' } },
      { key: 'tags', value: { type: 'list', value: [{ type: 'tag', value: 'kafka' }] } },
    ],
    content,
    toc: [
      { depth: 2, text: 'Problemet: duplikater ved retry', id: 'problemet' },
      { depth: 2, text: 'Slik virker det', id: 'slik-virker-det' },
      { depth: 3, text: 'Konfigurasjon', id: 'konfigurasjon' },
      { depth: 3, text: 'Hendelsen på tråden', id: 'hendelsen' },
      { depth: 2, text: 'Hvor garantien slutter', id: 'hvor-garantien-slutter' },
      { depth: 2, text: 'Relaterte oppgaver', id: 'oppgaver' },
    ],
    bases: { b1: baseResult },
    backlinks: [
      { source: 'domene/kafka/Kafka-transaksjoner', sourceTitle: 'Kafka-transaksjoner', snippet: '…bygger videre på idempotent produsent og legger til transactional.id, som overlever omstart…', count: 1 },
      { source: 'arkitektur/tjenester/Ordre-tjenesten', sourceTitle: 'Ordre-tjenesten', snippet: '…publiserer alle hendelser med idempotens slått på; se ADR-014 for begrunnelsen…', count: 1 },
      { source: 'arkitektur/adr/ADR-014 Meldingslevering', sourceTitle: 'ADR-014 Meldingslevering', snippet: '…vi velger idempotent produsent kombinert med idempotente konsumenter…', count: 2 },
    ],
  };
}

function readTree(dir: string, rootDir: string): TreeFolder {
  const children: TreeNode[] = [];
  const entries = readdirSync(dir).filter((n) => !n.startsWith('.')).sort((a, b) => a.localeCompare(b, 'nb', { sensitivity: 'base' }));
  const folders = entries.filter((n) => statSync(join(dir, n)).isDirectory());
  const files = entries.filter((n) => !statSync(join(dir, n)).isDirectory());
  for (const f of folders) children.push(readTree(join(dir, f), rootDir));
  for (const f of files) {
    const rel = relative(rootDir, join(dir, f)).split('\\').join('/').normalize('NFC');
    if (f.endsWith('.md') && !f.endsWith('.excalidraw.md')) children.push({ kind: 'note', name: f.slice(0, -3).normalize('NFC'), path: rel.slice(0, -3) });
    else if (f.endsWith('.base')) children.push({ kind: 'base', name: f, path: rel });
    else if (/\.(png|svg|jpe?g)$/i.test(f)) children.push({ kind: 'asset', name: f, path: rel });
    else children.push({ kind: 'unsupported', name: f, path: rel });
  }
  const rel = relative(rootDir, dir).split('\\').join('/');
  return { kind: 'folder', name: rel.split('/').pop() ?? '', path: rel, children };
}

export async function installMockApi(page: Page): Promise<void> {
  const note = await kafkaNote();
  const root = readTree(join(process.cwd(), 'test-vault'), join(process.cwd(), 'test-vault'));
  // Legg prototypens notat inn i treet.
  const domene = root.children.find((c): c is TreeFolder => c.kind === 'folder' && c.name === 'domene');
  (domene?.children as TreeNode[] | undefined)?.unshift({
    kind: 'folder',
    name: 'kafka',
    path: 'domene/kafka',
    children: [
      { kind: 'note', name: 'Idempotent produsent', path: note.path },
      { kind: 'note', name: 'Kafka-transaksjoner', path: 'domene/kafka/Kafka-transaksjoner' },
      { kind: 'note', name: 'Leveransegarantier', path: 'domene/kafka/Leveransegarantier' },
    ],
  });
  const vaults: VaultsResponse = {
    defaultVaultId: 'test',
    vaults: [
      { id: 'test', name: 'Arbeid', status: 'ready', noteCount: 2041, revision: 1 },
      { id: 'privat', name: 'Privat', status: 'ready', noteCount: 312, revision: 1 },
      { id: 'arkiv', name: 'Arkiv', status: 'not-indexed', noteCount: null, revision: null },
    ],
  };
  const docs: Record<string, DocumentResponse> = { [note.path]: note };

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/vaults') return json(vaults);
    if (url.pathname === '/api/events') {
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: ready\ndata: {"vaultId":"test","revision":1}\n\n' });
    }
    if (url.pathname.endsWith('/tree')) return json({ vaultId: 'test', revision: 1, root });
    if (url.pathname.endsWith('/tags')) {
      return json({ vaultId: 'test', tags: [['kafka', 27], ['java', 403], ['arkitektur', 188], ['adr', 41], ['task', 57], ['bash', 88], ['spring', 96]].map(([tag, count]) => ({ tag, count })) });
    }
    if (url.pathname.endsWith('/search')) {
      const q = url.searchParams.get('q') ?? '';
      const body: SearchResponse = {
        query: q,
        revision: 1,
        hits: [
          { path: note.path, title: 'Idempotent produsent i Kafka', kind: 'note', matchedField: 'title', score: 9 },
          { path: 'domene/kafka/Kafka-transaksjoner', title: 'Kafka-transaksjoner', kind: 'note', matchedField: 'alias', alias: 'exactly-once', score: 6 },
          { path: 'arkitektur/adr/ADR-014 Meldingslevering', title: 'ADR-014 Meldingslevering', kind: 'note', matchedField: 'content', snippet: { text: '…vi velger idempotent produsent kombinert med idempotente konsumenter…', highlights: [[11, 21]] }, score: 3 },
        ],
      };
      return json(body);
    }
    if (url.pathname.endsWith('/document')) {
      const doc = docs[url.searchParams.get('path') ?? ''];
      return doc ? json(doc) : json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Fant ikke dokumentet' } }, 404);
    }
    return json({ error: { code: 'BAD_REQUEST', message: 'Ukjent' } }, 400);
  });
}

export const MOCK_NOTE_URL = '/v/test/domene/kafka/Idempotent%20produsent';
