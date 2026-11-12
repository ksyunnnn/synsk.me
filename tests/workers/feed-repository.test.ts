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
  insertSyndication,
  publishNoteRow,
} from '../support/note-rows';
import { deleteActivityRows, insertActivity } from '../support/activity-rows';

/**
 * 一覧の Repository が、本物の migration を当てた D1 のビュー activity_feed から、サイトに載せる
 * 職歴と実績を並びの順で返し、秘匿化した行を出してよい値だけで返すこと
 * （specs/005-feed/spec.md の FR-001・FR-004・FR-007・FR-009・FR-010・FR-012、tasks.md の T011）。
 * 転載先と一致する外部の activity を除くこと（FR-016・FR-017、tasks.md の T050）。
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
  await deleteActivityRows(env.DB);
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
      slug: '0123456789abcdef0123456789abcdef',
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
        // 秘匿化した実績も個別のページを持つ（001 の spec の Edge Cases）。識別子は uid の形
        slug: '0123456789abcdef0123456789abcdef',
        imageUrl: null,
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
      "'develop'",
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
  const insertNoteCreatedAt = async (
    createdAt: string,
    title = '作り物の note の題',
    slug?: string,
  ) => {
    const note = await insertNote(env.DB, { slug, title, description: `${title}の説明文` });
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
    const published = await insertNoteCreatedAt(
      '2024-01-04T00:00:00.000Z',
      '公開の note',
      'published-note',
    );
    await publishNoteRow(env.DB, published.id);

    expect(await firstPage()).toStrictEqual([
      {
        type: 'note',
        title: '公開の note',
        description: '公開の noteの説明文',
        createdAt: '2024-01-04T00:00:00.000Z',
        slug: 'published-note',
        imageUrl: null,
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

  it('1 以上の整数でないページは項目を返さない', async () => {
    await insertProjects(3);

    for (const page of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(await feed.list(page)).toEqual({ items: [], hasNextPage: false });
    }
  });
});

describe('外部の activity と life event（tasks.md の T041）', () => {
  const insertLifeEvent = async (
    title: string,
    happenedOn: string,
    description: string | null = null,
    slug = `life-${crypto.randomUUID()}`,
  ) => {
    const id = await insertActivity(env.DB, {
      source: 'life_event',
      title,
      happenedOn,
      slug,
    });
    await env.DB.prepare('UPDATE activity SET description = ? WHERE id = ?')
      .bind(description, id)
      .run();
    return id;
  };

  it('5 つの種類が並びの日付の新しい順に並ぶ（US1 の Acceptance 1）', async () => {
    const organizationId = await insertOrganization(env.DB, { name: '作り物株式会社' });
    await insertCareer(env.DB, {
      organizationId,
      role: '職歴',
      startedOn: '2020-01-01',
      isMasked: false,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '実績',
      startedOn: '2021-01-01',
      isMasked: false,
      status: 'published',
    });
    await insertLifeEvent('life event', '2022-01-01');
    await insertActivity(env.DB, {
      source: 'zenn',
      externalId: 'fake-1',
      url: 'https://example.com/fake-1',
      title: '外部の activity',
      publishedAt: '2023-01-01T00:00:00.000Z',
    });
    const note = await insertNote(env.DB, { title: 'note' });
    await env.DB.prepare("UPDATE note SET created_at = '2024-01-01T00:00:00.000Z' WHERE id = ?")
      .bind(note.id)
      .run();
    await publishNoteRow(env.DB, note.id);

    expect((await firstPage()).map((item) => item.type)).toEqual([
      'note',
      'external_activity',
      'life_event',
      'project',
      'career',
    ]);
  });

  it('分類が埋め込みの取得元の外部の activity は、種類・分類・取得元・URL を持って並ぶ（US1 の Acceptance 4・5）', async () => {
    await insertActivity(env.DB, {
      source: 'speakerdeck',
      externalId: 'fake-slide',
      url: 'https://example.com/fake-slide',
      title: '作り物のスライド',
      publishedAt: '2023-01-01T00:00:00.000Z',
      imageUrl: 'https://example.com/fake-slide.png',
    });

    const items = await firstPage();
    expect(items).toStrictEqual([
      {
        type: 'external_activity',
        title: '作り物のスライド',
        url: 'https://example.com/fake-slide',
        publishedAt: '2023-01-01T00:00:00.000Z',
        source: 'speakerdeck',
        sourceKind: 'embed',
        // 取得元が返した画像の URL を出す（plan.md の U5 の決定）
        imageUrl: 'https://example.com/fake-slide.png',
      },
    ]);
  });

  it('保存した life event はすべて、起きた日と説明を持って並ぶ（FR-003）', async () => {
    await insertLifeEvent('1 つ目の出来事', '2019-04-01', '作り物の説明');
    await insertLifeEvent('2 つ目の出来事', '2020-04-01');
    await insertLifeEvent('3 つ目の出来事', '2021-04-01', null, 'third-life-event');

    expect(await firstPage()).toStrictEqual([
      {
        type: 'life_event',
        title: '3 つ目の出来事',
        description: null,
        happenedOn: '2021-04-01',
        source: 'life_event',
        sourceKind: 'life_event',
        slug: 'third-life-event',
        imageUrl: null,
      },
      expect.objectContaining({ title: '2 つ目の出来事', happenedOn: '2020-04-01' }),
      expect.objectContaining({
        title: '1 つ目の出来事',
        description: '作り物の説明',
        happenedOn: '2019-04-01',
      }),
    ]);
  });

  it('行を消した外部の activity は並ばない（FR-002）', async () => {
    const id = await insertActivity(env.DB, {
      source: 'qiita',
      externalId: 'fake-gone',
      url: 'https://example.com/fake-gone',
      title: '消える記事',
      publishedAt: '2023-01-01T00:00:00.000Z',
    });
    await insertActivity(env.DB, {
      source: 'qiita',
      externalId: 'fake-stay',
      url: 'https://example.com/fake-stay',
      title: '残る記事',
      publishedAt: '2023-02-01T00:00:00.000Z',
    });
    await env.DB.prepare('DELETE FROM activity WHERE id = ?').bind(id).run();

    expect(await firstPage()).toMatchObject([{ type: 'external_activity', title: '残る記事' }]);
  });
});

/**
 * 日時を Asia/Tokyo の日付で並べること（plan.md の U3。2026-11-10 にオーナーが決めた。
 * https://github.com/ksyunnnn/synsk.me/issues/219#issuecomment-6761595417 ）。ビューは note と
 * 外部の activity の日時を Asia/Tokyo の時刻にして並べ、暦の日付は換算しない（migrations/0022）。
 * 詰める日時は元の UTC の値のまま
 */
