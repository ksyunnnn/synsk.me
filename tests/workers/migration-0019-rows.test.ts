import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0019 は activity に consecutive_gone_count を足す（004 の tasks.md の T048）。0018 までを
 * 当てた D1 に行を入れてから 0019 を当て、既にある行が保たれ、足した列が 0 になることと、列の
 * CHECK と、この列だけの UPDATE で updated_at が進まないことを確かめる。行の値はすべて作り物である。
 */

type Row = Record<string, unknown>;

const rowsOf = async () => {
  const { results } = await env.DB.prepare('SELECT * FROM activity ORDER BY id').all<Row>();
  return results;
};

const setCount = (id: number, value: unknown) =>
  env.DB.prepare('UPDATE activity SET consecutive_gone_count = ? WHERE id = ?')
    .bind(value, id)
    .run();

const updatedAtOf = async (id: number) =>
  (
    await env.DB.prepare('SELECT updated_at FROM activity WHERE id = ?')
      .bind(id)
      .first<{ updated_at: string }>()
  )?.updated_at;

let before: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0019'),
  );

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO activity (id, source, happened_on, title, slug) VALUES (1, 'life_event', '2026-01-01', '作り物の出来事', 'fake-life-event')",
    ),
    env.DB.prepare(
      "INSERT INTO activity (id, source, external_id, url, title, published_at, gone_checked_at) VALUES (2, 'zenn', 'fake-1', 'https://zenn.dev/fake/articles/fake-1', '作り物の記事', '2026-01-03T00:00:00.000Z', '2026-11-01T00:00:00.000Z')",
    ),
  ]);
  before = await rowsOf();

  // 0019 までを当てる。後の migration が列を足すと、行の比べ方が変わるため
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0020'),
  );
});

describe('migration 0019 を行のある D1 に当てる', () => {
  it('既にある行は変わらず、足した列は 0 になる', async () => {
    expect(before).toHaveLength(2);
    for (const row of before) expect(row).not.toHaveProperty('consecutive_gone_count');
    expect(await rowsOf()).toEqual(before.map((row) => ({ ...row, consecutive_gone_count: 0 })));
  });

  it('外部の activity の行は回数を持てる', async () => {
    await setCount(2, 1);
    const row = await env.DB.prepare(
      'SELECT consecutive_gone_count FROM activity WHERE id = 2',
    ).first();
    expect(row).toEqual({ consecutive_gone_count: 1 });
  });

  it('負の値、NULL、整数でない値を拒む', async () => {
    await expect(setCount(2, -1)).rejects.toThrow(/CHECK constraint failed/);
    await expect(setCount(2, null)).rejects.toThrow(/NOT NULL constraint failed/);
    await expect(setCount(2, 'two')).rejects.toThrow(/cannot store TEXT value in INTEGER column/);
  });

  it('life event の行は 0 のほかを持てない', async () => {
    await expect(setCount(1, 1)).rejects.toThrow(/CHECK constraint failed/);
  });

  it('consecutive_gone_count だけを書いても updated_at は変わらない', async () => {
    await env.DB.prepare(
      "UPDATE activity SET updated_at = '2026-01-01T00:00:00.000Z' WHERE id = 2",
    ).run();
    await setCount(2, 0);
    await env.DB.prepare(
      "UPDATE activity SET consecutive_gone_count = 1, gone_checked_at = '2026-11-09T05:00:00.000Z' WHERE id = 2",
    ).run();
    expect(await updatedAtOf(2)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('外部キーの違反が無い', async () => {
    const { results } = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });
});
