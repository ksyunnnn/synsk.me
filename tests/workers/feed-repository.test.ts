import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FEED_PAGE_SIZE } from '@/features/activity/domain/feed';
import { createD1FeedRepository } from '@/features/activity/server/d1-feed-repository';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
} from '../support/career-and-project-rows';
import {
  deleteNoteRow,
  deleteNoteRows,
  insertNote,
  insertNoteRevision,
  publishNoteRow,
} from '../support/note-rows';

/**
 * 一覧の Repository が、本物の migration を当てた D1 のビュー activity_feed から、サイトに載せる
 * 職歴と実績を並びの順で返し、秘匿化した行を出してよい値だけで返すこと
 * （specs/005-feed/spec.md の FR-001・FR-004・FR-007・FR-009・FR-010・FR-012、tasks.md の T011）。
 * 値はすべて作り物
 */

const feed = createD1FeedRepository(env.DB);

/** 1 ページ目の項目。ページ送りのほかの検査は、1 ページに収まる件数の行で確かめる */
const firstPage = async () => (await feed.list(1)).items;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteCareerAndProjectRows(env.DB);
  await deleteNoteRows(env.DB);
});

const REAL = {
  organization: '作り物の実名の会社',
  title: '作り物の実際の題',
  description: '作り物の秘密の本文',
  url: 'https://secret.example/feed',
};

describe('並びの順', () => {
  it('職歴と実績が始まりの日の新しい順に並び、終わりの日を使わない（FR-007・FR-009）', async () => {
    const organizationId = await insertOrganization(env.DB, { name: '作り物株式会社' });
    await insertCareer(env.DB, {
      organizationId,
      role: '古い職歴',
      startedOn: '2015-04-01',
      endedOn: '2025-03-31',
      isMasked: false,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '新しい実績',
      startedOn: '2022-04-01',
      endedOn: '2022-06-30',
      isMasked: false,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '終わりの日が空の実績',
      startedOn: '2018-04-01',
      endedOn: null,
      isMasked: false,
      status: 'published',
    });

    expect((await firstPage()).map((item) => 'period' in item && item.period.startedOn)).toEqual([
      '2022-04-01',
      '2018-04-01',
      '2015-04-01',
    ]);
  });

  it('同じ始まりの日は FEED_ITEM_TYPES の順、同じ種類は主キーの大きい順で、2 回読んでも同じ順（FR-010）', async () => {
    const organizationId = await insertOrganization(env.DB, { name: '作り物株式会社' });
    const day = '2020-04-01';
    await insertCareer(env.DB, {
      organizationId,
      role: '先に入れた職歴',
      startedOn: day,
      isMasked: false,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '先に入れた実績',
      startedOn: day,
      isMasked: false,
      status: 'published',
    });
    await insertCareer(env.DB, {
      organizationId,
      role: '後に入れた職歴',
      startedOn: day,
      isMasked: false,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '後に入れた実績',
      startedOn: day,
      isMasked: false,
      status: 'published',
    });

    const names = (items: Awaited<ReturnType<typeof firstPage>>) =>
      items.map((item) => (item.type === 'career' ? item.role : item.title));
    const first = names(await firstPage());
    expect(first).toEqual(['後に入れた実績', '先に入れた実績', '後に入れた職歴', '先に入れた職歴']);
    expect(names(await firstPage())).toEqual(first);
  });
});

describe('並べる行', () => {
  it('サイトに載せない職歴と実績は、秘匿化するかに関わらず並ばない（FR-004）', async () => {
    const organizationId = await insertOrganization(env.DB, {
      name: REAL.organization,
      nameMasked: 'ある会社',
    });
    for (const isMasked of [true, false]) {
      await insertCareer(env.DB, { organizationId, isMasked, status: 'draft' });
      await insertProject(env.DB, { organizationId, isMasked, status: 'draft' });
    }

    expect(await firstPage()).toEqual([]);
  });

  it('学歴は並ばない（FR-001）', async () => {
    await insertEducation(env.DB, { school: '作り物大学' });

    expect(await firstPage()).toEqual([]);
  });

  it('秘匿化した組織名の無い組織を指す秘匿化した行は並ばない（research.md の R4）', async () => {
    const organizationId = await insertOrganization(env.DB, {
      name: REAL.organization,
      nameMasked: null,
    });
    await insertCareer(env.DB, { organizationId, isMasked: true, status: 'published' });
    await insertProject(env.DB, { organizationId, isMasked: true, status: 'published' });
    await insertProject(env.DB, {
      organizationId,
      title: '秘匿化しない実績',
      isMasked: false,
      status: 'published',
    });

    expect(await firstPage()).toEqual([
      expect.objectContaining({ type: 'project', isMasked: false, title: '秘匿化しない実績' }),
    ]);
  });
});

