#!/usr/bin/env node
// Genererer et stort, syntetisk Obsidian-vault for ytelsestest (AK17).
//
// Ren Node 22, ingen avhengigheter. Deterministisk: samme --seed gir byte-identisk vault.
//
// Bruk:
//   node test-vault-tools/generate-large-vault.mjs [utmappe] [--count 2000] [--seed 42] [--force] [--allow-in-repo]
//   node test-vault-tools/generate-large-vault.mjs --out /tmp/vault-2000 --count 2000
//
// Standard utmappe: <os.tmpdir()>/vault-ytelse-<count>  (utenfor repoet).
//
// --force         Overskriv en mappe som tidligere er generert av dette scriptet
//                 (gjenkjennes på .generator-manifest.json). Andre mapper røres aldri.
// --allow-in-repo Tillat utmappe inne i dette git-repoet (standard: nekt).
//
// Innhold per vault (omtrentlig, for count=2000):
//   - ~30 mapper, opptil 5 nivåer dype, inkl. domene/, oppgaver/, templates/
//   - Snitt ~7 utgående wikilinks per notat, «preferential attachment» (noen knutepunkter med hundrevis av tilbakelenker)
//   - ~2 % brutte lenker, lenker til overskrift/blokk/alias, noen embeds (inkl. et par sykluser)
//   - Kodeblokker (java/kotlin/sql/yaml/json/bash/ts), mermaid (~8 %), callouts, tabeller, tagger
//   - ~15 % oppgavenotater med status/priority/due, slik at Oppgaver.base får tunge data
//   - Domene.base og Oppgaver.base identiske med docs/produkt/bases-eksempler.md
//   - Noen svært lange notater (TOC) og en håndfull med ugyldig frontmatter
//   - .obsidian/ og .trash/ som skal ignoreres av indeksen
//
// Etter kjøring skrives en oppsummering til stdout og til <utmappe>/.generator-manifest.json.

import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync, utimesSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const MANIFEST = '.generator-manifest.json';

// ---------- Argumenter ----------
const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', short: 'o' },
    count: { type: 'string', short: 'n', default: '2000' },
    seed: { type: 'string', short: 's', default: '42' },
    force: { type: 'boolean', default: false },
    'allow-in-repo': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (opts.help) {
  console.log(`Bruk: node generate-large-vault.mjs [utmappe] [--count N] [--seed S] [--force] [--allow-in-repo]`);
  process.exit(0);
}

const COUNT = Number.parseInt(opts.count, 10);
const SEED = Number.parseInt(opts.seed, 10);
if (!Number.isInteger(COUNT) || COUNT < 50) fail('--count må være et heltall >= 50');
if (!Number.isInteger(SEED)) fail('--seed må være et heltall');

const OUT = resolve(opts.out ?? positionals[0] ?? join(tmpdir(), `vault-ytelse-${COUNT}`));
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`Feil: ${msg}`);
  process.exit(1);
}

