import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0029 は skill に親のスキルを指す parent_id を足す（specs/001-career-and-project/spec.md
 * の FR-031）。0028 までを当てた D1 に行を入れてから 0029 を当て、既にある行が保たれ、足した列が
 * NULL になることと、親子を 1 段に保つ CHECK とトリガを確かめる。行の値はすべて作り物である。
 */

type Row = Record<string, unknown>;

const rowsOf = async () => {
  const { results } = await env.DB.prepare('SELECT * FROM skill ORDER BY id').all<Row>();
  return results;
};

const setParent = (id: number, parentId: number | null) =>
  env.DB.prepare('UPDATE skill SET parent_id = ? WHERE id = ?').bind(parentId, id).run();

const insertSkill = (name: string, parentId: number | null) =>
  env.DB.prepare('INSERT INTO skill (name, parent_id) VALUES (?, ?)').bind(name, parentId).run();

let before: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0029'),
  );

  await env.DB.batch([
    env.DB.prepare("INSERT INTO skill (id, name) VALUES (1, '作り物の基盤')"),
    env.DB.prepare("INSERT INTO skill (id, name, months_override) VALUES (2, '作り物の製品', 12)"),
    env.DB.prepare("INSERT INTO skill (id, name) VALUES (3, '作り物の別の製品')"),
  ]);
  before = await rowsOf();

  // 0029 までを当てる。後の migration が列を足すと、行の比べ方が変わるため
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0030'),
  );
});

describe('migration 0029 を行のある D1 に当てる', () => {
  it('既にある行は変わらず、足した列は NULL になる', async () => {
    expect(before).toHaveLength(3);
    for (const row of before) expect(row).not.toHaveProperty('parent_id');
    expect(await rowsOf()).toEqual(before.map((row) => ({ ...row, parent_id: null })));
  });

  it('親を持たないスキルを親にできる', async () => {
    await setParent(2, 1);
    const row = await env.DB.prepare('SELECT parent_id FROM skill WHERE id = 2').first();
    expect(row).toEqual({ parent_id: 1 });
  });

  it('自分自身を親にできない', async () => {
    await expect(setParent(3, 3)).rejects.toThrow(/CHECK constraint failed/);
  });

  it('無いスキルを親にできない', async () => {
    await expect(setParent(3, 999)).rejects.toThrow(/FOREIGN KEY constraint failed/);
  });

  it('親を持つスキルを親にできない', async () => {
    await expect(setParent(3, 2)).rejects.toThrow(/skill_parent_depth/);
    await expect(insertSkill('作り物の孫', 2)).rejects.toThrow(/skill_parent_depth/);
  });

  it('子を持つスキルに親を付けられない', async () => {
    await expect(setParent(1, 3)).rejects.toThrow(/skill_parent_depth/);
  });

  it('親を外せる', async () => {
    await setParent(2, null);
    const row = await env.DB.prepare('SELECT parent_id FROM skill WHERE id = 2').first();
    expect(row).toEqual({ parent_id: null });
  });

  it('外部キーの違反が無い', async () => {
    const { results } = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });
});
