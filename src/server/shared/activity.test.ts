import { describe, expect, it } from 'vitest';
import { createActivityTracker } from './activity';

const tick = () => new Promise<void>((r) => setImmediate(r));

describe('createActivityTracker', () => {
  it('idle() løses straks (neste runde) når ingenting pågår', async () => {
    const activity = createActivityTracker();
    let done = false;
    void activity.idle().then(() => (done = true));
    expect(done).toBe(false);
    await tick();
    await tick();
    expect(done).toBe(true);
  });

  it('idle() venter til alle forespørsler er ferdige', async () => {
    const activity = createActivityTracker();
    const endA = activity.begin();
    const endB = activity.begin();
    expect(activity.busy).toBe(true);
    let done = false;
    void activity.idle().then(() => (done = true));
    await tick();
    endA();
    await tick();
    await tick();
    expect(done).toBe(false);
    endB();
    endB(); // idempotent
    await tick();
    await tick();
    expect(done).toBe(true);
    expect(activity.busy).toBe(false);
  });

  it('en forespørsel som starter mens idle-venteren er i kø, utsetter den', async () => {
    const activity = createActivityTracker();
    let done = false;
    void activity.idle().then(() => (done = true));
    const end = activity.begin();
    await tick();
    await tick();
    expect(done).toBe(false);
    end();
    await tick();
    await tick();
    expect(done).toBe(true);
  });

  it('quietMs: venter til det har vært stille en stund etter siste forespørsel', async () => {
    const activity = createActivityTracker({ quietMs: 40 });
    activity.begin()();
    const started = performance.now();
    await activity.idle();
    expect(performance.now() - started).toBeGreaterThanOrEqual(35);
  });
});
