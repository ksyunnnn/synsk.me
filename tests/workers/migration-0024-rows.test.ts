import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0024 は note を作り直し、代表画像の出どころから自動で作る画像（`generated`）を外す
 * （specs/003-note/spec.md の FR-024。2026-11-10 にオーナーが決めた）。0023 までを当てた D1 に
 * 行を入れてから 0024 を当て、`generated` の行が `site` に変わることと、ほかの値・uid・外部キー・
 * sqlite_sequence・トリガ・ビューが保たれることを確かめる。行の値はすべて作り物である。
 */

type Row = Record<string, unknown>;

const TABLES = ['note', 'note_revision', 'media', 'syndication'] as const;

const rowsOf = async (table: string) => {
  const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all<Row>();
  return results;
};

const sequence = async () =>
  env.DB.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'note'").first();

/** note の索引・トリガと、note を読むビューの定義。名前と SQL の文を比べる */
const schemaOf = async () => {
  const { results } = await env.DB.prepare(
    "SELECT type, name, sql FROM sqlite_master WHERE (tbl_name = 'note' AND type IN ('index', 'trigger')) OR name = 'activity_feed' ORDER BY type, name",
  ).all<Row>();
  return results;
};

const before: Record<string, Row[]> = {};
let sequenceBefore: unknown;
let schemaBefore: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0024'),
  );

  await env.DB.batch([
    // 1: 既定の generated のまま公開した note。2: site。3: その note の画像。4: 消した行
    env.DB.prepare(
      "INSERT INTO note (id, slug) VALUES (1, 'fake-generated'), (2, 'fake-site'), (3, 'fake-media'), (4, 'fake-removed')",
    ),
    env.DB.prepare(
      "INSERT INTO note_revision (id, note_id, title, body) VALUES (1, 1, '作り物の題 1', '本文 1'), (2, 2, '作り物の題 2', '本文 2'), (3, 3, '作り物の題 3', '本文 3')",
    ),
    env.DB.prepare(
      "UPDATE note SET status = 'published', published_revision_id = 1, published_at = '2026-01-02T03:04:05.000Z' WHERE id = 1",
    ),
    env.DB.prepare("UPDATE note SET card_image = 'site' WHERE id = 2"),
    env.DB.prepare("INSERT INTO media (id, note_id, storage_key) VALUES (1, 3, 'fake/note-3')"),
    env.DB.prepare("UPDATE note SET card_image = 'media', card_media_id = 1 WHERE id = 3"),
    env.DB.prepare(
      "INSERT INTO syndication (id, note_id, url) VALUES (1, 1, 'https://example.com/fake-syndication')",
    ),
    env.DB.prepare('DELETE FROM note WHERE id = 4'),
  ]);

  for (const table of TABLES) before[table] = await rowsOf(table);
  sequenceBefore = await sequence();
  schemaBefore = await schemaOf();

  // 0024 までを当てる。後の migration が列を足すと、行の比べ方が変わるため
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0025'),
  );
});

describe('migration 0024 を行のある D1 に当てる', () => {
  it('generated の行は site に変わり、ほかの列と行は uid を含めて変わらない', async () => {
    const expected = (before.note ?? []).map((row) =>
      row.card_image === 'generated' ? { ...row, card_image: 'site' } : row,
    );
    expect(expected.map((row) => row.card_image)).toEqual(['site', 'site', 'media']);
    expect(await rowsOf('note')).toEqual(expected);
  });

  it.each(['note_revision', 'media', 'syndication'])('%s の行は変わらない', async (table) => {
    expect(before[table]?.length).toBeGreaterThan(0);
    expect(await rowsOf(table)).toEqual(before[table]);
  });

  it('索引・トリガ・ビューは 0023 までと同じ定義を持つ', async () => {
    expect(schemaBefore.map((row) => row.name)).toEqual([
      'sqlite_autoindex_note_1',
      'sqlite_autoindex_note_2',
      'note_published_at_fixed',
      'note_published_revision_valid',
      'note_slug_fixed_after_publication',
      'note_uid_fixed',
      'note_updated_at',
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
      "INSERT INTO note (slug) VALUES ('fake-after') RETURNING id, card_image",
    ).first<{ id: number; card_image: string }>();
    expect(row).toEqual({ id: 5, card_image: 'site' });
  });

  it('generated を持てない（FR-024）', async () => {
    await expect(
      env.DB.prepare("UPDATE note SET card_image = 'generated' WHERE id = 2").run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('その note の画像を使うときだけ画像を指す CHECK が残る', async () => {
    await expect(
      env.DB.prepare("UPDATE note SET card_image = 'media' WHERE id = 2").run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});
