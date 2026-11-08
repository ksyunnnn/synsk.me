import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FEED_PAGE_SIZE, type FeedItem } from '@/features/activity/domain/feed';
import {
  createD1FeedRepository,
  FEED_PAGE_SQL,
} from '@/features/activity/server/d1-feed-repository';
import {
  deleteActivityRows,
  insertExternalActivity,
  insertLifeEvent,
} from '../support/activity-rows';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
  insertSkill,
  linkProjectSkill,
} from '../support/career-and-project-rows';
import { deleteNoteRows, insertNote } from '../support/note-rows';

/**
 * 一覧のビュー `activity_feed`（migrations/0025）と、それを読む Repository の実装
 * （specs/005-feed/spec.md、data-model.md）。値はすべて作り物
 */

const feed = createD1FeedRepository(env.DB);

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteNoteRows(env.DB);
  await deleteActivityRows(env.DB);
  await deleteCareerAndProjectRows(env.DB);
});

const firstPage = async () => (await feed.listPage(1)).items;

const keyOf = (item: FeedItem) => `${item.type}:${item.id}`;

/** 公開の note を入れ、作成日を `createdAt`（UTC の日時）にする */
const publishedNote = async (slug: string, createdAt: string, title = `作り物の ${slug}`) => {
  const { id } = await insertNote(env.DB, {
    slug,
    revisions: [{ title, body: '作り物の本文' }],
    publishedRevision: 1,
  });
  await env.DB.prepare('UPDATE note SET created_at = ? WHERE id = ?').bind(createdAt, id).run();
  return id;
};

const REAL = {
  organization: '作り物の取引先株式会社',
  title: '作り物の受託開発',
  description: '作り物の秘密の本文',
  url: 'https://example.com/fake-secret',
};

