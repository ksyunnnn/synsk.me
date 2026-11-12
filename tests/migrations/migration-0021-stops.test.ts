import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0021 は、題の空な life event の行があると止まり、題を黙って埋めない
 * （docs/SOFTWARE_DESIGN.md の原則 2）。止まった後も 0020 までの表・索引・トリガ・ビューが残り、
 * 作業用の写しの表が残らないことを確かめる。行の値はすべて作り物である。
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
    env.TEST_MIGRATIONS.filter((m) => m.name < '0021'),
  );
  await env.DB.prepare(
    "INSERT INTO activity (id, source, happened_on, title, slug) VALUES (1, 'life_event', '2026-01-01', '作り物の出来事', 'fake-life-event')",
  ).run();
  schemaBefore = await schemaOf();
});

describe('migration 0021 を、題の空な life event のある D1 に当てる', () => {
  it.each([
    ['NULL', null],
    ['空の文字列', ''],
    ['空白だけ', ' 　'],
    ['ノーブレークスペースだけ', ' '],
  ])('題が %s だと当てられず、値と 0020 までの定義が残る', async (_, title) => {
    await env.DB.prepare('UPDATE activity SET title = ? WHERE id = 1').bind(title).run();

    await expect(
      applyD1Migrations(
        env.DB,
        env.TEST_MIGRATIONS.filter((m) => m.name < '0022'),
      ),
    ).rejects.toThrow(/CHECK constraint failed: life_event_with_title/);

    expect(await env.DB.prepare('SELECT title FROM activity WHERE id = 1').first()).toEqual({
      title,
    });
    const schemaAfter = await schemaOf();
    expect(schemaAfter).toEqual(schemaBefore);
    expect(schemaAfter.filter((r) => String(r.name).endsWith('_copy'))).toEqual([]);

    await env.DB.prepare("UPDATE activity SET title = '作り物の出来事' WHERE id = 1").run();
  });
});
