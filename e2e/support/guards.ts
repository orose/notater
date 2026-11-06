// Globale vakter for QA-testene mot den ekte serveren (teststrategi §2.3):
//  - dialog (alert/confirm/prompt) → testen feiler (QA-SEC-01)
//  - forespørsel til annen vert enn 127.0.0.1 → testen feiler (B10, QA-SEC-05); forespørselen avbrytes
//  - pageerror og console.error → testen feiler
// Bruk: `import { test, expect } from './support/guards'`.
import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface GuardState {
  readonly dialogs: string[];
  readonly foreignRequests: string[];
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  /** Konsollfeil som er forventet i en bestemt test (regex). */
  allowConsole: RegExp[];
}

export const test = base.extend<{ guards: GuardState; vaultDir: string }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright krever objektdestrukturering av fixtures
  vaultDir: async ({}, use) => {
    const dir = process.env.E2E_VAULT_DIR;
    if (!dir) throw new Error('E2E_VAULT_DIR mangler – kjør via playwright.config.ts (globalSetup).');
    await use(dir);
  },
  guards: [
    async ({ page }, use) => {
      const state: GuardState = { dialogs: [], foreignRequests: [], pageErrors: [], consoleErrors: [], allowConsole: [] };
      page.on('dialog', (dialog) => {
        state.dialogs.push(`${dialog.type()}: ${dialog.message()}`);
        void dialog.dismiss().catch(() => undefined);
      });
      await page.route(
        (url) => !['127.0.0.1'].includes(url.hostname) && !url.protocol.startsWith('data') && !url.protocol.startsWith('blob'),
        (route) => {
          state.foreignRequests.push(route.request().url());
          return route.abort('blockedbyclient');
        },
      );
      page.on('pageerror', (error) => state.pageErrors.push(error.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') state.consoleErrors.push(msg.text());
      });
      await use(state);
      expect(state.dialogs, 'Ingen dialoger (QA-SEC-01)').toEqual([]);
      expect(state.foreignRequests, 'Ingen forespørsler til andre verter enn 127.0.0.1 (B10, QA-SEC-05)').toEqual([]);
      expect(state.pageErrors, 'Ingen uncaught JS-feil').toEqual([]);
      const unexpected = state.consoleErrors.filter((t) => !state.allowConsole.some((r) => r.test(t)));
      expect(unexpected, 'Ingen uventede console.error').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** URL til et notat i e2e-vaultet (DocPath enkodes per segment, som klienten gjør). */
export function noteUrl(docPath: string, hash = ''): string {
  return `/v/test/${docPath.split('/').map(encodeURIComponent).join('/')}${hash}`;
}

/** Venter til notatets innhold er rendret (H1 + artikkel). */
export async function openNote(page: Page, docPath: string, hash = ''): Promise<void> {
  await page.goto(noteUrl(docPath, hash));
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Laster', { timeout: 10_000 });
}

/** Leser/skriver i vault-KOPIEN (aldri test-vault/ i repoet). */
export function readVaultFile(vaultDir: string, rel: string): string {
  return readFileSync(join(vaultDir, rel), 'utf8');
}
export function writeVaultFile(vaultDir: string, rel: string, content: string): void {
  if (!vaultDir.includes('vault-leser-e2e-')) throw new Error(`Nekter å skrive utenfor e2e-kopien: ${vaultDir}`);
  writeFileSync(join(vaultDir, rel), content);
}
