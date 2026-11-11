import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0020 は、published_at・url・external_id・image_url のどれかを持つ life event の行が
 * あると止まり、値を黙って消さない（docs/SOFTWARE_DESIGN.md の原則 2）。止まった後も 0019 までの
 * 表・索引・トリガ・ビューが残り、作業用の写しの表が残らないことを確かめる。行の値はすべて作り物
 * である。
 */

type Row = Record<string, unknown>;

/** activity の索引・トリガと、ビュー・表の定義 */
const schemaOf = async () => {
  const { results } = await env.DB.prepare(
    "SELECT type, name, sql FROM sqlite_master WHERE tbl_name = 'activity' OR name = 'activity_feed' OR name LIKE '%\\_copy' ESCAPE '\\' ORDER BY type, name",
  ).all<Row>();
  return results;
};

let schemaBefore: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0020'),
  );
  await env.DB.prepare(
    "INSERT INTO activity (id, source, happened_on, title, slug) VALUES (1, 'life_event', '2026-01-01', '作り物の出来事', 'fake-life-event')",
  ).run();
  schemaBefore = await schemaOf();
});

describe('migration 0020 を、公開日かリンク先の値を持つ life event のある D1 に当てる', () => {
  it.each([
    ['published_at', '2026-01-01T09:00:00.000Z'],
    ['url', 'https://example.com/fake-life-event'],
    ['external_id', 'fake-life-event'],
    ['image_url', 'https://example.com/fake-life-event.png'],
  ])('%s を持つと当てられず、値と 0019 までの定義が残る', async (column, value) => {
    await env.DB.prepare(`UPDATE activity SET ${column} = ? WHERE id = 1`).bind(value).run();

    await expect(
      applyD1Migrations(
        env.DB,
        env.TEST_MIGRATIONS.filter((m) => m.name < '0021'),
      ),
    ).rejects.toThrow(/CHECK constraint failed: life_event_without_link_and_published_at/);

    const row = await env.DB.prepare(
      `SELECT ${column} AS value FROM activity WHERE id = 1`,
    ).first();
    expect(row).toEqual({ value });
    const schemaAfter = await schemaOf();
    expect(schemaAfter).toEqual(schemaBefore);
    expect(schemaAfter.map((r) => r.name)).toEqual(
      expect.arrayContaining([
        'activity',
        'activity_feed',
        'activity_slug',
        'activity_sort_at',
        'activity_source_url',
        'activity_uid_fixed',
        'activity_updated_at',
      ]),
    );
    expect(schemaAfter.filter((r) => String(r.name).endsWith('_copy'))).toEqual([]);

    await env.DB.prepare(`UPDATE activity SET ${column} = NULL WHERE id = 1`).run();
  });
});
