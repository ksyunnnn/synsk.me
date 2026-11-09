import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0015 は activity に gone_checked_at を足す（specs/004-external-activity/research.md
 * の R6）。0014 までを当てた D1 に行を入れてから 0015 を当て、既にある行が保たれ、足した列が
 * NULL になることと、列の CHECK を確かめる。行の値はすべて作り物である。
 */

type Row = Record<string, unknown>;

const rowsOf = async () => {
  const { results } = await env.DB.prepare('SELECT * FROM activity ORDER BY id').all<Row>();
  return results;
};

const setGoneCheckedAt = (id: number, value: string | null) =>
  env.DB.prepare('UPDATE activity SET gone_checked_at = ? WHERE id = ?').bind(value, id).run();

let before: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0015'),
  );

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO activity (id, source, happened_on, title, slug) VALUES (1, 'life_event', '2026-01-01', '作り物の出来事', 'fake-life-event')",
    ),
    env.DB.prepare(
      "INSERT INTO activity (id, source, external_id, url, title, published_at) VALUES (2, 'zenn', 'fake-1', 'https://zenn.dev/fake/articles/fake-1', '作り物の記事', '2026-01-03T00:00:00.000Z')",
    ),
  ]);
  before = await rowsOf();

  // 0015 までを当てる。後の migration が列を足すと、行の比べ方が変わるため
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0016'),
  );
});

describe('migration 0015 を行のある D1 に当てる', () => {
  it('既にある行は変わらず、足した列は NULL になる', async () => {
    expect(before).toHaveLength(2);
    expect(await rowsOf()).toEqual(before.map((row) => ({ ...row, gone_checked_at: null })));
  });

  it('外部の activity の行は、確かめた日時を持てる', async () => {
    await setGoneCheckedAt(2, '2026-11-09T05:00:00.000Z');
    const row = await env.DB.prepare('SELECT gone_checked_at FROM activity WHERE id = 2').first();
    expect(row).toEqual({ gone_checked_at: '2026-11-09T05:00:00.000Z' });
  });

  it('日時の形でない値を拒む', async () => {
    await expect(setGoneCheckedAt(2, '2026-11-09')).rejects.toThrow(/CHECK constraint failed/);
  });

  it('life event の行は持てない', async () => {
    await expect(setGoneCheckedAt(1, '2026-11-09T05:00:00.000Z')).rejects.toThrow(
      /CHECK constraint failed/,
    );
  });

  it('外部キーの違反が無い', async () => {
    const { results } = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });
});
