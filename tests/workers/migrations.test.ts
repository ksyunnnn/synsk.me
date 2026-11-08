import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * 本番と同じ `migrations/` を当てた D1 が、001 が前提とする表の形を持つことを確かめる
 * （specs/001-career-and-project/research.md の R1）。各 Repository の実装の検査が、
 * この形の上で走る。
 */

type Column = { name: string; notnull: number };

const columnsOf = async (table: string) => {
  const { results } = await env.DB.prepare(
    'SELECT name, "notnull" FROM pragma_table_info(?) ORDER BY cid',
  )
    .bind(table)
    .all<Column>();
  return results;
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('migration 0008 の後の表', () => {
  it('organization.name_masked は NULL を持てる', async () => {
    const column = (await columnsOf('organization')).find((c) => c.name === 'name_masked');
    expect(column).toMatchObject({ notnull: 0 });
  });

  it('skill は months_override を持ち、years_override を持たない', async () => {
    const names = (await columnsOf('skill')).map((c) => c.name);
    expect(names).toContain('months_override');
    expect(names).not.toContain('years_override');
  });

  it('project は is_highlighted を持たない', async () => {
    const names = (await columnsOf('project')).map((c) => c.name);
    expect(names).not.toContain('is_highlighted');
    expect(names).toContain('is_masked');
  });

  it('resume.audience の既定値は limited（specs/002-resume/spec.md の FR-003）', async () => {
    const column = await env.DB.prepare(
      'SELECT dflt_value FROM pragma_table_info(?) WHERE name = ?',
    )
      .bind('resume', 'audience')
      .first<{ dflt_value: string }>();
    expect(column?.dflt_value).toBe("'limited'");
  });

  it('resume_skill_override は months_override を持ち、years_override を持たない', async () => {
    const names = (await columnsOf('resume_skill_override')).map((c) => c.name);
    expect(names).toContain('months_override');
    expect(names).not.toContain('years_override');
  });

  it.each(['resume_career', 'resume_project'])(
    '%s.is_masked の既定値は 1（specs/002-resume/plan.md の U2）',
    async (table) => {
      const column = await env.DB.prepare(
        'SELECT dflt_value FROM pragma_table_info(?) WHERE name = ?',
      )
        .bind(table, 'is_masked')
        .first<{ dflt_value: string }>();
      expect(column?.dflt_value).toBe('1');
    },
  );
});

describe('migration 0010 の後の表（specs/002-resume/spec.md の FR-012）', () => {
  it('resume は limited_token_hash を持たない', async () => {
    const names = (await columnsOf('resume')).map((c) => c.name);
    expect(names).not.toContain('limited_token_hash');
    expect(names).toEqual(
      expect.arrayContaining(['slug', 'audience', 'status', 'limited_expires_at']),
    );
  });

  it('公開用は期限を持てない（FR-020）', async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO resume (slug, title, audience, limited_expires_at) VALUES ('migration-0010', '作り物', 'public', '2026-12-01T00:00:00.000Z')",
      ).run(),
    ).rejects.toThrow(/CHECK/);
  });

  it('索引 resume_public とトリガ resume_audience_fixed・resume_updated_at を持つ', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE tbl_name = 'resume' AND type IN ('index', 'trigger') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(
      expect.arrayContaining(['resume_audience_fixed', 'resume_public', 'resume_updated_at']),
    );
  });
});

