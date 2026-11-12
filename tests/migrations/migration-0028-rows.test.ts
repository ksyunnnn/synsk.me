import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0028 は project と resume_project を作り直し、種類をオーナーが何をしたかの 4 値に変える
 * （ADR-0055）。0027 までを当てた D1 に行を入れてから 0028 を当て、application が develop に、event が
 * host に変わることと、ほかの値・uid・外部キー・sqlite_sequence・索引・トリガ・ビューが保たれることを
 * 確かめる。行の値はすべて作り物である。
 */

type Row = Record<string, unknown>;

const TABLES = ['project', 'resume_project', 'media', 'project_skill', 'resume_project_skill'];

const rowsOf = async (table: string) => {
  const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all<Row>();
  return results;
};

const sequences = async () => {
  const { results } = await env.DB.prepare(
    "SELECT name, seq FROM sqlite_sequence WHERE name IN ('project', 'resume_project') ORDER BY name",
  ).all<Row>();
  return results;
};

/** project と resume_project の索引・トリガと、project を読むビューの定義 */
const schemaOf = async () => {
  const { results } = await env.DB.prepare(
    "SELECT type, name, sql FROM sqlite_master WHERE (tbl_name IN ('project', 'resume_project') AND type IN ('index', 'trigger')) OR name = 'activity_feed' ORDER BY type, name",
  ).all<Row>();
  return results;
};

const NEW_KIND: Record<string, string> = { application: 'develop', event: 'host' };
const renamed = (row: Row) => ({ ...row, kind: NEW_KIND[String(row.kind)] ?? row.kind });

const before: Record<string, Row[]> = {};
let sequencesBefore: Row[] = [];
let schemaBefore: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0028'),
  );

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO organization (id, name, name_masked) VALUES (1, '作り物株式会社', 'ある会社')",
    ),
    // 1〜4: 旧の 4 値。5: 消した行
    env.DB.prepare(
      `INSERT INTO project (id, organization_id, kind, slug, title, title_masked, started_on, status, is_masked) VALUES
        (1, 1, 'application', 'fake-application', '作り物の開発', '開発', '2021-04-01', 'published', 0),
        (2, 1, 'event', 'fake-event', '作り物の勉強会', '勉強会', '2022-04-01', 'draft', 1),
        (3, 1, 'talk', 'fake-talk', '作り物の登壇', '登壇', '2023-04-01', 'draft', 1),
        (4, 1, 'other', 'fake-other', '作り物の助言', '助言', '2024-04-01', 'draft', 1),
        (5, 1, 'other', 'fake-removed', '消す実績', '消す', '2025-04-01', 'draft', 1)`,
    ),
    env.DB.prepare(
      "INSERT INTO media (id, project_id, storage_key) VALUES (1, 1, 'fake/project-1')",
    ),
    env.DB.prepare('UPDATE project SET card_media_id = 1 WHERE id = 1'),
    env.DB.prepare("INSERT INTO skill (id, name) VALUES (1, '作り物のスキル')"),
    env.DB.prepare('INSERT INTO project_skill (project_id, skill_id) VALUES (1, 1), (2, 1)'),
    env.DB.prepare(
      "INSERT INTO resume (id, slug, title, audience) VALUES (1, 'fake-resume', '作り物の職務経歴書', 'public')",
    ),
    env.DB.prepare(
      `INSERT INTO resume_project (id, resume_id, project_id, organization_name, kind, title, started_on) VALUES
        (1, 1, 1, '作り物株式会社', 'application', '写した開発', '2021-04-01'),
        (2, 1, 2, '作り物株式会社', 'event', '写した勉強会', '2022-04-01'),
        (3, 1, NULL, '作り物株式会社', 'talk', '写した登壇', '2023-04-01')`,
    ),
    env.DB.prepare(
      "INSERT INTO resume_project_skill (resume_project_id, skill_name) VALUES (1, '作り物のスキル')",
    ),
    env.DB.prepare('DELETE FROM project WHERE id = 5'),
  ]);

  for (const table of TABLES) before[table] = await rowsOf(table);
  sequencesBefore = await sequences();
  schemaBefore = await schemaOf();

  // 0028 までを当てる。後の migration が列を足すと、行の比べ方が変わるため
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0029'),
  );
});

describe('migration 0028 を行のある D1 に当てる', () => {
  it.each(['project', 'resume_project'])(
    '%s の application は develop に、event は host に変わり、ほかの列と行は uid を含めて変わらない',
    async (table) => {
      const rows = before[table] ?? [];
      // 当てる前に旧の値の行があることを確かめる。無ければ変換を試していない
      expect(rows.map((row) => row.kind)).toEqual(expect.arrayContaining(['application', 'event']));
      expect(await rowsOf(table)).toEqual(rows.map(renamed));
    },
  );

  it.each(['media', 'project_skill', 'resume_project_skill'])(
    '%s の行は変わらない',
    async (table) => {
      expect(before[table]?.length).toBeGreaterThan(0);
      expect(await rowsOf(table)).toEqual(before[table]);
    },
  );

  it('索引とトリガは 0027 までと同じ名前と定義を持ち、ビューは同じ定義を持つ', async () => {
    expect(schemaBefore.map((row) => row.name)).toEqual([
      'project_organization_id',
      'resume_project_project_id',
      'resume_project_resume_id',
      'sqlite_autoindex_project_1',
      'sqlite_autoindex_project_2',
      'sqlite_autoindex_resume_project_1',
      'project_uid_fixed',
      'project_updated_at',
      'resume_project_uid_fixed',
      'activity_feed',
    ]);
    expect(await schemaOf()).toEqual(schemaBefore);
  });

  it('ビューは、サイトに載せる実績を新の値で出す', async () => {
    const row = await env.DB.prepare(
      "SELECT project_kind, card_storage_key FROM activity_feed WHERE item_type = 'project'",
    ).first();
    expect(row).toEqual({ project_kind: 'develop', card_storage_key: 'fake/project-1' });
  });

  it('外部キーの違反が無い', async () => {
    const { results } = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });

  it('sqlite_sequence は変わらず、消した行の id を使い直さない', async () => {
    expect(await sequences()).toEqual(sequencesBefore);
    const row = await env.DB.prepare(
      "INSERT INTO project (organization_id, kind, slug, title, title_masked, started_on) VALUES (1, 'host', 'fake-after', '後の実績', '後', '2026-01-01') RETURNING id",
    ).first();
    expect(row).toEqual({ id: 6 });
  });

  it.each(['application', 'event'])('%s を持てない（ADR-0055）', async (kind) => {
    await expect(
      env.DB.prepare('UPDATE project SET kind = ? WHERE id = 1').bind(kind).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      env.DB.prepare('UPDATE resume_project SET kind = ? WHERE id = 1').bind(kind).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});
