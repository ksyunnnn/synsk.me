import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0014 は fetch_result に etag と last_modified を足す
 * （specs/004-external-activity/research.md の R9）。0013 までを当てた D1 に行を入れてから
 * 0014 を当て、既にある行が保たれ、足した列が NULL になることを確かめる。
 * 行の値はすべて作り物である。
 */

type Row = Record<string, unknown>;

const rowsOf = async () => {
  const { results } = await env.DB.prepare('SELECT * FROM fetch_result ORDER BY source').all<Row>();
  return results;
};

let before: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0014'),
  );

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO fetch_result (source, fetched_at, is_ok, reason, last_succeeded_at) VALUES ('zenn', '2026-01-02T03:04:05.000Z', 1, NULL, '2026-01-02T03:04:05.000Z')",
    ),
    env.DB.prepare(
      "INSERT INTO fetch_result (source, fetched_at, is_ok, reason, last_succeeded_at) VALUES ('qiita', '2026-01-02T03:04:05.000Z', 0, '作り物の失敗の理由', NULL)",
    ),
  ]);
  before = await rowsOf();

  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('migration 0014 を行のある D1 に当てる', () => {
  it('既にある行は変わらず、足した列は NULL になる', async () => {
    expect(before).toHaveLength(2);
    for (const row of before) {
      expect(row).not.toHaveProperty('etag');
      expect(row).not.toHaveProperty('last_modified');
    }
    expect(await rowsOf()).toEqual(
      before.map((row) => ({ ...row, etag: null, last_modified: null })),
    );
  });

  it('応答のヘッダの値をそのままの文字列で持てる', async () => {
    await env.DB.prepare(
      "UPDATE fetch_result SET etag = 'W/\"fake-etag\"', last_modified = 'Mon, 09 Nov 2026 05:00:00 GMT' WHERE source = 'zenn'",
    ).run();
    const row = await env.DB.prepare(
      "SELECT etag, last_modified FROM fetch_result WHERE source = 'zenn'",
    ).first<Row>();
    expect(row).toEqual({ etag: 'W/"fake-etag"', last_modified: 'Mon, 09 Nov 2026 05:00:00 GMT' });
  });

  it('外部キーの違反が無い', async () => {
    const { results } = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });
});