describe('秘匿化', () => {
  it('秘匿化した職歴と実績は、秘匿化した題と秘匿化した組織名で並び、実際の値を持たない（FR-012）', async () => {
    const organizationId = await insertOrganization(env.DB, {
      name: REAL.organization,
      nameMasked: 'ある会社',
    });
    await insertCareer(env.DB, {
      organizationId,
      role: '作り物の肩書',
      startedOn: '2019-04-01',
      endedOn: '2021-03-31',
      description: REAL.description,
      url: REAL.url,
      isMasked: true,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      kind: 'talk',
      title: REAL.title,
      titleMasked: '業務システムの開発',
      startedOn: '2020-04-01',
      description: REAL.description,
      url: REAL.url,
      isMasked: true,
      status: 'published',
    });

    const items = await firstPage();
    expect(items).toStrictEqual([
      {
        type: 'project',
        isMasked: true,
        title: '業務システムの開発',
        organizationName: 'ある会社',
        projectKind: 'talk',
        period: { startedOn: '2020-04-01', endedOn: null },
      },
      {
        type: 'career',
        isMasked: true,
        organizationName: 'ある会社',
        role: '作り物の肩書',
        period: { startedOn: '2019-04-01', endedOn: '2021-03-31' },
      },
    ]);
    const text = JSON.stringify(items);
    for (const value of Object.values(REAL)) expect(text).not.toContain(value);
  });

  it('秘匿化しない職歴と実績は、実際の題と実際の組織名で並ぶ（FR-014）', async () => {
    const organizationId = await insertOrganization(env.DB, {
      name: '作り物株式会社',
      nameMasked: 'ある会社',
    });
    await insertCareer(env.DB, {
      organizationId,
      role: '作り物の肩書',
      startedOn: '2019-04-01',
      isMasked: false,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '作り物の受託開発',
      startedOn: '2020-04-01',
      isMasked: false,
      status: 'published',
    });

    expect(await firstPage()).toMatchObject([
      {
        type: 'project',
        isMasked: false,
        title: '作り物の受託開発',
        organizationName: '作り物株式会社',
      },
      { type: 'career', isMasked: false, organizationName: '作り物株式会社' },
    ]);
  });
});

describe('詰められない種類', () => {
  it('FEED_ITEM_TYPES に無い種類の行がビューにあっても返さない（data-model.md の「アプリケーションが守る決まり」）', async () => {
    const organizationId = await insertOrganization(env.DB, { name: '作り物株式会社' });
    await insertProject(env.DB, {
      organizationId,
      title: '作り物の受託開発',
      isMasked: false,
      status: 'published',
    });

    // 腕を足す migration が、その種類を詰める実装より先に入った状態を作る。検査の後に元に戻す
    const original = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'activity_feed'",
    ).first<{ sql: string }>();
    if (!original) throw new Error('ビュー activity_feed が無い');
    // 0013 の列に値を置き、後の migration が足した列は NULL で埋める。D1 は 1 つの compound
    // SELECT の腕の数に上限を持ち、腕を 1 つ足すと超えるので、元のビューを副問い合わせにして足す
    const { results: columns } = await env.DB.prepare('SELECT name FROM pragma_table_info(?)')
      .bind('activity_feed')
      .all<{ name: string }>();
    const m1Values = [
      "'unknown_type'",
      '1',
      "'2099-01-01'",
      '0',
      "'詰められない種類の題'",
      'NULL',
      "'作り物株式会社'",
      'NULL',
      "'作り物の肩書'",
      "'application'",
      "'2099-01-01'",
      'NULL',
    ];
    const values = columns.map((_, i) => m1Values[i] ?? 'NULL');
    const unknownArm = `UNION ALL SELECT ${values.join(', ')}`;
    await env.DB.batch([
      env.DB.prepare('DROP VIEW activity_feed'),
      env.DB.prepare(
        `CREATE VIEW activity_feed AS SELECT * FROM (${original.sql.replace(/^CREATE VIEW activity_feed AS/, '')}) ${unknownArm}`,
      ),
    ]);
    try {
      expect(await firstPage()).toEqual([
        expect.objectContaining({ type: 'project', title: '作り物の受託開発' }),
      ]);
    } finally {
      await env.DB.batch([env.DB.prepare('DROP VIEW activity_feed'), env.DB.prepare(original.sql)]);
    }
  });
});

