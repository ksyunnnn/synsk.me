import { env, applyD1Migrations } from 'cloudflare:test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

/**
 * note・note_revision・activity の uid（ADR-0051）と、004 の取得元の行
 * （specs/004-external-activity/spec.md の Assumptions の分類）
 */
describe('migration 0012', () => {
  const TABLES = ['note', 'note_revision', 'activity'];

  it.each(TABLES)('%s.uid は NOT NULL', async (table) => {
    const column = (await columnsOf(table)).find((c) => c.name === 'uid');
    expect(column).toMatchObject({ notnull: 1 });
  });

  it('uid を挙げずに入れると、DB が 32 文字の 16 進を入れる。書き換えは拒む', async () => {
    const note = await env.DB.prepare(
      "INSERT INTO note (slug) VALUES ('migration-0012') RETURNING id, uid",
    ).first<{ id: number; uid: string }>();
    const revision = await env.DB.prepare(
      "INSERT INTO note_revision (note_id, title, body) VALUES (?, '作り物の 0012 の題', '') RETURNING id, uid",
    )
      .bind(note?.id)
      .first<{ id: number; uid: string }>();
    const activity = await env.DB.prepare(
      "INSERT INTO activity (source, happened_on, title, slug) VALUES ('life_event', '2026-01-01', '作り物の 0012 の出来事', 'migration-0012') RETURNING id, uid",
    ).first<{ id: number; uid: string }>();

    const cases = [
      { table: 'note', row: note, trigger: /note_uid_fixed/ },
      { table: 'note_revision', row: revision, trigger: /note_revision_immutable/ },
      { table: 'activity', row: activity, trigger: /activity_uid_fixed/ },
    ];
    for (const { table, row, trigger } of cases) {
      expect(row?.uid).toMatch(/^[0-9a-f]{32}$/);
      await expect(
        env.DB.prepare(`UPDATE ${table} SET uid = ? WHERE id = ?`)
          .bind('0'.repeat(32), row?.id)
          .run(),
      ).rejects.toThrow(trigger);
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM note_revision WHERE id = ?').bind(revision?.id),
      env.DB.prepare('DELETE FROM note WHERE id = ?').bind(note?.id),
      env.DB.prepare('DELETE FROM activity WHERE id = ?').bind(activity?.id),
    ]);
  });

  it('形の違う uid を拒む', async () => {
    await expect(
      env.DB.prepare("INSERT INTO note (slug, uid) VALUES ('migration-0012-bad', '12345')").run(),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      env.DB.prepare(
        "INSERT INTO activity (source, happened_on, title, slug, uid) VALUES ('life_event', '2026-01-01', '作り物', 'migration-0012-bad', ?)",
      )
        .bind('G'.repeat(32))
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('作り直した表は、UNIQUE の列を持ち直す', async () => {
    const uniques: string[] = [];
    for (const table of TABLES) {
      const { results: indexes } = await env.DB.prepare(
        'SELECT name FROM pragma_index_list(?) WHERE "unique" = 1 AND origin = \'u\'',
      )
        .bind(table)
        .all<{ name: string }>();
      for (const { name } of indexes) {
        const { results: columns } = await env.DB.prepare(
          'SELECT name FROM pragma_index_info(?) ORDER BY seqno',
        )
          .bind(name)
          .all<{ name: string }>();
        uniques.push(`${table}(${columns.map((c) => c.name).join(', ')})`);
      }
    }
    expect(uniques.sort()).toEqual([
      'activity(source, external_id)',
      'activity(uid)',
      'note(slug)',
      'note(uid)',
      'note_revision(uid)',
    ]);
  });

  it('作り直した表は、0004・0005・0009 の索引とトリガを持ち直す', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE tbl_name IN ('note', 'note_revision', 'activity') AND type IN ('index', 'trigger') AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      'activity_slug',
      'activity_sort_at',
      'activity_source_url',
      'activity_uid_fixed',
      'activity_updated_at',
      'note_published_at_fixed',
      'note_published_revision_valid',
      'note_revision_immutable',
      'note_revision_note_id',
      'note_slug_fixed_after_publication',
      'note_uid_fixed',
      'note_updated_at',
    ]);
  });

  it('取得元の行を分類ごとに持つ', async () => {
    const { results } = await env.DB.prepare(
      'SELECT source, kind FROM activity_source ORDER BY kind, source',
    ).all<{ source: string; kind: string }>();
    expect(results).toEqual([
      { source: 'devto', kind: 'article' },
      { source: 'medium', kind: 'article' },
      { source: 'qiita', kind: 'article' },
      { source: 'zenn', kind: 'article' },
      { source: 'codepen', kind: 'embed' },
      { source: 'codesandbox', kind: 'embed' },
      { source: 'speakerdeck', kind: 'embed' },
      { source: 'spotify', kind: 'embed' },
      { source: 'x', kind: 'embed' },
      { source: 'youtube', kind: 'embed' },
      { source: 'life_event', kind: 'life_event' },
      { source: 'connpass', kind: 'other' },
      { source: 'github', kind: 'other' },
      { source: 'unlisted', kind: 'other' },
    ]);
  });
});