describe('User Story 1: 5 つの種類を 1 つの並びで読む', () => {
  it('並びの日付の新しい順に、note・外部の activity・life event・実績・職歴が並ぶ（User Story 1 の 1）', async () => {
    const organizationId = await insertOrganization(env.DB);
    const noteId = await publishedNote('fake-note', '2025-01-20T00:00:00.000Z');
    const externalId = await insertExternalActivity(env.DB, {
      publishedAt: '2024-05-10T00:00:00.000Z',
    });
    const lifeEventId = await insertLifeEvent(env.DB, { happenedOn: '2023-04-01' });
    const projectId = await insertProject(env.DB, {
      organizationId,
      startedOn: '2022-10-01',
      status: 'published',
    });
    const careerId = await insertCareer(env.DB, {
      organizationId,
      startedOn: '2021-04-01',
      status: 'published',
    });

    expect((await firstPage()).map(keyOf)).toEqual([
      `note:${noteId}`,
      `external_activity:${externalId}`,
      `life_event:${lifeEventId}`,
      `project:${projectId}`,
      `career:${careerId}`,
    ]);
  });

  it('note は作成日、実績は始まりの日で並ぶ（User Story 1 の 2・3、FR-007〜FR-009）', async () => {
    const organizationId = await insertOrganization(env.DB);
    // 2020-01-15 に作り、2026-11-01 に初めて公開した note（insertNote が公開日時を入れる）
    const noteId = await publishedNote('fake-old-note', '2020-01-15T00:00:00.000Z');
    const projectId = await insertProject(env.DB, {
      organizationId,
      startedOn: '2022-10-01',
      endedOn: '2024-03-31',
      status: 'published',
    });
    const lifeEventId = await insertLifeEvent(env.DB, { happenedOn: '2023-01-01' });

    const items = await firstPage();
    expect(items.map(keyOf)).toEqual([
      `life_event:${lifeEventId}`,
      `project:${projectId}`,
      `note:${noteId}`,
    ]);
    expect(items.find((i) => i.type === 'note')?.date).toBe('2020-01-15');
  });

  it('同じ並びの日付の組は種類と番号で順が決まり、2 回読んでも同じ順になる（FR-010・SC-004）', async () => {
    const organizationId = await insertOrganization(env.DB);
    const p1 = await insertProject(env.DB, {
      organizationId,
      startedOn: '2022-04-01',
      status: 'published',
    });
    const p2 = await insertProject(env.DB, {
      organizationId,
      startedOn: '2022-04-01',
      status: 'published',
    });
    const c1 = await insertCareer(env.DB, {
      organizationId,
      startedOn: '2022-04-01',
      status: 'published',
    });
    const l1 = await insertLifeEvent(env.DB, { happenedOn: '2022-04-01' });
    // 日本時間の 2022-04-01 09:00
    const e1 = await insertExternalActivity(env.DB, { publishedAt: '2022-04-01T00:00:00.000Z' });
    const n1 = await publishedNote('fake-same-day', '2022-04-01T00:00:00.000Z');

    const expected = [
      // 日時を持つ 2 件が先。同じ日時の中では note・外部の activity の順
      `note:${n1}`,
      `external_activity:${e1}`,
      // 暦の日付の 4 件。life event・実績・職歴の順、同じ種類は番号の大きい順
      `life_event:${l1}`,
      `project:${Math.max(p1, p2)}`,
      `project:${Math.min(p1, p2)}`,
      `career:${c1}`,
    ];
    expect((await firstPage()).map(keyOf)).toEqual(expected);
    expect((await firstPage()).map(keyOf)).toEqual(expected);
  });

  it('同じ日の life event は、その日の外部の activity より古く並ぶ。日の境目は日本時間（FR-011、research.md の R4）', async () => {
    const lifeEventId = await insertLifeEvent(env.DB, { happenedOn: '2024-05-10' });
    // 日本時間の 2024-05-10 08:00。UTC では 2024-05-09
    const morning = await insertExternalActivity(env.DB, {
      publishedAt: '2024-05-09T23:00:00.000Z',
    });
    // 日本時間の 2024-05-09 23:59
    const previousDay = await insertExternalActivity(env.DB, {
      publishedAt: '2024-05-09T14:59:00.000Z',
    });

    const items = await firstPage();
    expect(items.map(keyOf)).toEqual([
      `external_activity:${morning}`,
      `life_event:${lifeEventId}`,
      `external_activity:${previousDay}`,
    ]);
    expect(items[0]?.date).toBe('2024-05-10');
  });

  it('外部の activity は取得元の URL と分類を持つ（User Story 1 の 4・5、FR-019・FR-020）', async () => {
    await insertExternalActivity(env.DB, {
      source: 'x_post',
      url: 'https://example.com/fake-post',
    });
    expect(await firstPage()).toEqual([
      expect.objectContaining({
        type: 'external_activity',
        url: 'https://example.com/fake-post',
        source: 'x_post',
        sourceKind: 'embed',
      }),
    ]);
  });

  it('学歴は並ばない（User Story 1 の 6、FR-001・SC-005）', async () => {
    await insertEducation(env.DB, { school: '作り物大学' });
    expect(await firstPage()).toEqual([]);
  });

  it('サイトに載せない実績と職歴は並ばない（User Story 1 の 7、FR-004・SC-006）', async () => {
    const organizationId = await insertOrganization(env.DB);
    for (const isMasked of [true, false]) {
      await insertProject(env.DB, { organizationId, isMasked, status: 'draft' });
      await insertCareer(env.DB, { organizationId, isMasked, status: 'draft' });
    }
    expect(await firstPage()).toEqual([]);
  });

  it('1 ページは 50 件で、51 件目があれば次のページがある（research.md の R7）', async () => {
    const statements = Array.from({ length: FEED_PAGE_SIZE + 1 }, (_, i) =>
      env.DB.prepare(
        "INSERT INTO activity (source, slug, title, happened_on) VALUES ('life_event', ?, '作り物', ?)",
      ).bind(`fake-page-${i}`, `2000-01-${String((i % 28) + 1).padStart(2, '0')}`),
    );
    await env.DB.batch(statements);

    const first = await feed.listPage(1);
    expect(first.items).toHaveLength(FEED_PAGE_SIZE);
    expect(first.hasNext).toBe(true);
    const second = await feed.listPage(2);
    expect(second.items).toHaveLength(1);
    expect(second.hasNext).toBe(false);
    const keys = new Set([...first.items, ...second.items].map(keyOf));
    expect(keys.size).toBe(FEED_PAGE_SIZE + 1);
    expect((await feed.listPage(3)).items).toEqual([]);
  });

  it('1 ページを読むときにスキャンする行数を測る（research.md の R13）', async () => {
    const organizationId = await insertOrganization(env.DB);
    await publishedNote('fake-scan', '2025-01-20T00:00:00.000Z');
    await insertExternalActivity(env.DB);
    await insertLifeEvent(env.DB);
    await insertProject(env.DB, { organizationId, status: 'published' });
    await insertCareer(env.DB, { organizationId, status: 'published' });

    const { meta, results } = await env.DB.prepare(FEED_PAGE_SQL)
      .bind(FEED_PAGE_SIZE + 1, 0)
      .all();
    expect(results).toHaveLength(5);
    // 5 種類を 1 件ずつ入れた D1 での値。ビューか文か migration の行を変えたら測り直す
    // （research.md の R13）
    expect(meta.rows_read).toBe(18);
  });
});

