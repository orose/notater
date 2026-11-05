import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import { createApp } from './app/create-app';

// SKJELETT: config-featuren (src/server/features/config) skal erstatte denne
// argumenthåndteringen med full oppløsning CLI > env > konfigfil > standard.
const { values } = parseArgs({
  options: { port: { type: 'string' } },
  strict: false,
});

const HOST = '127.0.0.1'; // AK20: aldri konfigurerbar.
const port = Number(values.port ?? process.env.VAULT_READER_PORT ?? 4317);

const app = createApp({ webRoot: './dist/web', version: process.env.npm_package_version ?? '0.0.0' });

serve({ fetch: app.fetch, hostname: HOST, port }, (info) => {
  console.log(`Vault-leser kjører på http://${HOST}:${info.port}`);
});