describe('note（tasks.md の T021）', () => {
  /** note を作り、作成日を決まった日時にする。作成日は公開の操作で変わらない列（0012） */
  const insertNoteCreatedAt = async (createdAt: string, title = '作り物の note の題') => {
    const note = await insertNote(env.DB, { title, description: `${title}の説明文` });
    await env.DB.prepare('UPDATE note SET created_at = ? WHERE id = ?')
      .bind(createdAt, note.id)
      .run();
    return note;
  };

  const unpublish = (noteId: number) =>
    env.DB.prepare("UPDATE note SET status = 'draft' WHERE id = ?").bind(noteId).run();

  it('下書き・削除・下書きに戻した note は並ばない（FR-005、US3 の Acceptance 1〜3）', async () => {
    await insertNoteCreatedAt('2024-01-01T00:00:00.000Z', '下書きの note');
    const deleted = await insertNoteCreatedAt('2024-01-02T00:00:00.000Z', '削除した note');
    await publishNoteRow(env.DB, deleted.id);
    await deleteNoteRow(env.DB, deleted.id);
    const unpublished = await insertNoteCreatedAt(
      '2024-01-03T00:00:00.000Z',
      '下書きに戻した note',
    );
    await publishNoteRow(env.DB, unpublished.id);
    await unpublish(unpublished.id);
    const published = await insertNoteCreatedAt('2024-01-04T00:00:00.000Z', '公開の note');
    await publishNoteRow(env.DB, published.id);

    expect(await firstPage()).toStrictEqual([
      {
        type: 'note',
        title: '公開の note',
        description: '公開の noteの説明文',
        createdAt: '2024-01-04T00:00:00.000Z',
      },
    ]);
  });

  it('公開した後に題を直して保存した note は、公開した版の題と説明文で並ぶ（FR-006、US3 の Acceptance 4）', async () => {
    const note = await insertNoteCreatedAt('2024-01-01T00:00:00.000Z', '公開した版の題');
    await publishNoteRow(env.DB, note.id);
    await insertNoteRevision(env.DB, note.id, {
      title: '保存しただけの版の題',
      description: '保存しただけの版の説明文',
    });

    const items = await firstPage();
    expect(items).toMatchObject([
      { type: 'note', title: '公開した版の題', description: '公開した版の題の説明文' },
    ]);
    expect(JSON.stringify(items)).not.toContain('保存しただけの版');
  });

  it('作成日の位置に並び、公開し直しても下書きから公開に戻しても位置が変わらない（FR-007・FR-008、US1 の Acceptance 2）', async () => {
    const organizationId = await insertOrganization(env.DB, { name: '作り物株式会社' });
    await insertCareer(env.DB, {
      organizationId,
      role: '2019 年の職歴',
      startedOn: '2019-04-01',
      isMasked: false,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '2022 年の実績',
      startedOn: '2022-04-01',
      isMasked: false,
      status: 'published',
    });
    const note = await insertNoteCreatedAt('2020-01-15T00:00:00.000Z', '2020 年に作った note');
    await publishNoteRow(env.DB, note.id, '2025-03-01T00:00:00.000Z');

    const order = async () =>
      (await firstPage()).map((item) => (item.type === 'career' ? item.role : item.title));
    const expected = ['2022 年の実績', '2020 年に作った note', '2019 年の職歴'];
    expect(await order()).toEqual(expected);

    await insertNoteRevision(env.DB, note.id, { title: '2020 年に作った note' });
    await publishNoteRow(env.DB, note.id, '2025-06-01T00:00:00.000Z');
    expect(await order()).toEqual(expected);

    await unpublish(note.id);
    await publishNoteRow(env.DB, note.id, '2025-09-01T00:00:00.000Z');
    expect(await order()).toEqual(expected);
  });
});

describe('ページ送り（tasks.md の T031）', () => {
  /** 始まりの日を 1 日ずつずらした実績を入れる。i が大きいほど新しい */
  const insertProjects = async (count: number) => {
    const organizationId = await insertOrganization(env.DB, { name: '作り物株式会社' });
    for (let i = 0; i < count; i++) {
      const day = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
      await insertProject(env.DB, {
        organizationId,
        title: `実績 ${i}`,
        startedOn: day,
        isMasked: false,
        status: 'published',
      });
    }
  };
  const titles = (items: Awaited<ReturnType<typeof firstPage>>) =>
    items.map((item) => ('title' in item ? item.title : ''));

  it('番号のページで区切り、ページをつなぐと 1 つの並びになる（research.md の R8）', async () => {
    await insertProjects(FEED_PAGE_SIZE + 3);

    const first = await feed.list(1);
    const second = await feed.list(2);
    expect(first.items).toHaveLength(FEED_PAGE_SIZE);
    expect(first.hasNextPage).toBe(true);
    expect(second.items).toHaveLength(3);
    expect(second.hasNextPage).toBe(false);

    const expected = Array.from(
      { length: FEED_PAGE_SIZE + 3 },
      (_, i) => `実績 ${FEED_PAGE_SIZE + 2 - i}`,
    );
    expect([...titles(first.items), ...titles(second.items)]).toEqual(expected);
  });

  it('件数がちょうど 1 ページのとき、次のページは無い', async () => {
    await insertProjects(FEED_PAGE_SIZE);

    expect(await feed.list(1)).toMatchObject({ hasNextPage: false });
  });

  it('最後のページの先では項目を返さない', async () => {
    await insertProjects(3);

    expect(await feed.list(2)).toEqual({ items: [], hasNextPage: false });
    expect(await feed.list(100)).toEqual({ items: [], hasNextPage: false });
  });
});
