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

const insertId = async (sql: string, ...values: unknown[]) => {
  const row = await env.DB.prepare(`${sql} RETURNING id`)
    .bind(...values)
    .first<{ id: number }>();
  if (!row) throw new Error(sql);
  return row.id;
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
 * 0005 の note のトリガが、表を作り直す後の migration を当てた後も働く（specs/003-note/tasks.md の
 * T003、data-model.md の「スキーマが守る決まり」）。行は作り物で、各検査の終わりに消す
 */
describe('0005 の note のトリガ', () => {
  const insertNoteWithRevision = async (slug: string, title = '作り物の題') => {
    const note = await env.DB.prepare('INSERT INTO note (slug) VALUES (?) RETURNING id')
      .bind(slug)
      .first<{ id: number }>();
    const revision = await env.DB.prepare(
      "INSERT INTO note_revision (note_id, title, body) VALUES (?, ?, '作り物の本文') RETURNING id",
    )
      .bind(note?.id, title)
      .first<{ id: number }>();
    return { noteId: note?.id as number, revisionId: revision?.id as number };
  };

  const publish = (noteId: number, revisionId: number) =>
    env.DB.prepare(
      "UPDATE note SET status = 'published', published_revision_id = ?, published_at = '2026-11-01T00:00:00.000Z' WHERE id = ?",
    )
      .bind(revisionId, noteId)
      .run();

  const cleanUp = (noteId: number) =>
    env.DB.batch([
      env.DB.prepare('DELETE FROM note_revision WHERE note_id = ?').bind(noteId),
      env.DB.prepare('DELETE FROM note WHERE id = ?').bind(noteId),
    ]);

  it('note_revision_immutable が版の書き換えを拒む（FR-006）', async () => {
    const { noteId, revisionId } = await insertNoteWithRevision('trigger-immutable');
    await expect(
      env.DB.prepare("UPDATE note_revision SET title = '書き換え' WHERE id = ?")
        .bind(revisionId)
        .run(),
    ).rejects.toThrow(/note_revision_immutable/);
    await cleanUp(noteId);
  });

  it('note_slug_fixed_after_publication が公開した note の識別子の書き換えを拒む（FR-003）', async () => {
    const { noteId, revisionId } = await insertNoteWithRevision('trigger-slug');
    await publish(noteId, revisionId);
    await expect(
      env.DB.prepare("UPDATE note SET slug = 'trigger-slug-moved' WHERE id = ?").bind(noteId).run(),
    ).rejects.toThrow(/note_slug_fixed_after_publication/);
    await cleanUp(noteId);
  });

  it('note_published_at_fixed が初めて公開した日時の書き換えを拒む（FR-013）', async () => {
    const { noteId, revisionId } = await insertNoteWithRevision('trigger-published-at');
    await publish(noteId, revisionId);
    await expect(
      env.DB.prepare("UPDATE note SET published_at = '2026-12-01T00:00:00.000Z' WHERE id = ?")
        .bind(noteId)
        .run(),
    ).rejects.toThrow(/note_published_at_fixed/);
    await cleanUp(noteId);
  });

  it('note_published_revision_valid が題の空の版の公開を拒む（FR-011）', async () => {
    const { noteId, revisionId } = await insertNoteWithRevision('trigger-untitled', '');
    await expect(publish(noteId, revisionId)).rejects.toThrow(/note_published_revision_invalid/);
    await cleanUp(noteId);
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
/** activity_feed の、0013 が作った列。後の migration は列を最後に足す */
const M1_COLUMNS = [
  'item_type',
  'item_number',
  'sort_at',
  'is_masked',
  'title',
  'title_masked',
  'organization_name',
  'organization_name_masked',
  'role',
  'project_kind',
  'started_on',
  'ended_on',
];

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
    item_number: number;
    sort_at: string;
    is_masked: number;
    title: string | null;
    title_masked: string | null;
    organization_name: string | null;
    organization_name_masked: string | null;
    role: string | null;
    project_kind: string | null;
    started_on: string;
    ended_on: string | null;
  };

  const ids = { organizations: [] as number[], careers: [] as number[], projects: [] as number[] };
  let mediaId = 0;

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
  const ownRows = <T extends { item_type: string; item_number: number }>(rows: T[]) =>
    rows.filter(
      (row) =>
        (row.item_type === 'career' && ids.careers.includes(row.item_number)) ||
        (row.item_type === 'project' && ids.projects.includes(row.item_number)),
    );

  /** 0013 の列だけを読む。後の migration が列を足しても、行の比べ方が変わらない */
  const feedRows = async () => {
    const { results } = await env.DB.prepare(
      `SELECT ${M1_COLUMNS.join(', ')} FROM activity_feed ORDER BY sort_at, item_type, item_number`,
    ).all<FeedRow>();
    return ownRows(results);
  };

  /** 後の migration が足した列も含め、ビューのすべての列を読む */
  const allColumnRows = async () => {
    const { results } = await env.DB.prepare(
      'SELECT * FROM activity_feed ORDER BY sort_at, item_type, item_number',
    ).all<FeedRow & Record<string, unknown>>();
    return ownRows(results);
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
      await insertId(
        "INSERT INTO project (organization_id, kind, slug, title, title_masked, is_masked, status, started_on) VALUES (?, 'talk', 'migration-0013-unnamed', '0013 の出せない題', '0013 の伏せた題', 1, 'published', '2012-05-01')",
        unnamed,
      ),
      await insertId(
        "INSERT INTO project (organization_id, kind, slug, title, title_masked, is_masked, status, started_on) VALUES (?, 'talk', 'migration-0013-draft', '0013 の下書きの題', '0013 の伏せた題', 0, 'draft', '2013-05-01')",
        named,
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

  it('data-model.md の M1 の列を、この順で先頭に持つ（後の migration は列を最後に足す）', async () => {
    const names = (await columnsOf('activity_feed')).map((c) => c.name);
    expect(names.slice(0, M1_COLUMNS.length)).toEqual(M1_COLUMNS);
  });

  it('サイトに載せる職歴と実績を、秘匿化した行は秘匿化した値で、ほかは実際の値で出す', async () => {
    expect(await feedRows()).toEqual([
      {
        item_type: 'career',
        item_number: ids.careers[0],
        sort_at: '2010-04-01',
        is_masked: 1,
        title: null,
        title_masked: null,
        organization_name: null,
        organization_name_masked: '0013 の伏せた組織',
        role: '伏せた職歴',
        project_kind: null,
        started_on: '2010-04-01',
        ended_on: null,
      },
      {
        item_type: 'project',
        item_number: ids.projects[0],
        sort_at: '2010-05-01',
        is_masked: 1,
        title: null,
        title_masked: '0013 の伏せた題',
        organization_name: null,
        organization_name_masked: '0013 の伏せた組織',
        role: null,
        project_kind: 'talk',
        started_on: '2010-05-01',
        ended_on: '2014-12-31',
      },
      {
        item_type: 'career',
        item_number: ids.careers[1],
        sort_at: '2011-04-01',
        is_masked: 0,
        title: null,
        title_masked: null,
        organization_name: '0013 の実名の組織',
        organization_name_masked: null,
        role: '出す職歴',
        project_kind: null,
        started_on: '2011-04-01',
        ended_on: null,
      },
      {
        item_type: 'project',
        item_number: ids.projects[1],
        sort_at: '2011-05-01',
        is_masked: 0,
        title: '0013 の出す題',
        title_masked: null,
        organization_name: '0013 の実名の組織',
        organization_name_masked: null,
        role: null,
        project_kind: 'talk',
        started_on: '2011-05-01',
        ended_on: '2014-12-31',
      },
    ]);
  });

  it('秘匿化した行の実際の値（題・組織名・説明・URL・画像）を、後の migration が足した列を含むどの列にも持たない', async () => {
    const masked = (await allColumnRows()).filter((row) => row.is_masked === 1);
    expect(masked).toHaveLength(2);
    const values = masked.flatMap((row) => Object.values(row));
    for (const secret of SECRETS) expect(values).not.toContain(secret);
  });

  it('下書きの行と、秘匿化した組織名の無い組織を指す秘匿化した行を出さない', async () => {
    const careerIds = (await feedRows())
      .filter((row) => row.item_type === 'career')
      .map((row) => row.item_number);
    expect(careerIds).not.toContain(ids.careers[2]);
    expect(careerIds).not.toContain(ids.careers[3]);
    const projectIds = (await feedRows())
      .filter((row) => row.item_type === 'project')
      .map((row) => row.item_number);
    expect(projectIds).not.toContain(ids.projects[2]);
    expect(projectIds).not.toContain(ids.projects[3]);
  });

  it('職歴と実績の腕は、0013 の後に足した列（説明・取得元・URL など）をどれも NULL にする', async () => {
    const rows = await allColumnRows();
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const added = Object.entries(row).filter(([name]) => !M1_COLUMNS.includes(name));
      expect(added.length).toBeGreaterThan(0);
      for (const [name, value] of added) expect([name, value]).toEqual([name, null]);
    }
  });

  it('秘匿化した行は実際の値の列が NULL で、秘匿化しない行は _masked の列が NULL', async () => {
    for (const row of await feedRows()) {
      if (row.is_masked === 1) {
        expect([row.title, row.organization_name]).toEqual([null, null]);
      } else {
        expect([row.title_masked, row.organization_name_masked]).toEqual([null, null]);
      }
    }
  });

  it('腕の列の型が揃い、ビューの外の条件が腕の中へ下りて主キーで引く（005 の research.md の R3）', async () => {
    const { results } = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT * FROM activity_feed WHERE item_type = 'project' AND item_number = ?",
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

/**
 * 一覧のビュー activity_feed の note の腕と description の列（specs/005-feed/data-model.md の
 * 「一覧のビュー」の M2、005 の FR-005・FR-006）
 */
describe('migration 0016 の activity_feed の note の腕', () => {
  const ids = { notes: [] as number[] };

  /** 版を足し、その版で公開した note を作る。下書きの版を後に足し、公開した版と分ける */
  const insertPublishedNote = async (slug: string, createdAt: string) => {
    const noteId = await insertId(
      'INSERT INTO note (slug, created_at, updated_at) VALUES (?, ?, ?)',
      slug,
      createdAt,
      createdAt,
    );
    ids.notes.push(noteId);
    const revisionId = await insertId(
      'INSERT INTO note_revision (note_id, title, description, body) VALUES (?, ?, ?, ?)',
      noteId,
      `${slug} の公開した題`,
      `${slug} の公開した説明`,
      '本文',
    );
    await env.DB.prepare(
      "UPDATE note SET status = 'published', published_revision_id = ?, published_at = ? WHERE id = ?",
    )
      .bind(revisionId, createdAt, noteId)
      .run();
    await env.DB.prepare(
      'INSERT INTO note_revision (note_id, title, description, body) VALUES (?, ?, ?, ?)',
    )
      .bind(noteId, `${slug} の下書きの題`, `${slug} の下書きの説明`, '本文')
      .run();
    return noteId;
  };

  type NoteRow = Record<string, unknown> & { item_number: number };

  /** 検査が入れた note の行だけを読む。ほかの検査の行を拾わない */
  const noteRows = async () => {
    const { results } = await env.DB.prepare(
      "SELECT * FROM activity_feed WHERE item_type = 'note' ORDER BY item_number",
    ).all<NoteRow>();
    return results.filter((row) => ids.notes.includes(row.item_number));
  };

  let published = 0;
  let unpublished = 0;
  let deleted = 0;
  let draftOnly = 0;

  beforeAll(async () => {
    published = await insertPublishedNote('migration-0016-published', '2026-01-02T03:04:05.000Z');
    unpublished = await insertPublishedNote(
      'migration-0016-unpublished',
      '2026-01-03T00:00:00.000Z',
    );
    await env.DB.prepare("UPDATE note SET status = 'draft' WHERE id = ?").bind(unpublished).run();
    deleted = await insertPublishedNote('migration-0016-deleted', '2026-01-04T00:00:00.000Z');
    await env.DB.prepare("UPDATE note SET deleted_at = '2026-02-01T00:00:00.000Z' WHERE id = ?")
      .bind(deleted)
      .run();
    draftOnly = await insertId("INSERT INTO note (slug) VALUES ('migration-0016-draft-only')");
    ids.notes.push(draftOnly);
    await env.DB.prepare(
      "INSERT INTO note_revision (note_id, title, description, body) VALUES (?, '下書きだけの題', '下書きだけの説明', '本文')",
    )
      .bind(draftOnly)
      .run();
  });

  // note.published_revision_id の外部キーは検査をトランザクションの終わりに送るので、1 回の
  // batch で版、note の順に消せる
  afterAll(async () => {
    await env.DB.batch([
      ...ids.notes.map((id) =>
        env.DB.prepare('DELETE FROM note_revision WHERE note_id = ?').bind(id),
      ),
      ...ids.notes.map((id) => env.DB.prepare('DELETE FROM note WHERE id = ?').bind(id)),
    ]);
  });

  it('description の列を、0013 の列の後に持つ', async () => {
    const names = (await columnsOf('activity_feed')).map((c) => c.name);
    expect(names.indexOf('description')).toBe(M1_COLUMNS.length);
  });

  it('公開中で削除していない note を、公開した版の題と説明文で出す', async () => {
    const rows = await noteRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      item_type: 'note',
      item_number: published,
      sort_at: '2026-01-02T12:04:05.000',
      is_masked: 0,
      title: 'migration-0016-published の公開した題',
      title_masked: null,
      organization_name: null,
      organization_name_masked: null,
      role: null,
      project_kind: null,
      started_on: null,
      ended_on: null,
      description: 'migration-0016-published の公開した説明',
      source: null,
      source_kind: null,
      url: null,
      created_at: '2026-01-02T03:04:05.000Z',
      published_at: null,
    });
  });

  it('下書きに戻した note、削除した note、公開したことの無い note を出さない', async () => {
    const numbers = (await noteRows()).map((row) => row.item_number);
    expect(numbers).not.toContain(unpublished);
    expect(numbers).not.toContain(deleted);
    expect(numbers).not.toContain(draftOnly);
  });

  it('公開した後に足した下書きの版の題と説明文を出さない', async () => {
    const values = (await noteRows()).flatMap((row) => Object.values(row));
    expect(values).not.toContain('migration-0016-published の下書きの題');
    expect(values).not.toContain('migration-0016-published の下書きの説明');
  });

  it('note の腕でも、種類と主キーの条件が腕の中へ下りて主キーで引く（005 の research.md の R3）', async () => {
    const { results } = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT * FROM activity_feed WHERE item_type = 'note' AND item_number = ?",
    )
      .bind(published)
      .all<{ detail: string }>();
    const details = results.map((row) => row.detail);
    expect(details).toEqual(
      expect.arrayContaining([
        'SEARCH n USING INTEGER PRIMARY KEY (rowid=?)',
        'SEARCH r USING INTEGER PRIMARY KEY (rowid=?)',
      ]),
    );
    expect(details.filter((detail) => detail.startsWith('SCAN'))).toEqual([]);
  });
});

/**
 * 一覧のビュー activity_feed の外部の activity と life event の腕と、source・source_kind・url の
 * 列（specs/005-feed/data-model.md の「一覧のビュー」の M3、005 の FR-002・FR-003・FR-007）
 */
describe('migration 0017 の activity_feed の外部の activity と life event の腕', () => {
  const ids: number[] = [];
  let external = 0;
  let lifeEvent = 0;

  type ActivityRow = Record<string, unknown> & { item_type: string; item_number: number };

  /** 検査が入れた activity の行だけを読む。ほかの検査の行を拾わない */
  const activityRows = async () => {
    const { results } = await env.DB.prepare(
      "SELECT * FROM activity_feed WHERE item_type IN ('external_activity', 'life_event') ORDER BY item_number",
    ).all<ActivityRow>();
    return results.filter((row) => ids.includes(row.item_number));
  };

  beforeAll(async () => {
    external = await insertId(
      "INSERT INTO activity (source, external_id, url, title, description, image_url, published_at) VALUES ('zenn', 'migration-0017', 'https://zenn.dev/fake/articles/migration-0017', '0017 の記事', '0017 の記事の説明', 'https://example.com/0017.png', '2026-01-05T00:00:00.000Z')",
    );
    lifeEvent = await insertId(
      "INSERT INTO activity (source, title, description, happened_on, slug) VALUES ('life_event', '0017 の出来事', '0017 の出来事の説明', '2026-01-06', 'migration-0017')",
    );
    ids.push(external, lifeEvent);
  });

  afterAll(async () => {
    await env.DB.batch(
      ids.map((id) => env.DB.prepare('DELETE FROM activity WHERE id = ?').bind(id)),
    );
  });

  it('source・source_kind・url の列を、0016 までの列の後に持つ', async () => {
    const names = (await columnsOf('activity_feed')).map((c) => c.name);
    expect(names.slice(M1_COLUMNS.length + 1, M1_COLUMNS.length + 4)).toEqual([
      'source',
      'source_kind',
      'url',
    ]);
  });

  it('外部の activity を、題・取得元・分類・URL で出す。説明と画像は出さない', async () => {
    const row = (await activityRows()).find((r) => r.item_number === external);
    expect(row).toEqual({
      item_type: 'external_activity',
      item_number: external,
      sort_at: '2026-01-05T09:00:00.000',
      is_masked: 0,
      title: '0017 の記事',
      title_masked: null,
      organization_name: null,
      organization_name_masked: null,
      role: null,
      project_kind: null,
      started_on: null,
      ended_on: null,
      description: null,
      source: 'zenn',
      source_kind: 'article',
      url: 'https://zenn.dev/fake/articles/migration-0017',
      created_at: null,
      published_at: '2026-01-05T00:00:00.000Z',
    });
    expect(Object.values(row ?? {})).not.toContain('https://example.com/0017.png');
  });

  it('life event を、題・説明・起きた日で出す。URL は出さない', async () => {
    const row = (await activityRows()).find((r) => r.item_number === lifeEvent);
    expect(row).toEqual({
      item_type: 'life_event',
      item_number: lifeEvent,
      sort_at: '2026-01-06',
      is_masked: 0,
      title: '0017 の出来事',
      title_masked: null,
      organization_name: null,
      organization_name_masked: null,
      role: null,
      project_kind: null,
      started_on: null,
      ended_on: null,
      description: '0017 の出来事の説明',
      source: 'life_event',
      source_kind: 'life_event',
      url: null,
      created_at: null,
      published_at: null,
    });
  });

  it('1 つの activity は 1 つの腕にだけ出る', async () => {
    expect((await activityRows()).map((r) => [r.item_type, r.item_number])).toEqual([
      ['external_activity', external],
      ['life_event', lifeEvent],
    ]);
  });

  it.each([
    ['external_activity', 'a'],
    ['life_event', 'l'],
  ])(
    '%s の腕でも、種類と主キーの条件が腕の中へ下りて主キーで引く（005 の research.md の R3）',
    async (itemType, alias) => {
      const { results } = await env.DB.prepare(
        'EXPLAIN QUERY PLAN SELECT * FROM activity_feed WHERE item_type = ? AND item_number = ?',
      )
        .bind(itemType, itemType === 'life_event' ? lifeEvent : external)
        .all<{ detail: string }>();
      const details = results.map((row) => row.detail);
      expect(details).toContain(`SEARCH ${alias} USING INTEGER PRIMARY KEY (rowid=?)`);
      expect(details.filter((detail) => detail.startsWith('SCAN'))).toEqual([]);
    },
  );
});

/**
 * 一覧のビュー activity_feed が、転載先と一致する外部の activity を除くこと
 * （specs/005-feed/data-model.md の「一覧のビュー」の M4、ADR-0006）
 */
describe('migration 0018 の activity_feed の転載先の除外', () => {
  const noteIds: number[] = [];
  const activityIds: number[] = [];
  const syndicationIds: number[] = [];

  /**
   * 転載先の URL を 1 つ持つ note を作る。状態は公開・公開したことの無い下書き・公開してから
   * 下書きに戻したもの・削除のどれか
   */
  const insertSyndicatedNote = async (
    slug: string,
    state: 'published' | 'draft' | 'reverted' | 'deleted',
    url: string,
  ) => {
    const noteId = await insertId('INSERT INTO note (slug) VALUES (?)', slug);
    noteIds.push(noteId);
    const revisionId = await insertId(
      "INSERT INTO note_revision (note_id, title, body) VALUES (?, ?, '本文')",
      noteId,
      `${slug} の題`,
    );
    if (state !== 'draft') {
      await env.DB.prepare(
        "UPDATE note SET status = 'published', published_revision_id = ?, published_at = '2026-01-07T00:00:00.000Z' WHERE id = ?",
      )
        .bind(revisionId, noteId)
        .run();
    }
    if (state === 'reverted') {
      await env.DB.prepare("UPDATE note SET status = 'draft' WHERE id = ?").bind(noteId).run();
    }
    if (state === 'deleted') {
      await env.DB.prepare("UPDATE note SET deleted_at = '2026-02-01T00:00:00.000Z' WHERE id = ?")
        .bind(noteId)
        .run();
    }
    syndicationIds.push(
      await insertId('INSERT INTO syndication (note_id, url) VALUES (?, ?)', noteId, url),
    );
    return noteId;
  };

  const insertExternal = async (url: string) => {
    const id = await insertId(
      "INSERT INTO activity (source, url, title, published_at) VALUES ('unlisted', ?, '0018 の記事', '2026-01-08T00:00:00.000Z')",
      url,
    );
    activityIds.push(id);
    return id;
  };

  const shownExternals = async () => {
    const { results } = await env.DB.prepare(
      "SELECT item_number FROM activity_feed WHERE item_type = 'external_activity'",
    ).all<{ item_number: number }>();
    return results.map((row) => row.item_number).filter((n) => activityIds.includes(n));
  };

  let publishedNote = 0;
  let toPublished = 0;
  let toReverted = 0;
  let toDraft = 0;
  let toDeleted = 0;
  let unrelated = 0;

  beforeAll(async () => {
    publishedNote = await insertSyndicatedNote(
      'migration-0018-published',
      'published',
      'https://example.com/0018/published',
    );
    await insertSyndicatedNote('migration-0018-draft', 'draft', 'https://example.com/0018/draft');
    await insertSyndicatedNote(
      'migration-0018-deleted',
      'deleted',
      'https://example.com/0018/deleted',
    );
    toPublished = await insertExternal('https://example.com/0018/published');
    await insertSyndicatedNote(
      'migration-0018-reverted',
      'reverted',
      'https://example.com/0018/reverted',
    );
    toDraft = await insertExternal('https://example.com/0018/draft');
    toReverted = await insertExternal('https://example.com/0018/reverted');
    toDeleted = await insertExternal('https://example.com/0018/deleted');
    unrelated = await insertExternal('https://example.com/0018/unrelated');
  });

  // note.published_revision_id の外部キーは検査をトランザクションの終わりに送るので、1 回の
  // batch で転載先、版、note の順に消せる
  afterAll(async () => {
    await env.DB.batch([
      ...activityIds.map((id) => env.DB.prepare('DELETE FROM activity WHERE id = ?').bind(id)),
      ...syndicationIds.map((id) =>
        env.DB.prepare('DELETE FROM syndication WHERE id = ?').bind(id),
      ),
      ...noteIds.map((id) =>
        env.DB.prepare('DELETE FROM note_revision WHERE note_id = ?').bind(id),
      ),
      ...noteIds.map((id) => env.DB.prepare('DELETE FROM note WHERE id = ?').bind(id)),
    ]);
  });

  it('公開中の note の転載先と URL が一致する外部の activity を出さない', async () => {
    expect(await shownExternals()).not.toContain(toPublished);
  });

  it('転載した note が下書きか削除済みなら、外部の activity を出す', async () => {
    const shown = await shownExternals();
    expect(shown).toContain(toDraft);
    expect(shown).toContain(toReverted);
    expect(shown).toContain(toDeleted);
  });

  it('note を下書きに戻す・削除すると出し直し、公開し直す・元に戻すと再び除く', async () => {
    const setNote = (sql: string) => env.DB.prepare(sql).bind(publishedNote).run();
    try {
      await setNote("UPDATE note SET status = 'draft' WHERE id = ?");
      expect(await shownExternals()).toContain(toPublished);
      await setNote("UPDATE note SET status = 'published' WHERE id = ?");
      expect(await shownExternals()).not.toContain(toPublished);
      await setNote("UPDATE note SET deleted_at = '2026-02-01T00:00:00.000Z' WHERE id = ?");
      expect(await shownExternals()).toContain(toPublished);
      await setNote('UPDATE note SET deleted_at = NULL WHERE id = ?');
      expect(await shownExternals()).not.toContain(toPublished);
    } finally {
      await setNote("UPDATE note SET status = 'published', deleted_at = NULL WHERE id = ?");
    }
  });

  it('転載先と一致しない外部の activity は出す', async () => {
    expect(await shownExternals()).toContain(unrelated);
  });

  it('除外の条件も、転載先を URL の索引で引く', async () => {
    const { results } = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT * FROM activity_feed WHERE item_type = 'external_activity' AND item_number = ?",
    )
      .bind(unrelated)
      .all<{ detail: string }>();
    const details = results.map((row) => row.detail);
    expect(details).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^SEARCH y USING (COVERING )?INDEX \S+ \(url=\?\)$/),
      ]),
    );
    expect(details.filter((detail) => detail.startsWith('SCAN'))).toEqual([]);
  });
});

/**
 * 一覧のビュー activity_feed が、note と外部の activity の日時を Asia/Tokyo の時刻にして並べ、元の
 * 日時を別の列で出すこと（specs/005-feed/data-model.md の「一覧のビュー」の M5、plan.md の U3）。
 * 換算した値と元の値は、0016・0017 の腕の検査が確かめる
 */
describe('migration 0022 の activity_feed の Asia/Tokyo の並びの値', () => {
  it('created_at・published_at の列を、0017 までの列の後に持つ', async () => {
    const names = (await columnsOf('activity_feed')).map((c) => c.name);
    expect(names.slice(M1_COLUMNS.length + 4)).toEqual(['created_at', 'published_at']);
  });
});
