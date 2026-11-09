import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0020 は、published_at を持つ life event の行があると止まり、値を黙って消さない
 * （docs/SOFTWARE_DESIGN.md の原則 2）。行の値はすべて作り物である。
 */

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0020'),
  );
  await env.DB.prepare(
    "INSERT INTO activity (id, source, happened_on, published_at, title, slug) VALUES (1, 'life_event', '2026-01-01', '2026-01-01T09:00:00.000Z', '作り物の出来事', 'fake-life-event')",
  ).run();
});

describe('migration 0020 を、published_at を持つ life event のある D1 に当てる', () => {
  it('当てられず、行と値が残る', async () => {
    await expect(
      applyD1Migrations(
        env.DB,
        env.TEST_MIGRATIONS.filter((m) => m.name < '0021'),
      ),
    ).rejects.toThrow(/CHECK constraint failed/);
    const row = await env.DB.prepare('SELECT published_at FROM activity WHERE id = 1').first();
    expect(row).toEqual({ published_at: '2026-01-01T09:00:00.000Z' });
  });
});