describe('migration 0009 の後の表', () => {
  it.each(['career', 'project'])(
    '%s.status は NOT NULL で、既定値は draft（specs/001-career-and-project/spec.md の FR-044）',
    async (table) => {
      const column = await env.DB.prepare(
        'SELECT "notnull", dflt_value FROM pragma_table_info(?) WHERE name = ?',
      )
        .bind(table, 'status')
        .first<{ notnull: number; dflt_value: string }>();
      expect(column).toEqual({ notnull: 1, dflt_value: "'draft'" });
    },
  );

  it.each(['career', 'project'])('%s.status は draft と published のほかを拒む', async (table) => {
    const organization = await env.DB.prepare(
      "INSERT INTO organization (name, name_masked) VALUES ('作り物の 0009 の組織', 'ある組織') RETURNING id",
    ).first<{ id: number }>();
    const insert =
      table === 'career'
        ? env.DB.prepare(
            "INSERT INTO career (organization_id, role, started_on, status) VALUES (?, '作り物', '2020-04-01', 'hidden')",
          )
        : env.DB.prepare(
            "INSERT INTO project (organization_id, kind, slug, title, title_masked, started_on, status) VALUES (?, 'other', 'migration-0009', '作り物', '作り物', '2020-04-01', 'hidden')",
          );
    await expect(insert.bind(organization?.id).run()).rejects.toThrow(/CHECK constraint failed/);
    await env.DB.prepare('DELETE FROM organization WHERE id = ?').bind(organization?.id).run();
  });
});

