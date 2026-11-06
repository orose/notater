// PO-17: globalSetup kopierer test-vault/ til en temp-mappe, setter fixture-mtimes, bygger web til temp
// og starter den EKTE serveren (src/server/main.ts --config <temp-konfig>) på 127.0.0.1:4318.
// E2E skriver aldri i repoet. Stien til kopien deles med testene via E2E_VAULT_DIR.
import type { FullConfig } from '@playwright/test';
import { E2E_PORT, buildWeb, copyTestVault, makeTempDir, removeDir, startServer, writeConfig } from './support/real-server';

// Playwright krever at globalSetup-fila har en default export.
// eslint-disable-next-line no-restricted-syntax
export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const dir = makeTempDir('vault-leser-e2e-');
  const vault = copyTestVault(dir);
  buildWeb(dir);
  const configFile = writeConfig(dir, vault, E2E_PORT);
  const server = await startServer(dir, configFile, E2E_PORT);
  process.env.E2E_TMP_DIR = dir;
  process.env.E2E_VAULT_DIR = vault;
  console.log(`[e2e] Ekte server på 127.0.0.1:${E2E_PORT} mot ${vault} (indeks klar etter ${Math.round(server.readyAfterMs)} ms)`);

  return async () => {
    await server.stop();
    if (!process.env.E2E_KEEP_TMP) removeDir(dir);
  };
}