describe('User Story 2: 秘匿化した職歴・実績を、出してよい値だけで並べる', () => {
  const seedMasked = async () => {
    const organizationId = await insertOrganization(env.DB, {
      name: REAL.organization,
      nameMasked: 'ある会社',
    });
    const skillId = await insertSkill(env.DB, { name: 'TypeScript' });
    const projectId = await insertProject(env.DB, {
      organizationId,
      title: REAL.title,
      titleMasked: '業務システムの開発',
      description: REAL.description,
      url: REAL.url,
      isMasked: true,
      status: 'published',
    });
    await linkProjectSkill(env.DB, projectId, skillId);
    const careerId = await insertCareer(env.DB, {
      organizationId,
      role: '作り物の肩書',
      description: REAL.description,
      url: REAL.url,
      isMasked: true,
      status: 'published',
    });
    return { organizationId, projectId, careerId };
  };

  it('秘匿化した実績は秘匿化した題と組織名で並び、スキルを持つ（User Story 2 の 1、FR-012）', async () => {
    const { projectId } = await seedMasked();
    const project = (await firstPage()).find((i) => i.type === 'project');
    expect(project).toEqual({
      type: 'project',
      id: projectId,
      date: '2021-04-01',
      slug: expect.any(String),
      title: '業務システムの開発',
      organizationName: 'ある会社',
      projectKind: 'application',
      period: { startedOn: '2021-04-01', endedOn: null },
      skills: ['TypeScript'],
      isMasked: true,
    });
  });

  it('秘匿化した実績と職歴の行に、実際の題・組織名・本文・URL が無い（User Story 2 の 2・3、FR-013・SC-001）', async () => {
    await seedMasked();
    const text = JSON.stringify(await firstPage());
    for (const value of Object.values(REAL)) expect(text).not.toContain(value);

    // ビューの行そのものも持たない
    const { results } = await env.DB.prepare('SELECT * FROM activity_feed').all();
    const raw = JSON.stringify(results);
    for (const value of Object.values(REAL)) expect(raw).not.toContain(value);
  });

  it('秘匿化した職歴は秘匿化した組織名・期間・肩書で並ぶ（User Story 2 の 3）', async () => {
    const { careerId } = await seedMasked();
    expect((await firstPage()).find((i) => i.type === 'career')).toEqual({
      type: 'career',
      id: careerId,
      date: '2020-04-01',
      organizationName: 'ある会社',
      role: '作り物の肩書',
      period: { startedOn: '2020-04-01', endedOn: null },
      isMasked: true,
    });
  });

  it('秘匿化した組織名の無い組織を指す秘匿化した実績と職歴は並ばない（001 の plan.md の U2）', async () => {
    const organizationId = await insertOrganization(env.DB, {
      name: REAL.organization,
      nameMasked: null,
    });
    await insertProject(env.DB, { organizationId, isMasked: true, status: 'published' });
    await insertCareer(env.DB, { organizationId, isMasked: true, status: 'published' });
    expect(await firstPage()).toEqual([]);
  });

  it('秘匿化しない実績と職歴は実際の値で並び、組織名を直すと直した名前で並ぶ（User Story 2 の 4・5、FR-014・FR-021）', async () => {
    const organizationId = await insertOrganization(env.DB, {
      name: '作り物の自社',
      nameMasked: 'ある会社',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '作り物の個人開発',
      isMasked: false,
      status: 'published',
    });
    await insertCareer(env.DB, { organizationId, isMasked: false, status: 'published' });

    expect((await firstPage()).map((i) => 'organizationName' in i && i.organizationName)).toEqual([
      '作り物の自社',
      '作り物の自社',
    ]);
    expect((await firstPage()).find((i) => i.type === 'project')).toMatchObject({
      title: '作り物の個人開発',
      isMasked: false,
    });

    await env.DB.prepare('UPDATE organization SET name = ? WHERE id = ?')
      .bind('作り物の自社（直した名前）', organizationId)
      .run();
    expect((await firstPage()).map((i) => 'organizationName' in i && i.organizationName)).toEqual([
      '作り物の自社（直した名前）',
      '作り物の自社（直した名前）',
    ]);
  });
});