describe('Asia/Tokyo の日の境目（tasks.md の T042）', () => {
  const insertNoteCreatedAt = async (createdAt: string, title: string) => {
    const note = await insertNote(env.DB, { title });
    await env.DB.prepare('UPDATE note SET created_at = ? WHERE id = ?')
      .bind(createdAt, note.id)
      .run();
    await publishNoteRow(env.DB, note.id);
    return note;
  };

  const insertExternal = (publishedAt: string, title: string) =>
    insertActivity(env.DB, {
      source: 'zenn',
      externalId: `fake-${crypto.randomUUID()}`,
      url: `https://example.com/${crypto.randomUUID()}`,
      title,
      publishedAt,
    });

  const insertLifeEvent = (happenedOn: string, title: string) =>
    insertActivity(env.DB, {
      source: 'life_event',
      title,
      happenedOn,
      slug: `life-${crypto.randomUUID()}`,
    });

  const titles = async () =>
    (await firstPage()).map((item) => (item.type === 'career' ? item.role : item.title));

  it('UTC で前の日でも Asia/Tokyo で同じ日の note は、その日の life event より新しい位置に並び、作成日は UTC のまま', async () => {
    await insertLifeEvent('2020-04-01', '4 月 1 日の出来事');
    await insertNoteCreatedAt('2020-03-31T23:00:00.000Z', 'Asia/Tokyo で 4 月 1 日の note');

    const items = await firstPage();
    expect(items.map((item) => item.type)).toEqual(['note', 'life_event']);
    expect(items[0]).toMatchObject({ createdAt: '2020-03-31T23:00:00.000Z' });
  });

  it('外部の activity は Asia/Tokyo の 0 時で日が替わり、公開日は UTC のまま', async () => {
    await insertLifeEvent('2020-04-01', '4 月 1 日の出来事');
    await insertExternal('2020-03-31T14:59:59.999Z', 'Asia/Tokyo で 3 月 31 日の終わり');
    await insertExternal('2020-03-31T15:00:00.000Z', 'Asia/Tokyo で 4 月 1 日の始まり');

    const items = await firstPage();
    expect(items.map((item) => ('title' in item ? item.title : null))).toEqual([
      'Asia/Tokyo で 4 月 1 日の始まり',
      '4 月 1 日の出来事',
      'Asia/Tokyo で 3 月 31 日の終わり',
    ]);
    expect(items[0]).toMatchObject({ publishedAt: '2020-03-31T15:00:00.000Z' });
    expect(items[2]).toMatchObject({ publishedAt: '2020-03-31T14:59:59.999Z' });
  });

  it('オーナーが入れた日付（その日の UTC の 00:00）の外部の activity は、同じ日の life event より新しい位置に並ぶ（FR-011、0004 の sort_at の注釈）', async () => {
    await insertExternal('2020-04-01T00:00:00.000Z', 'オーナーが 4 月 1 日と入れた記事');
    await insertLifeEvent('2020-04-01', '4 月 1 日の出来事');

    expect(await titles()).toEqual(['オーナーが 4 月 1 日と入れた記事', '4 月 1 日の出来事']);
  });

  it('種類をまたいで同じ日の組が、手で並べた順に並び、2 回読んでも同じ順（SC-004・FR-010・FR-011）', async () => {
    const organizationId = await insertOrganization(env.DB, { name: '作り物株式会社' });
    const day = '2020-04-01';
    await insertCareer(env.DB, {
      organizationId,
      role: '職歴',
      startedOn: day,
      isMasked: false,
      status: 'published',
    });
    await insertProject(env.DB, {
      organizationId,
      title: '実績',
      startedOn: day,
      isMasked: false,
      status: 'published',
    });
    await insertLifeEvent(day, '先に入れた出来事');
    await insertLifeEvent(day, '後に入れた出来事');
    await insertExternal('2020-04-01T00:00:00.000Z', 'Asia/Tokyo で 9 時の記事');
    await insertNoteCreatedAt('2020-03-31T22:00:00.000Z', 'Asia/Tokyo で 7 時の note');
    await insertNoteCreatedAt('2020-04-01T03:00:00.000Z', 'Asia/Tokyo で 12 時の note');

    const expected = [
      'Asia/Tokyo で 12 時の note',
      'Asia/Tokyo で 9 時の記事',
      'Asia/Tokyo で 7 時の note',
      '後に入れた出来事',
      '先に入れた出来事',
      '実績',
      '職歴',
    ];
    expect(await titles()).toEqual(expected);
    expect(await titles()).toEqual(expected);
  });
});