/**
 * 一覧のビュー activity_feed の職歴と実績の腕（ADR-0046、specs/005-feed/data-model.md の
 * 「一覧のビュー」の M1、005 の FR-012〜FR-014）
 */
describe('migration 0013 の activity_feed', () => {
  const SECRETS = [
    '0013 の実名の組織',
    '0013 の実際の題',
    '0013 の秘密の職歴の説明',
    '0013 の秘密の実績の説明',
    'https://secret.example/0013/career',
    'https://secret.example/0013/project',
    'project/0013-secret-key',
  ];

  type FeedRow = {
    item_type: string;
    item_id: number;
    sort_key: string;
    is_masked: number;
    title: string | null;
    organization_name: string | null;
    role: string | null;
    project_kind: string | null;
    started_on: string;
    ended_on: string | null;
  };

  const ids = { organizations: [] as number[], careers: [] as number[], projects: [] as number[] };
  let mediaId = 0;

  const insertId = async (sql: string, ...values: unknown[]) => {
    const row = await env.DB.prepare(`${sql} RETURNING id`)
      .bind(...values)
      .first<{ id: number }>();
    if (!row) throw new Error(sql);
    return row.id;
  };

  const insertCareer = (
    organizationId: number,
    role: string,
    startedOn: string,
    isMasked: number,
    status: string,
    description: string | null,
    url: string | null,
  ) =>
    insertId(
      'INSERT INTO career (organization_id, role, started_on, is_masked, status, description, url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      organizationId,
      role,
      startedOn,
      isMasked,
      status,
      description,
      url,
    );

  const insertProject = (
    organizationId: number,
    slug: string,
    title: string,
    isMasked: number,
    startedOn: string,
    description: string | null,
    url: string | null,
  ) =>
    insertId(
      "INSERT INTO project (organization_id, kind, slug, title, title_masked, is_masked, status, started_on, ended_on, description, url) VALUES (?, 'talk', ?, ?, '0013 の伏せた題', ?, 'published', ?, '2014-12-31', ?, ?)",
      organizationId,
      slug,
      title,
      isMasked,
      startedOn,
      description,
      url,
    );

  /** 検査が入れた行だけを、並べるキーの順で読む。ほかの検査の行を拾わない */
  const feedRows = async () => {
    const { results } = await env.DB.prepare(
      'SELECT * FROM activity_feed ORDER BY sort_key, item_type, item_id',
    ).all<FeedRow>();
    return results.filter((row) =>
      (row.item_type === 'career' ? ids.careers : ids.projects).includes(row.item_id),
    );
  };

  beforeAll(async () => {
    const named = await insertId(
      'INSERT INTO organization (name, name_masked) VALUES (?, ?)',
      '0013 の実名の組織',
      '0013 の伏せた組織',
    );
    const unnamed = await insertId(
      'INSERT INTO organization (name) VALUES (?)',
      '0013 の秘匿化した名前の無い組織',
    );
    ids.organizations.push(named, unnamed);
    ids.careers.push(
      await insertCareer(
        named,
        '伏せた職歴',
        '2010-04-01',
        1,
        'published',
        '0013 の秘密の職歴の説明',
        'https://secret.example/0013/career',
      ),
      await insertCareer(named, '出す職歴', '2011-04-01', 0, 'published', '出す説明', null),
      await insertCareer(unnamed, '出せない職歴', '2012-04-01', 1, 'published', null, null),
      await insertCareer(named, '下書きの職歴', '2013-04-01', 0, 'draft', null, null),
    );
    ids.projects.push(
      await insertProject(
        named,
        'migration-0013-masked',
        '0013 の実際の題',
        1,
        '2010-05-01',
        '0013 の秘密の実績の説明',
        'https://secret.example/0013/project',
      ),
      await insertProject(
        named,
        'migration-0013-open',
        '0013 の出す題',
        0,
        '2011-05-01',
        null,
        null,
      ),
    );
    mediaId = await insertId(
      'INSERT INTO media (project_id, storage_key) VALUES (?, ?)',
      ids.projects[0],
      'project/0013-secret-key',
    );
    await env.DB.prepare('UPDATE project SET card_media_id = ? WHERE id = ?')
      .bind(mediaId, ids.projects[0])
      .run();
  });

  afterAll(async () => {
    await env.DB.batch([
      env.DB.prepare('UPDATE project SET card_media_id = NULL WHERE id = ?').bind(ids.projects[0]),
      env.DB.prepare('DELETE FROM media WHERE id = ?').bind(mediaId),
      ...ids.projects.map((id) => env.DB.prepare('DELETE FROM project WHERE id = ?').bind(id)),
      ...ids.careers.map((id) => env.DB.prepare('DELETE FROM career WHERE id = ?').bind(id)),
      ...ids.organizations.map((id) =>
        env.DB.prepare('DELETE FROM organization WHERE id = ?').bind(id),
      ),
    ]);
  });

  it('列は data-model.md の M1 の列だけを持つ', async () => {
    const names = (await columnsOf('activity_feed')).map((c) => c.name);
    expect(names).toEqual([
      'item_type',
      'item_id',
      'sort_key',
      'is_masked',
      'title',
      'organization_name',
      'role',
      'project_kind',
      'started_on',
      'ended_on',
    ]);
  });

  it('サイトに載せる職歴と実績を、秘匿化した行は秘匿化した値で、ほかは実際の値で出す', async () => {
    expect(await feedRows()).toEqual([
      {
        item_type: 'career',
        item_id: ids.careers[0],
        sort_key: '2010-04-01',
        is_masked: 1,
        title: null,
        organization_name: '0013 の伏せた組織',
        role: '伏せた職歴',
        project_kind: null,
        started_on: '2010-04-01',
        ended_on: null,
      },
      {
        item_type: 'project',
        item_id: ids.projects[0],
        sort_key: '2010-05-01',
        is_masked: 1,
        title: '0013 の伏せた題',
        organization_name: '0013 の伏せた組織',
        role: null,
        project_kind: 'talk',
        started_on: '2010-05-01',
        ended_on: '2014-12-31',
      },
      {
        item_type: 'career',
        item_id: ids.careers[1],
        sort_key: '2011-04-01',
        is_masked: 0,
        title: null,
        organization_name: '0013 の実名の組織',
        role: '出す職歴',
        project_kind: null,
        started_on: '2011-04-01',
        ended_on: null,
      },
      {
        item_type: 'project',
        item_id: ids.projects[1],
        sort_key: '2011-05-01',
        is_masked: 0,
        title: '0013 の出す題',
        organization_name: '0013 の実名の組織',
        role: null,
        project_kind: 'talk',
        started_on: '2011-05-01',
        ended_on: '2014-12-31',
      },
    ]);
  });

  it('秘匿化した行の実際の値（題・組織名・説明・URL・画像）をどの列にも持たない', async () => {
    const masked = (await feedRows()).filter((row) => row.is_masked === 1);
    expect(masked).toHaveLength(2);
    const values = masked.flatMap((row) => Object.values(row));
    for (const secret of SECRETS) expect(values).not.toContain(secret);
  });

  it('下書きの行と、秘匿化した組織名の無い組織を指す秘匿化した行を出さない', async () => {
    const careerIds = (await feedRows())
      .filter((row) => row.item_type === 'career')
      .map((row) => row.item_id);
    expect(careerIds).not.toContain(ids.careers[2]);
    expect(careerIds).not.toContain(ids.careers[3]);
  });

  it('腕の列の型が揃い、ビューの外の条件が腕の中へ下りて主キーで引く（005 の research.md の R3）', async () => {
    const { results } = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT * FROM activity_feed WHERE item_type = 'project' AND item_id = ?",
    )
      .bind(ids.projects[0])
      .all<{ detail: string }>();
    const details = results.map((row) => row.detail);
    expect(details).toEqual(
      expect.arrayContaining([
        'SEARCH c USING INTEGER PRIMARY KEY (rowid=?)',
        'SEARCH p USING INTEGER PRIMARY KEY (rowid=?)',
      ]),
    );
    expect(details.filter((detail) => detail.startsWith('SCAN'))).toEqual([]);
  });

  it('外部キーの違反が無い', async () => {
    const { results } = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });
});
