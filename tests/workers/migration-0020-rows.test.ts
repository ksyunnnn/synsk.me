import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0020 は activity を作り直し、life event の行が published_at を持てないようにする。
 * 0019 までを当てた D1 に行を入れてから 0020 を当て、行・uid・外部キー・sqlite_sequence・索引・
 * トリガ・ビューが保たれることと、足した CHECK と、0015・0019 の列の CHECK とトリガの扱いが
 * 残ることを確かめる。行の値はすべて作り物である。
 */

type Row = Record<string, unknown>;

const rowsOf = async (table: string) => {
  const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all<Row>();
  return results;
};

const sequence = async () =>
  env.DB.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'activity'").first();

/** activity の索引・トリガと、ビューの定義。名前と SQL の文を比べる */
const schemaOf = async () => {
  const { results } = await env.DB.prepare(
    "SELECT type, name, sql FROM sqlite_master WHERE (tbl_name = 'activity' AND type IN ('index', 'trigger')) OR name = 'activity_feed' ORDER BY type, name",
  ).all<Row>();
  return results;
};

const updatedAtOf = async (id: number) =>
  (
    await env.DB.prepare('SELECT updated_at FROM activity WHERE id = ?')
      .bind(id)
      .first<{ updated_at: string }>()
  )?.updated_at;

const before: Record<string, Row[]> = {};
let sequenceBefore: unknown;
let schemaBefore: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0020'),
  );

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO activity (id, source, happened_on, title, description, slug) VALUES (1, 'life_event', '2026-01-01', '作り物の出来事', '作り物の説明', 'fake-life-event')",
    ),
    env.DB.prepare(
      "INSERT INTO media (id, activity_id, storage_key) VALUES (1, 1, 'fake/activity-1')",
    ),
    env.DB.prepare('UPDATE activity SET card_media_id = 1 WHERE id = 1'),
    env.DB.prepare(
      "INSERT INTO activity (id, source, external_id, url, title, published_at, gone_checked_at, consecutive_gone_count) VALUES (2, 'zenn', 'fake-1', 'https://zenn.dev/fake/articles/fake-1', '作り物の記事', '2026-01-03T00:00:00.000Z', '2026-11-01T00:00:00.000Z', 1)",
    ),
    env.DB.prepare(
      "INSERT INTO activity (id, source, url, title, published_at) VALUES (5, 'unlisted', 'https://example.com/fake-article', '作り物の消した記事', '2026-01-04T00:00:00.000Z')",
    ),
    env.DB.prepare('DELETE FROM activity WHERE id = 5'),
  ]);

  for (const table of ['activity', 'media']) before[table] = await rowsOf(table);
  sequenceBefore = await sequence();
  schemaBefore = await schemaOf();

  // 0020 までを当てる。後の migration が列を足すと、行の比べ方が変わるため
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0021'),
  );
});

describe('migration 0020 を行のある D1 に当てる', () => {
  it.each(['activity', 'media'])('%s の行は uid を含めて変わらない', async (table) => {
    expect(before[table]?.length).toBeGreaterThan(0);
    expect(await rowsOf(table)).toEqual(before[table]);
  });

  it('索引・トリガ・ビューは 0019 までと同じ定義を持つ', async () => {
    expect(schemaBefore.map((row) => row.name)).toEqual([
      'activity_slug',
      'activity_sort_at',
      'activity_source_url',
      'sqlite_autoindex_activity_1',
      'sqlite_autoindex_activity_2',
      'activity_uid_fixed',
      'activity_updated_at',
      'activity_feed',
    ]);
    expect(await schemaOf()).toEqual(schemaBefore);
  });

  it('外部キーの違反が無い', async () => {
    const { results } = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });

  it('sqlite_sequence は変わらず、消した行の id を使い直さない', async () => {
    expect(await sequence()).toEqual(sequenceBefore);
    const row = await env.DB.prepare(
      "INSERT INTO activity (source, url, title, published_at) VALUES ('unlisted', 'https://example.com/fake-article-2', '作り物の記事 2', '2026-01-05T00:00:00.000Z') RETURNING id",
    ).first<{ id: number }>();
    expect(row?.id).toBe(6);
    await env.DB.prepare('DELETE FROM activity WHERE id = 6').run();
  });

  it('life event の行は published_at を持てない', async () => {
    await expect(
      env.DB.prepare(
        "UPDATE activity SET published_at = '2026-01-02T00:00:00.000Z' WHERE id = 1",
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      env.DB.prepare(
        "INSERT INTO activity (source, happened_on, title, slug, published_at) VALUES ('life_event', '2026-02-01', '作り物の出来事 2', 'fake-life-event-2', '2026-02-01T09:00:00.000Z')",
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('一覧のビューで、life event の並びの値は起きた日', async () => {
    const row = await env.DB.prepare(
      "SELECT sort_at FROM activity_feed WHERE item_type = 'life_event' AND item_number = 1",
    ).first();
    expect(row).toEqual({ sort_at: '2026-01-01' });
  });

  it('gone_checked_at と consecutive_gone_count の CHECK が残る（0015・0019）', async () => {
    await expect(
      env.DB.prepare(
        "UPDATE activity SET gone_checked_at = '2026-11-09T00:00:00.000Z' WHERE id = 1",
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      env.DB.prepare('UPDATE activity SET consecutive_gone_count = 1 WHERE id = 1').run(),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      env.DB.prepare('UPDATE activity SET consecutive_gone_count = -1 WHERE id = 2').run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('gone_checked_at・consecutive_gone_count だけの UPDATE では updated_at が進まず、ほかの列では進む', async () => {
    await env.DB.prepare(
      "UPDATE activity SET updated_at = '2026-01-01T00:00:00.000Z' WHERE id = 2",
    ).run();
    await env.DB.prepare(
      "UPDATE activity SET gone_checked_at = '2026-11-09T05:00:00.000Z', consecutive_gone_count = 0 WHERE id = 2",
    ).run();
    expect(await updatedAtOf(2)).toBe('2026-01-01T00:00:00.000Z');
    await env.DB.prepare("UPDATE activity SET title = '直した作り物の記事' WHERE id = 2").run();
    expect(await updatedAtOf(2)).not.toBe('2026-01-01T00:00:00.000Z');
  });
});
