import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * migration 0012 は note・note_revision・activity を作り直す。0011 までを当てた D1 に
 * 行を入れてから 0012 を当て、行・外部キー・sqlite_sequence が保たれることを確かめる。
 * 行の値はすべて作り物である。
 */

const TABLES = ['note', 'note_revision', 'activity', 'media', 'syndication'] as const;

type Row = Record<string, unknown>;

const rowsOf = async (table: string) => {
  const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all<Row>();
  return results;
};

const withoutUid = (rows: Row[]) =>
  rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'uid')));

const sequences = async () => {
  const { results } = await env.DB.prepare(
    "SELECT name, seq FROM sqlite_sequence WHERE name IN ('note', 'note_revision', 'activity') ORDER BY name",
  ).all<Row>();
  return results;
};

const before: Record<string, Row[]> = {};
let sequencesBefore: Row[] = [];

beforeAll(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0012'),
  );

  await env.DB.batch([
    env.DB.prepare("INSERT INTO note (id, slug) VALUES (1, 'fake-note')"),
    env.DB.prepare(
      "INSERT INTO note_revision (id, note_id, title, body) VALUES (1, 1, '作り物の題 1', '本文 1'), (2, 1, '作り物の題 2', '本文 2')",
    ),
    env.DB.prepare("INSERT INTO media (id, note_id, storage_key) VALUES (1, 1, 'fake/note-1')"),
    env.DB.prepare(
      "UPDATE note SET status = 'published', published_revision_id = 2, published_at = '2026-01-02T03:04:05.000Z', card_image = 'media', card_media_id = 1 WHERE id = 1",
    ),
    env.DB.prepare(
      "INSERT INTO syndication (id, note_id, url) VALUES (1, 1, 'https://example.com/fake-syndication')",
    ),
    env.DB.prepare(
      "INSERT INTO activity (id, source, happened_on, title, slug) VALUES (1, 'life_event', '2026-01-01', '作り物の出来事', 'fake-life-event')",
    ),
    env.DB.prepare(
      "INSERT INTO media (id, activity_id, storage_key) VALUES (2, 1, 'fake/activity-1')",
    ),
    env.DB.prepare('UPDATE activity SET card_media_id = 2 WHERE id = 1'),
    env.DB.prepare(
      "INSERT INTO activity (id, source, url, title, published_at) VALUES (5, 'unlisted', 'https://example.com/fake-article', '作り物の記事', '2026-01-03T00:00:00.000Z')",
    ),
    env.DB.prepare('DELETE FROM activity WHERE id = 5'),
  ]);

  for (const table of TABLES) before[table] = await rowsOf(table);
  sequencesBefore = await sequences();

  // 0012 までを当てる。後の migration が列を足すと、行の比べ方が変わるため
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter((m) => m.name < '0013'),
  );
});

describe('migration 0012 を行のある D1 に当てる', () => {
  it.each(TABLES)('%s の行は uid を除いて変わらない', async (table) => {
    expect(before[table]?.length).toBeGreaterThan(0);
    expect(withoutUid(await rowsOf(table))).toEqual(withoutUid(before[table] ?? []));
  });

  it.each(['note', 'note_revision', 'activity'])('%s の既存の行に uid が入る', async (table) => {
    const { results } = await env.DB.prepare(`SELECT uid FROM ${table}`).all<{ uid: string }>();
    for (const { uid } of results) expect(uid).toMatch(/^[0-9a-f]{32}$/);
  });

  it('外部キーの違反が無い', async () => {
    const { results } = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });

  it('sqlite_sequence は変わらず、消した行の id を使い直さない', async () => {
    expect(await sequences()).toEqual(sequencesBefore);
    const row = await env.DB.prepare(
      "INSERT INTO activity (source, url, title, published_at) VALUES ('unlisted', 'https://example.com/fake-article-2', '作り物の記事 2', '2026-01-04T00:00:00.000Z') RETURNING id",
    ).first<{ id: number }>();
    expect(row?.id).toBe(6);
  });
});
