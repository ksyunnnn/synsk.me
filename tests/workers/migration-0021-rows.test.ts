import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0021 は activity を作り直し、life event の行が空の題を持てないようにする
 * （specs/004-external-activity/spec.md の FR-024）。0020 までを当てた D1 に行を入れてから 0021 を
 * 当て、行・uid・外部キー・sqlite_sequence・索引・トリガ・ビューが保たれることと、足した CHECK と、
 * 0020 の CHECK が残ることを確かめる。行の値はすべて作り物である。
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

const before: Record<string, Row[]> = {};
let sequenceBefore: unknown;
let schemaBefore: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0021'),
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

  // 0021 までを当てる。後の migration が列を足すと、行の比べ方が変わるため
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0022'),
  );
});

describe('migration 0021 を行のある D1 に当てる', () => {
  it.each(['activity', 'media'])('%s の行は uid を含めて変わらない', async (table) => {
    expect(before[table]?.length).toBeGreaterThan(0);
    expect(await rowsOf(table)).toEqual(before[table]);
  });

  it('索引・トリガ・ビューは 0020 までと同じ定義を持つ', async () => {
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

  it.each([
    ['NULL', null],
    ['空の文字列', ''],
    ['空白だけ', ' \t\n\r　'],
  ])('life event の行は題に %s を持てない（FR-024）', async (_, title) => {
    await expect(
      env.DB.prepare('UPDATE activity SET title = ? WHERE id = 1').bind(title).run(),
    ).rejects.toThrow(/CHECK constraint failed: life_event_with_title/);
    await expect(
      env.DB.prepare(
        "INSERT INTO activity (source, happened_on, title, slug) VALUES ('life_event', '2026-02-01', ?, 'fake-life-event-2')",
      )
        .bind(title)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed: life_event_with_title/);
  });

  it('アプリケーションの trim() が除く空白は、その文字だけの題を持てない（FR-024）', async () => {
    const whitespaces = Array.from({ length: 0x10000 }, (_, code) =>
      String.fromCharCode(code),
    ).filter((char) => char.trim() === '');
    expect(whitespaces.length).toBeGreaterThan(20);
    for (const char of whitespaces) {
      await expect(
        env.DB.prepare('UPDATE activity SET title = ? WHERE id = 1').bind(`${char}${char}`).run(),
        `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
      ).rejects.toThrow(/CHECK constraint failed: life_event_with_title/);
    }
  });

  it('外部の activity の行は題を空にできる', async () => {
    await env.DB.prepare("UPDATE activity SET title = '' WHERE id = 2").run();
    expect(await env.DB.prepare('SELECT title FROM activity WHERE id = 2').first()).toEqual({
      title: '',
    });
  });

  it('life event の行が公開日を持てない CHECK が残る（0020）', async () => {
    await expect(
      env.DB.prepare(
        "UPDATE activity SET published_at = '2026-01-02T00:00:00.000Z' WHERE id = 1",
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed: life_event_without_link_and_published_at/);
  });
});