function erInni(barn, forelder) {
  const rel = relative(forelder, barn);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

if (erInni(OUT, REPO) && !opts['allow-in-repo']) {
  fail(`utmappen ${OUT} ligger inne i repoet. Velg en mappe utenfor, eller bruk --allow-in-repo.`);
}
if (existsSync(OUT) && readdirSync(OUT).length > 0) {
  if (!existsSync(join(OUT, MANIFEST))) {
    fail(`${OUT} finnes og er ikke tom, og er ikke generert av dette scriptet. Avbryter for sikkerhets skyld.`);
  }
  if (!opts.force) fail(`${OUT} finnes allerede. Bruk --force for å generere på nytt.`);
  rmSync(OUT, { recursive: true, force: true });
}

// ---------- Deterministisk PRNG (mulberry32) ----------
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const pickMany = (arr, n) => {
  const kopi = [...arr];
  const ut = [];
  while (ut.length < n && kopi.length) ut.push(kopi.splice(Math.floor(rnd() * kopi.length), 1)[0]);
  return ut;
};

// ---------- Ordforråd ----------
const EMNER = [
  'Kafka', 'Spring Boot', 'Postgres', 'Kubernetes', 'Java', 'Kotlin', 'Flyway', 'Testcontainers', 'Grafana',
  'Prometheus', 'OpenTelemetry', 'Redis', 'Elasticsearch', 'Docker', 'Helm', 'Terraform', 'GitHub Actions',
  'Maven', 'Gradle', 'JUnit', 'Mockito', 'Resilience4j', 'Keycloak', 'OAuth2', 'gRPC', 'REST', 'GraphQL',
  'Avro', 'JSON Schema', 'Outbox', 'Saga', 'CQRS', 'Event sourcing', 'Hexagonal arkitektur', 'DDD',
  'Virtuelle tråder', 'Records', 'Sealed interfaces', 'Streams', 'CompletableFuture', 'JPA', 'Hibernate',
  'JDBC', 'Connection pool', 'Indekser', 'Transaksjoner', 'Isolasjonsnivå', 'Låsing', 'Caching', 'Ratelimiting',
];
const SUFFIKS = [
  'i praksis', 'feilsøking', 'beste praksis', 'oppsett', 'konfigurasjon', 'notater', 'fallgruver', 'ytelse',
  'migrering', 'sjekkliste', 'designvalg', 'eksempler', 'sikkerhet', 'overvåking', 'testing', 'grunnleggende',
];
const DOMENEORD = [
  'Kunde', 'Ordre', 'Ordrelinje', 'Betaling', 'Refusjon', 'Faktura', 'Kreditnota', 'Lager', 'Lagerlokasjon',
  'Reservasjon', 'Produkt', 'Variant', 'Pris', 'Kampanje', 'Rabattkode', 'Handlekurv', 'Frakt', 'Sending',
  'Retur', 'Leverandør', 'Innkjøp', 'Avtale', 'Adresse', 'Ærend', 'Øyeblikksbilde', 'Åpningstid', 'Kategori',
  'Anmeldelse', 'Ønskeliste', 'Abonnement',
];
const STATUSER = ['todo', 'todo', 'todo', 'doing', 'doing', 'done', 'done', 'done', 'blocked'];
const SPRAAK = ['java', 'kotlin', 'sql', 'yaml', 'json', 'bash', 'typescript', 'xml', 'diff'];
const CALLOUTS = ['note', 'tip', 'warning', 'info', 'danger', 'example', 'question', 'bug', 'success', 'quote'];
const TAGGER = ['java', 'kafka', 'spring', 'sql', 'arkitektur', 'drift', 'sikkerhet', 'test', 'ytelse', 'læring',
  'java/spring', 'kafka/streams', 'arkitektur/adr', 'drift/k8s'];
const SETNINGER = [
  'Rekkefølge garanteres bare innenfor én partisjon, så nøkkelvalget er en arkitekturbeslutning.',
  'Transaksjonsgrensen bør ligge i applikasjonslaget, ikke i repository-laget.',
  'Vi måler før vi optimaliserer, og vi måler i produksjonslignende miljø.',
  'Idempotente konsumenter gjør det trygt å levere meldinger minst én gang.',
  'Konfigurasjon hører hjemme i miljøet, ikke i koden.',
  'En god logglinje svarer på hva, hvorfor og for hvem – uten personopplysninger.',
  'Testcontainers gir realistiske integrasjonstester uten delte testmiljøer.',
  'Skjemaendringer skal være bakoverkompatible i minst én release.',
  'Virtuelle tråder gjør blokkerende kode billig, men løser ikke låsekonflikter.',
  'Indekser er ikke gratis: hver skriving betaler for dem.',
  'Feilmeldinger til brukeren skal være forståelige, feilmeldinger i loggen skal være presise.',
  'Hold domenemodellen fri for rammeverksannotasjoner der det er mulig.',
  'Når noe er vanskelig å teste, er det ofte et tegn på for tett kobling.',
  'Dokumentér beslutningen og alternativene som ble forkastet.',
  'Et dashboard uten eier blir fort et museum.',
];

// ---------- Mappestruktur ----------
const MAPPER = [
  'domene', 'domene/delt', 'domene/hendelser', 'oppgaver', 'oppgaver/backend', 'oppgaver/frontend', 'templates',
  'teknisk/java', 'teknisk/kotlin', 'teknisk/kafka', 'teknisk/spring', 'teknisk/sql', 'teknisk/drift',
  'teknisk/drift/kubernetes', 'teknisk/drift/kubernetes/helm', 'arkitektur', 'arkitektur/adr', 'møter/2025',
  'møter/2026', 'prosjekter/2026/q3', 'prosjekter/2026/q4/backend/sprint-11', 'prosjekter/2026/q4/backend/sprint-12',
  'læring', 'læring/bøker', 'snippets', 'inbox', 'arkiv/2023', 'arkiv/2024', 'personer', 'domene-arkiv',
];

// ---------- Planlegg notater ----------
const brukteNavn = new Map(); // navn (lowercase) -> antall (for bevisste duplikater)
function unikt(navn, mappe) {
  const n = navn.replace(/[\\/:*?"<>|#^[\]]/g, '-');
  const nøkkel = `${mappe}/${n}`.toLowerCase();
  if (!brukteNavn.has(nøkkel)) {
    brukteNavn.set(nøkkel, 1);
    return n;
  }
  const k = brukteNavn.get(nøkkel) + 1;
  brukteNavn.set(nøkkel, k);
  return `${n} ${k}`;
}

const notater = []; // { mappe, navn, type, aliases, tags, fm, overskrifter, blokker }
const antallDomene = Math.max(20, Math.round(COUNT * 0.08));
const antallOppgaver = Math.max(20, Math.round(COUNT * 0.15));
const antallMøter = Math.round(COUNT * 0.08);

for (let i = 0; i < antallDomene; i++) {
  const ord = DOMENEORD[i % DOMENEORD.length];
  const erTopic = i % 5 === 4;
  const mappe = erTopic ? 'domene/hendelser' : i % 7 === 3 ? 'domene/delt' : 'domene';
  const navn = erTopic ? unikt(`${ord.toLowerCase()}-${pick(['opprettet', 'endret', 'slettet', 'mottatt'])}`, mappe)
    : unikt(i < DOMENEORD.length ? ord : `${ord} ${pick(['v2', 'policy', 'regler', 'livssyklus', 'modell'])}`, mappe);
  notater.push({ mappe, navn, type: erTopic ? 'topic' : 'domene', tags: erTopic ? ['kafka-topic'] : ['domene'] });
}
notater.push({ mappe: 'domene', navn: '_MOC', type: 'moc', tags: ['moc'] });

for (let i = 0; i < antallOppgaver; i++) {
  const mappe = pick(['oppgaver', 'oppgaver', 'oppgaver/backend', 'oppgaver/frontend', 'prosjekter/2026/q4/backend/sprint-12', 'prosjekter/2026/q4/backend/sprint-11']);
  const verb = pick(['Fiks', 'Undersøk', 'Implementer', 'Dokumenter', 'Refaktorer', 'Oppgrader', 'Test', 'Migrer', 'Rydd i', 'Evaluer']);
  const navn = unikt(`${verb} ${pick(EMNER).toLowerCase()} ${pick(['for', 'i', 'rundt'])} ${pick(DOMENEORD).toLowerCase()}`, mappe);
  const tags = [chance(0.2) ? 'task/backend' : 'task'];
  if (chance(0.35)) tags.push('team');
  const fm = {};
  if (!chance(0.05)) fm.status = pick(STATUSER);
  if (!chance(0.07)) fm.priority = int(1, chance(0.05) ? 10 : 4);
  if (!chance(0.1)) fm.due = `2026-${String(int(9, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`;
  notater.push({ mappe, navn, type: 'oppgave', tags, fm, inlineTask: chance(0.3) });
}
notater.push({ mappe: 'templates', navn: 'Oppgave-mal', type: 'mal', tags: ['task'], fm: { status: 'todo' } });

for (let i = 0; i < antallMøter; i++) {
  const år = i % 2 ? '2025' : '2026';
  const mnd = String(int(1, 12)).padStart(2, '0');
  const dag = String(int(1, 28)).padStart(2, '0');
  const mappe = `møter/${år}`;
  notater.push({ mappe, navn: unikt(`${år}-${mnd}-${dag} ${pick(['Arkitekturmøte', 'Sprintplanlegging', 'Retro', 'Driftsgjennomgang', 'Demo'])}`, mappe), type: 'møte', tags: ['møte'] });
}

const antallDuplikater = Math.max(3, Math.round(COUNT / 400));
let adrNr = 1;
while (notater.length < COUNT - antallDuplikater) {
  const r = rnd();
  if (r < 0.04) {
    const mappe = 'arkitektur/adr';
    notater.push({ mappe, navn: unikt(`ADR-${String(adrNr++).padStart(3, '0')} ${pick(EMNER)}`, mappe), type: 'adr', tags: ['arkitektur/adr'] });
  } else if (r < 0.06) {
    const mappe = 'personer';
    notater.push({ mappe, navn: unikt(`${pick(['Kari', 'Ola', 'Ingrid', 'Jonas', 'Åse', 'Ørjan', 'Æsa', 'Nils', 'Sofie', 'Emil'])} ${pick(['Nordmann', 'Hansen', 'Bakke', 'Øvrebø', 'Ås', 'Lie', 'Berg'])}`, mappe), type: 'person', tags: ['person'] });
  } else {
    const emne = pick(EMNER);
    const mappe = pick(MAPPER.filter((m) => !m.startsWith('domene') && !m.startsWith('oppgaver') && m !== 'templates' && !m.startsWith('møter')));
    notater.push({ mappe, navn: unikt(`${emne} – ${pick(SUFFIKS)}`, mappe), type: 'teknisk', tags: pickMany(TAGGER, int(0, 3)) });
  }
}

// Bevisste duplikatnavn i ulike mapper (tvetydige lenker)
for (let i = 0; i < antallDuplikater; i++) {
  const orig = notater[i];
  notater.push({ mappe: pick(['arkiv/2023', 'arkiv/2024']), navn: orig.navn, type: 'teknisk', tags: ['arkiv'] });
}

// Aliaser, overskrifter og blokk-ID-er
for (const n of notater) {
  n.aliases = chance(0.12) ? [`${n.navn.split(' ')[0]} ${pick(['(alias)', 'kortnavn', 'alt'])}`.replace(/[()]/g, '')] : [];
  const antallSeksjoner = n.type === 'teknisk' && chance(0.03) ? int(25, 40) : int(1, 6);
  n.overskrifter = Array.from({ length: antallSeksjoner }, (_, k) => `${pick(['Bakgrunn', 'Oppsett', 'Eksempel', 'Fallgruver', 'Ytelse', 'Feilsøking', 'Referanser', 'Detaljer', 'Status', 'Beslutning'])} ${k + 1}`);
  n.blokker = chance(0.3) ? [`b${int(1000, 9999)}`] : [];
  n.innlenker = 0;
}

// ---------- Lenkegraf (preferential attachment) ----------
const vekter = notater.map((n) => (n.type === 'moc' ? 50 : n.type === 'domene' ? 6 : 1));
function velgMål(fra) {
  // Rulett med vekter = basisvekt + innlenker (gir noen knutepunkter)
  let total = 0;
  for (let i = 0; i < notater.length; i++) total += vekter[i] + notater[i].innlenker * 0.5;
  let x = rnd() * total;
  for (let i = 0; i < notater.length; i++) {
    x -= vekter[i] + notater[i].innlenker * 0.5;
    if (x <= 0) return i === fra ? (i + 1) % notater.length : i;
  }
  return notater.length - 1;
}

const sti = (n) => `${n.mappe}/${n.navn}.md`;
let antallLenker = 0;
let antallBrutte = 0;
let antallEmbeds = 0;

function lagLenke(fraIdx) {
  antallLenker++;
  if (chance(0.02)) {
    antallBrutte++;
    return `[[${pick(['Finnes ikke', 'Gammelt notat', 'TODO skriv dette', 'Slettet side'])} ${int(1, 999)}]]`;
  }
  const mål = notater[velgMål(fraIdx)];
  mål.innlenker++;
  const r = rnd();
  if (r < 0.55) return `[[${mål.navn}]]`;
  if (r < 0.7) return `[[${mål.navn}|${pick(['her', 'dette notatet', mål.navn.toLowerCase(), 'se også'])}]]`;
  if (r < 0.82) return `[[${mål.navn}#${pick(mål.overskrifter)}]]`;
  if (r < 0.87 && mål.blokker.length) return `[[${mål.navn}#^${mål.blokker[0]}]]`;
  if (r < 0.93) return `[[${mål.mappe}/${mål.navn}]]`;
  if (mål.aliases.length) return `[[${mål.aliases[0]}]]`;
  return `[[${mål.navn.toLowerCase()}]]`; // case-avvik
}

// ---------- Innholdsbyggere ----------
function kodeblokk(språk) {
  switch (språk) {
    case 'java':
      return `\`\`\`java
@Service
public class ${pick(DOMENEORD).replace(/[ÆØÅæøå]/g, 'X')}Service {
    private final ${pick(['OrdreRepository', 'KundeRepository', 'LagerRepository'])} repo;

    @Transactional
    public void behandle(UUID id) {
        var entitet = repo.findById(id).orElseThrow();
        entitet.oppdater(Instant.now());
        log.info("Behandlet {}", id);
    }
}
\`\`\``;
    case 'kotlin':
      return `\`\`\`kotlin
fun beregn(linjer: List<Linje>): BigDecimal =
    linjer.sumOf { it.pris * it.antall.toBigDecimal() }
\`\`\``;
    case 'sql':
      return `\`\`\`sql
SELECT status, count(*) AS antall
FROM ${pick(['ordre', 'betaling', 'faktura', 'lager'])}
WHERE opprettet > now() - interval '${int(1, 30)} days'
GROUP BY status
ORDER BY antall DESC;
\`\`\``;
    case 'yaml':
      return `\`\`\`yaml
spring:
  kafka:
    consumer:
      group-id: ${pick(['ordre', 'lager', 'betaling'])}-service
      max-poll-records: ${int(50, 500)}
\`\`\``;
    case 'json':
      return `\`\`\`json
{ "id": "${int(100000, 999999)}", "status": "${pick(STATUSER)}", "linjer": [${int(1, 9)}] }
\`\`\``;
    case 'bash':
      return `\`\`\`bash
kubectl -n ${pick(['handel', 'lager', 'plattform'])} rollout restart deploy/${pick(['ordre', 'lager', 'betaling'])}-service
kubectl -n handel logs -l app=ordre-service --since=10m | grep -i error
\`\`\``;
    case 'typescript':
      return `\`\`\`typescript
export const hent = async (id: string): Promise<Ordre> => {
  const svar = await fetch(\`/api/ordre/\${id}\`);
  if (!svar.ok) throw new Error(\`HTTP \${svar.status}\`);
  return svar.json() as Promise<Ordre>;
};
\`\`\``;
    case 'xml':
      return `\`\`\`xml
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>kafka</artifactId>
  <scope>test</scope>
</dependency>
\`\`\``;
    default:
      return `\`\`\`diff
-  timeout: ${int(1, 5)}s
+  timeout: ${int(6, 30)}s
\`\`\``;
  }
}

function mermaid() {
  const type = pick(['flowchart', 'sequence', 'state', 'er']);
  if (type === 'flowchart') {
    const noder = int(3, 12);
    const linjer = ['flowchart LR'];
    for (let i = 1; i < noder; i++) linjer.push(`    N${int(0, i - 1)}["${pick(DOMENEORD)}"] --> N${i}["${pick(DOMENEORD)}"]`);
    return `\`\`\`mermaid\n${linjer.join('\n')}\n\`\`\``;
  }
  if (type === 'sequence') {
    return `\`\`\`mermaid
sequenceDiagram
    participant A as ${pick(['ordre', 'web', 'gateway'])}
    participant B as ${pick(['lager', 'betaling', 'kunde'])}
    A->>B: ${pick(['reserver', 'belast', 'hent'])}
    B-->>A: ${pick(['ok', '409', 'timeout'])}
\`\`\``;
  }
  if (type === 'state') {
    return '```mermaid\nstateDiagram-v2\n    [*] --> todo\n    todo --> doing\n    doing --> done\n    done --> [*]\n```';
  }
  return '```mermaid\nerDiagram\n    KUNDE ||--o{ ORDRE : har\n    ORDRE ||--|{ LINJE : inneholder\n```';
}

function avsnitt(fraIdx, lenkerPerAvsnitt) {
  const setninger = Array.from({ length: int(2, 5) }, () => pick(SETNINGER));
  for (let i = 0; i < lenkerPerAvsnitt; i++) {
    const pos = int(0, setninger.length - 1);
    setninger[pos] = `${setninger[pos]} Se ${lagLenke(fraIdx)}.`;
  }
  if (chance(0.15)) setninger.push(`#${pick(TAGGER)}`);
  if (chance(0.05)) setninger.push(`==${pick(SETNINGER)}==`);
  if (chance(0.03)) setninger.push(`%%intern kommentar ${int(1, 999)}%%`);
  return setninger.join(' ');
}

function yamlVerdi(v) {
  if (typeof v === 'number') return String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return JSON.stringify(v);
}

function frontmatter(n, idx) {
  const linjer = [];
  const fmTags = n.inlineTask ? n.tags.slice(1) : n.tags; // første tagg flyttes til inline
  if (fmTags.length) linjer.push(`tags: [${fmTags.join(', ')}]`);
  if (n.aliases.length) linjer.push(`aliases: [${n.aliases.map((a) => JSON.stringify(a)).join(', ')}]`);
  for (const [k, v] of Object.entries(n.fm ?? {})) linjer.push(`${k}: ${yamlVerdi(v)}`);
  if (n.type === 'topic') linjer.push(`topic: handel.${n.navn.replace(/\s+/g, '-')}.v1`, `partisjoner: ${pick([3, 6, 12, 24])}`);
  if (chance(0.1)) linjer.push(`relatert: ["${lagLenke(idx)}"]`);
  if (chance(0.002)) return '---\ntittel: "ugyldig\ntags: [a, b\n---\n'; // ugyldig YAML, sjelden
  return linjer.length ? `---\n${linjer.join('\n')}\n---\n` : '';
}

function byggNotat(n, idx) {
  const deler = [frontmatter(n, idx), `# ${n.navn}`, ''];
  if (n.type === 'oppgave' && n.inlineTask) {
    // Flytt én tagg til inline for å teste inline-tagger i stor skala
    deler.push(`#${n.tags[0]}`, '');
  }
  if (n.type === 'moc') {
    deler.push('Oversikt over domenet.', '');
    for (const m of notater.filter((x) => x.mappe.startsWith('domene'))) deler.push(`- [[${m.navn}]]`);
    deler.push('', '![[Domene.base]]', '');
    return deler.join('\n');
  }
  const lenketetthet = n.type === 'teknisk' ? 2 : 1;
  deler.push(avsnitt(idx, lenketetthet), '');
  n.overskrifter.forEach((h, k) => {
    deler.push(`## ${h}`, '', avsnitt(idx, lenketetthet));
    if (k === 0 && n.blokker.length) deler[deler.length - 1] += ` ^${n.blokker[0]}`;
    deler.push('');
    if (chance(0.35)) deler.push(kodeblokk(pick(SPRAAK)), '');
    if (chance(0.08)) deler.push(mermaid(), '');
    if (chance(0.12)) {
      const type = pick(CALLOUTS);
      const fold = pick(['', '', '-', '+']);
      deler.push(`> [!${type}]${fold} ${pick(['Merk', 'Tips', 'Husk', 'Viktig'])}`, `> ${pick(SETNINGER)}`, '');
    }
    if (chance(0.06)) {
      deler.push('| Nøkkel | Verdi | Kommentar |', '|---|---:|---|');
      for (let r = 0; r < int(2, 8); r++) deler.push(`| ${pick(DOMENEORD)} | ${int(1, 9999)} | ${lagLenke(idx)} |`);
      deler.push('');
    }
    if (chance(0.05)) deler.push(`- [ ] ${pick(SETNINGER)}`, `- [x] ${pick(SETNINGER)}`, '');
    if (chance(0.03)) {
      antallEmbeds++;
      deler.push(`![[${notater[velgMål(idx)].navn}]]`, '');
    }
  });
  return deler.join('\n');
}

// ---------- Skriv ----------
const t0 = performance.now();
mkdirSync(OUT, { recursive: true });

// Generer innhold i to pass, slik at innlenker fra første pass påvirker målvalg i andre (rikere knutepunkter)
const innhold = notater.map((n, i) => byggNotat(n, i));

// Sykliske embeds: to par
for (let s = 0; s < 2; s++) {
  const a = notater.length - 1 - s * 2;
  const b = a - 1;
  innhold[a] += `\n\n![[${notater[b].navn}]]\n`;
  innhold[b] += `\n\n![[${notater[a].navn}]]\n`;
  antallEmbeds += 2;
}

let bytes = 0;
notater.forEach((n, i) => {
  const dir = join(OUT, ...n.mappe.split('/'));
  mkdirSync(dir, { recursive: true });
  const fil = join(dir, `${n.navn}.md`);
  writeFileSync(fil, innhold[i]);
  bytes += Buffer.byteLength(innhold[i]);
  // Deterministisk mtime: spredt over 2025-01-01 .. 2026-11-01
  const ms = Date.UTC(2025, 0, 1) + Math.floor(mulberry32(SEED + i)() * (Date.UTC(2026, 10, 1) - Date.UTC(2025, 0, 1)));
  utimesSync(fil, new Date(ms), new Date(ms));
});

// Basene – identiske med docs/produkt/bases-eksempler.md
writeFileSync(join(OUT, 'Domene.base'), `filters:
  and:
    - file.inFolder("domene")
    - file.ext == "md"
    - file.name != "_MOC"
    - '!file.hasTag("kafka-topic")'
views:
  - type: table
    name: Domene
    order:
      - file.name
    sort:
      - property: file.name
        direction: ASC
`);
writeFileSync(join(OUT, 'Oppgaver.base'), `filters:
  and:
    - file.hasTag("task")
    - file.folder != "templates"
formulas:
  team: if(file.hasTag("team"), "Testgjengen", "Mine oppgaver")
views:
  - type: table
    name: Huskeliste
    filters:
      and:
        - status != "done"
    groupBy:
      property: formula.team
      direction: ASC
    order:
      - file.name
      - status
      - due
    sort:
      - property: priority
        direction: ASC
      - property: due
        direction: ASC
    columnSize:
      file.name: 553
      note.status: 101
  - type: kanban
    name: Kanban
    groupBy:
      property: status
      direction: ASC
    groupOrder:
      - todo
      - doing
      - done
    order:
      - file.name
      - file.tags
  - type: table
    name: Arkiv
    filters:
      and:
        - status == "done"
    order:
      - file.name
      - status
      - file.mtime
    sort:
      - property: file.mtime
        direction: ASC
    indentProperties: false
`);

// Mapper som skal ignoreres av indeksen
mkdirSync(join(OUT, '.obsidian'), { recursive: true });
writeFileSync(join(OUT, '.obsidian', 'app.json'), '{ "attachmentFolderPath": "attachments" }\n');
mkdirSync(join(OUT, '.trash'), { recursive: true });
writeFileSync(join(OUT, '.trash', 'Slettet.md'), '---\ntags: [task]\nstatus: todo\n---\n# Slettet\n');

const ms = Math.round(performance.now() - t0);
const toppKnutepunkter = [...notater].sort((a, b) => b.innlenker - a.innlenker).slice(0, 5).map((n) => `${sti(n)} (${n.innlenker})`);
const manifest = {
  generator: 'test-vault-tools/generate-large-vault.mjs',
  seed: SEED,
  antallNotater: notater.length,
  antallOppgaver: notater.filter((n) => n.type === 'oppgave').length,
  antallDomene: notater.filter((n) => n.type === 'domene').length,
  antallKafkaTopics: notater.filter((n) => n.type === 'topic').length,
  antallLenker,
  antallBrutteLenker: antallBrutte,
  antallEmbeds,
  snittLenkerPerNotat: Number((antallLenker / notater.length).toFixed(2)),
  totalBytes: bytes,
  toppKnutepunkter,
};
writeFileSync(join(OUT, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generert vault: ${OUT} på ${ms} ms`);
console.log(JSON.stringify(manifest, null, 2));
// Hint for ytelsestest
console.log(`\nPek leseren mot vaultet (konfigfil eller env/CLI-overstyring, B6) og mål indeksering (< 3 s) og notatbytte (< 200 ms).`);