describe('重なりの除外（tasks.md の T050）', () => {
  const SYNDICATED_URL = 'https://example.com/fake-syndicated';

  /** 転載先を記録した公開の note と、転載先と同じ URL の外部の activity を入れる */
  const seed = async () => {
    const note = await insertNote(env.DB, { title: '転載した note' });
    await publishNoteRow(env.DB, note.id);
    await insertSyndication(env.DB, note.id, SYNDICATED_URL);
    await insertActivity(env.DB, {
      source: 'zenn',
      externalId: 'fake-syndicated',
      url: SYNDICATED_URL,
      title: '転載先の記事',
      publishedAt: '2023-01-01T00:00:00.000Z',
    });
    return note;
  };
  const titles = async () =>
    (await firstPage()).map((item) => ('title' in item ? item.title : null));

  it('公開の note の転載先と同じ URL の外部の activity は並ばず、note は並ぶ（FR-016、SC-003、US4 の Acceptance 1）', async () => {
    await seed();

    expect(await titles()).toEqual(['転載した note']);
  });

  it('転載先と一致しない外部の activity は並ぶ（FR-017、US4 の Acceptance 2）', async () => {
    await seed();
    await insertActivity(env.DB, {
      source: 'zenn',
      externalId: 'fake-other',
      url: 'https://example.com/fake-other',
      title: '別の記事',
      publishedAt: '2023-02-01T00:00:00.000Z',
    });

    expect(await titles()).toEqual(['転載した note', '別の記事']);
  });

  it('転載先を記録した note を下書きに戻すと、同じ URL の外部の activity が並ぶ（FR-016、US4 の Acceptance 3）', async () => {
    const note = await seed();
    await env.DB.prepare("UPDATE note SET status = 'draft' WHERE id = ?").bind(note.id).run();

    expect(await titles()).toEqual(['転載先の記事']);
  });

  it('転載先を記録した note を削除すると、同じ URL の外部の activity が並ぶ（FR-016、US4 の Acceptance 3）', async () => {
    const note = await seed();
    await deleteNoteRow(env.DB, note.id);

    expect(await titles()).toEqual(['転載先の記事']);
  });

  it('一致は文字列の完全一致で比べる（plan.md の U6）', async () => {
    const note = await insertNote(env.DB, { title: '転載した note' });
    await publishNoteRow(env.DB, note.id);
    await insertSyndication(env.DB, note.id, SYNDICATED_URL);
    await insertActivity(env.DB, {
      source: 'zenn',
      externalId: 'fake-slash',
      url: `${SYNDICATED_URL}/`,
      title: '末尾にスラッシュの付いた記事',
      publishedAt: '2023-01-02T00:00:00.000Z',
    });
    await insertActivity(env.DB, {
      source: 'zenn',
      externalId: 'fake-case',
      url: SYNDICATED_URL.replace('fake', 'Fake'),
      title: '大文字と小文字の違う記事',
      publishedAt: '2023-01-01T00:00:00.000Z',
    });

    expect(await titles()).toEqual([
      '転載した note',
      '末尾にスラッシュの付いた記事',
      '大文字と小文字の違う記事',
    ]);
  });
});