describe('migration 0009 の activity.slug（specs/004-external-activity/spec.md の FR-034）', () => {
  const insertLifeEvent = (slug: string | null) =>
    env.DB.prepare(
      "INSERT INTO activity (source, happened_on, title, slug) VALUES ('life_event', '2026-01-01', '作り物の出来事', ?)",
    )
      .bind(slug)
      .run();

  it('life event は識別子を持たなければならない', async () => {
    await expect(insertLifeEvent(null)).rejects.toThrow(/CHECK constraint failed/);
  });

  it('識別子は英小文字・数字・ハイフンに限る', async () => {
    await expect(insertLifeEvent('Bad_Slug')).rejects.toThrow(/CHECK constraint failed/);
  });

  it('life event どうしで識別子を重ねられない', async () => {
    await insertLifeEvent('migration-0009-life-event');
    await expect(insertLifeEvent('migration-0009-life-event')).rejects.toThrow(
      /UNIQUE constraint failed: activity.slug/,
    );
    await env.DB.prepare("DELETE FROM activity WHERE slug = 'migration-0009-life-event'").run();
  });

  it('外部から取り込んだ行は識別子を持てない', async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO activity (source, url, title, published_at, slug) VALUES ('unlisted', 'https://example.com/0009', '作り物', '2026-01-01T00:00:00.000Z', 'external')",
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

/**
 * 管理画面の URL に出す uid（ADR-0048 の「主キーは URL に出さない」、
 * specs/001-career-and-project/research.md の R17）
 */
describe('migration 0011 の uid', () => {
  const TABLES = [
    'organization',
    'career',
    'project',
    'skill',
    'education',
    'resume',
    'resume_career',
    'resume_project',
    'resume_education',
  ];

  it.each(TABLES)('%s.uid は NOT NULL', async (table) => {
    const column = (await columnsOf(table)).find((c) => c.name === 'uid');
    expect(column).toMatchObject({ notnull: 1 });
  });

  it.each(TABLES)('%s に uid の書き換えを拒むトリガがある', async (table) => {
    const trigger = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? AND name = ?",
    )
      .bind(table, `${table}_uid_fixed`)
      .first();
    expect(trigger).not.toBeNull();
  });

  it('uid を挙げずに入れると、DB が 32 文字の 16 進を入れる。書き換えは拒む', async () => {
    const row = await env.DB.prepare(
      "INSERT INTO organization (name) VALUES ('作り物の 0011 の組織') RETURNING id, uid",
    ).first<{ id: number; uid: string }>();
    expect(row?.uid).toMatch(/^[0-9a-f]{32}$/);
    await expect(
      env.DB.prepare('UPDATE organization SET uid = ? WHERE id = ?')
        .bind('0'.repeat(32), row?.id)
        .run(),
    ).rejects.toThrow(/organization_uid_fixed/);
    await env.DB.prepare('DELETE FROM organization WHERE id = ?').bind(row?.id).run();
  });

  it('形の違う uid を拒む', async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO organization (name, uid) VALUES ('作り物の 0011 の組織', '12345')",
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

/** note の管理画面の URL に出す uid（specs/003-note/research.md の R1） */
describe('migration 0015 の note.uid', () => {
  it('note.uid は NOT NULL で、uid を挙げずに入れると DB が入れ、書き換えを拒む', async () => {
    const column = (await columnsOf('note')).find((c) => c.name === 'uid');
    expect(column).toMatchObject({ notnull: 1 });
    const row = await env.DB.prepare(
      "INSERT INTO note (slug) VALUES ('fake-0015-note') RETURNING id, uid",
    ).first<{ id: number; uid: string }>();
    expect(row?.uid).toMatch(/^[0-9a-f]{32}$/);
    await expect(
      env.DB.prepare('UPDATE note SET uid = ? WHERE id = ?').bind('0'.repeat(32), row?.id).run(),
    ).rejects.toThrow(/note_uid_fixed/);
    await env.DB.prepare('DELETE FROM note WHERE id = ?').bind(row?.id).run();
  });

  it.each([
    'note_slug_fixed_after_publication',
    'note_published_at_fixed',
    'note_published_revision_valid',
    'note_updated_at',
    'note_uid_fixed',
  ])('作り直した note にトリガ %s がある', async (name) => {
    const trigger = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'note' AND name = ?",
    )
      .bind(name)
      .first();
    expect(trigger).not.toBeNull();
  });
});

/**
 * activity の uid と外部の取得元の行（specs/004-external-activity/research.md の R1・R3、
 * migrations/0020・0021）
 */
describe('migration 0020・0021 の activity', () => {
  it('activity.uid は NOT NULL で、DB が入れ、書き換えを拒む', async () => {
    const column = (await columnsOf('activity')).find((c) => c.name === 'uid');
    expect(column).toMatchObject({ notnull: 1 });
    const row = await env.DB.prepare(
      "INSERT INTO activity (source, happened_on, title, slug) VALUES ('life_event', '2026-01-01', '作り物の 0020', 'migration-0020') RETURNING id, uid",
    ).first<{ id: number; uid: string }>();
    expect(row?.uid).toMatch(/^[0-9a-f]{32}$/);
    await expect(
      env.DB.prepare('UPDATE activity SET uid = ? WHERE id = ?')
        .bind('0'.repeat(32), row?.id)
        .run(),
    ).rejects.toThrow(/activity_uid_fixed/);
    await env.DB.prepare('DELETE FROM activity WHERE id = ?').bind(row?.id).run();
  });

  it('作り直した後も、0004 と 0009 の索引とトリガを持つ', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE tbl_name = 'activity' AND type IN ('index', 'trigger') AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      'activity_slug',
      'activity_sort_at',
      'activity_source_url',
      'activity_uid_fixed',
      'activity_updated_at',
    ]);
  });

  it('外部の取得元の行と分類（FR-001、spec の Assumptions）', async () => {
    const { results } = await env.DB.prepare(
      'SELECT source, kind FROM activity_source ORDER BY source',
    ).all<{ source: string; kind: string }>();
    expect(Object.fromEntries(results.map((r) => [r.source, r.kind]))).toEqual({
      codepen_pen: 'embed',
      codesandbox_sandbox: 'embed',
      connpass_event: 'other',
      devto_article: 'article',
      github_repository: 'other',
      life_event: 'life_event',
      medium_article: 'article',
      qiita_article: 'article',
      speakerdeck_deck: 'embed',
      spotify_playlist: 'embed',
      unlisted: 'other',
      x_post: 'embed',
      youtube_video: 'embed',
      zenn_article: 'article',
    });
  });
});

/**
 * 一覧のビュー（specs/005-feed/data-model.md、migrations/0025）。訪問者に出してよい値の
 * 列だけを持つ（FR-012・FR-013 の許可リスト）
 */
describe('migration 0025 の activity_feed', () => {
  it('ビューは data-model.md の列だけを持つ', async () => {
    expect((await columnsOf('activity_feed')).map((c) => c.name)).toEqual([
      'item_type',
      'item_id',
      'type_rank',
      'sort_key',
      'slug',
      'url',
      'visible_title',
      'description',
      'source',
      'source_kind',
      'visible_organization_name',
      'role',
      'project_kind',
      'started_on',
      'ended_on',
      'is_masked',
      'skills',
    ]);
  });
});