describe('User Story 3: 公開の note だけを並べる', () => {
  it('下書き・削除・下書きに戻した note は並ばない（User Story 3 の 1〜3、FR-005・SC-002）', async () => {
    await insertNote(env.DB, {
      slug: 'fake-draft',
      revisions: [{ title: '作り物の下書き', body: 'b' }],
    });
    await insertNote(env.DB, {
      slug: 'fake-deleted',
      revisions: [{ title: '作り物の削除', body: 'b' }],
      publishedRevision: 1,
      deleted: true,
    });
    await insertNote(env.DB, {
      slug: 'fake-unpublished',
      revisions: [{ title: '作り物の取り下げ', body: 'b' }],
      publishedRevision: 1,
      unpublished: true,
    });
    const { id } = await insertNote(env.DB, {
      slug: 'fake-published',
      revisions: [{ title: '作り物の公開', body: 'b' }],
      publishedRevision: 1,
    });

    expect((await firstPage()).map(keyOf)).toEqual([`note:${id}`]);
    const text = JSON.stringify(await firstPage());
    for (const title of ['作り物の下書き', '作り物の削除', '作り物の取り下げ'])
      expect(text).not.toContain(title);
  });

  it('公開した後に保存した版の題と説明文は並ばない（User Story 3 の 4、FR-006）', async () => {
    await insertNote(env.DB, {
      slug: 'fake-revised',
      revisions: [
        { title: '作り物の公開した題', description: '作り物の公開した説明', body: 'b' },
        { title: '作り物の直した題', description: '作り物の直した説明', body: 'b' },
      ],
      publishedRevision: 1,
    });
    const [note] = await firstPage();
    expect(note).toMatchObject({
      type: 'note',
      title: '作り物の公開した題',
      description: '作り物の公開した説明',
    });
    expect(JSON.stringify(note)).not.toContain('作り物の直した');
  });
});

describe('User Story 4: 転載した note と、転載先から取り込んだ同じ記事を重ねない', () => {
  const SYNDICATED = 'https://example.com/fake-syndicated';

  const seed = async () => {
    const { id: noteId } = await insertNote(env.DB, {
      slug: 'fake-posse',
      revisions: [{ title: '作り物の転載した note', body: 'b' }],
      publishedRevision: 1,
    });
    await env.DB.prepare('INSERT INTO syndication (note_id, url) VALUES (?, ?)')
      .bind(noteId, SYNDICATED)
      .run();
    const syndicatedId = await insertExternalActivity(env.DB, {
      source: 'zenn_article',
      url: SYNDICATED,
    });
    const otherId = await insertExternalActivity(env.DB, {
      source: 'zenn_article',
      url: `${SYNDICATED}/`,
    });
    return { noteId, syndicatedId, otherId };
  };

  it('転載先と一致する外部の activity は並ばず、一致しないものは並ぶ（User Story 4 の 1・2、FR-016・FR-017・SC-003）', async () => {
    const { noteId, syndicatedId, otherId } = await seed();
    const keys = (await firstPage()).map(keyOf);
    expect(keys).toContain(`note:${noteId}`);
    expect(keys).not.toContain(`external_activity:${syndicatedId}`);
    // 末尾のスラッシュが違う URL は一致とみなさない（research.md の R6）
    expect(keys).toContain(`external_activity:${otherId}`);
  });

  it.each([
    ['下書きに戻す', "UPDATE note SET status = 'draft' WHERE id = ?"],
    ['削除する', "UPDATE note SET deleted_at = '2026-11-02T00:00:00.000Z' WHERE id = ?"],
  ])(
    '転載元の note を%sと、転載先と一致する外部の activity が並ぶ（User Story 4 の 3）',
    async (_name, sql) => {
      const { noteId, syndicatedId } = await seed();
      await env.DB.prepare(sql).bind(noteId).run();
      const keys = (await firstPage()).map(keyOf);
      expect(keys).not.toContain(`note:${noteId}`);
      expect(keys).toContain(`external_activity:${syndicatedId}`);
    },
  );
});
