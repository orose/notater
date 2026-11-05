import { describe, expect, it } from 'vitest';
import type { HealthResponse } from '../../shared/api-types';
import { createApp } from './create-app';

describe('createApp', () => {
  it('svarer på helsesjekk', async () => {
    const app = createApp({ webRoot: './dist/web', version: '0.0.0-test' });

    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<HealthResponse>({ status: 'ok', version: '0.0.0-test' });
  });
});
