import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SOURCES } from '@/features/activity/domain/sources';
import { createD1ActivityRepository } from '@/features/activity/server/d1-activity-repository';
import {
  deleteActivityRows,
  insertActivity,
  insertLifeEvent,
  readActivityRows,
  readFetchResult,
} from '../support/activity-rows';

/**
 * `ActivityRepository` の D1 の実装を、本番と同じ `migrations/` を当てた D1 で確かめる
 * （specs/004-external-activity/research.md の R4・R5・R13、FR-002・FR-008・FR-013・FR-016・FR-032）。
 * 値はすべて作り物
 */

const activities = createD1ActivityRepository(env.DB);

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';
const PUBLISHED = '2025-01-01T00:00:00.000Z';

const item = (n: number, overrides = {}) => ({
  url: `https://zenn.dev/ksyunnnn/articles/fake${n}`,
  title: `作り物の記事 ${n}`,
  publishedAt: PUBLISHED,
  ...overrides,
});

const insertsOnly = (inserts: ReturnType<typeof item>[]) => ({
  inserts,
  updates: [],
  skippedWithoutDate: 0,
});

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteActivityRows(env.DB);
});

describe('取得元の表', () => {
  it('src/features/activity/domain/sources.ts の取得元は、どれも activity_source の行にある（FR-002）', async () => {
    const { results } = await env.DB.prepare('SELECT source FROM activity_source').all<{
      source: string;
    }>();
    const stored = results.map((row) => row.source);

    expect(stored).toEqual(expect.arrayContaining(Object.keys(SOURCES)));
  });
});

describe('applyRefresh', () => {
  it('足す行と取得の結果を書き、取得元は activity_source の取得元になる', async () => {
    await activities.applyRefresh('zenn', insertsOnly([item(1)]), { fetchedAt: T1, reason: null });

    expect(await readActivityRows(env.DB, 'zenn')).toMatchObject([
      {
        external_id: null,
        url: 'https://zenn.dev/ksyunnnn/articles/fake1',
        title: '作り物の記事 1',
        published_at: PUBLISHED,
        image_url: null,
      },
    ]);
    expect(await readFetchResult(env.DB, 'zenn')).toEqual({
      fetched_at: T1,
      is_ok: 1,
      reason: null,
      last_succeeded_at: T1,
    });
  });

  it('直す行は渡した列だけを書き換え、初めて取り込んだ日時を変えない（FR-013）', async () => {
    const id = await insertActivity(env.DB, {
      source: 'qiita',
      externalId: 'fake1',
      url: 'https://qiita.com/ksyunnnn/items/fake1',
      title: '前の題',
      publishedAt: PUBLISHED,
      imageUrl: 'https://example.com/fake.png',
      createdAt: T1,
    });

    await activities.applyRefresh(
      'qiita',
      { inserts: [], updates: [{ id, changes: { title: '直した題' } }], skippedWithoutDate: 0 },
      { fetchedAt: T2, reason: null },
    );

    expect(await readActivityRows(env.DB, 'qiita')).toEqual([
      {
        id,
        external_id: 'fake1',
        url: 'https://qiita.com/ksyunnnn/items/fake1',
        title: '直した題',
        published_at: PUBLISHED,
        image_url: 'https://example.com/fake.png',
        created_at: T1,
      },
    ]);
  });

  it('取得の書き込みは、ほかの取得元の行と life event の行を書き換えない（FR-032）', async () => {
    const lifeEventId = await insertLifeEvent(env.DB);
    const otherId = await insertActivity(env.DB, {
      source: 'medium',
      externalId: 'https://medium.com/p/fake',
      url: 'https://medium.com/fake',
      title: '作り物',
      publishedAt: PUBLISHED,
    });

    await activities.applyRefresh(
      'zenn',
      {
        inserts: [],
        updates: [
          { id: lifeEventId, changes: { title: '書き換えた' } },
          { id: otherId, changes: { title: '書き換えた' } },
        ],
        skippedWithoutDate: 0,
      },
      { fetchedAt: T1, reason: null },
    );

    const titles = await env.DB.prepare('SELECT title FROM activity ORDER BY id').all<{
      title: string;
    }>();
    expect(titles.results.map((row) => row.title)).toEqual(['作り物の出来事', '作り物']);
  });

  it('1 文でも失敗したら、足す行も取得の結果も書かずに投げる（R4）', async () => {
    await expect(
      activities.applyRefresh('zenn', insertsOnly([item(1), item(1)]), {
        fetchedAt: T1,
        reason: null,
      }),
    ).rejects.toThrow();

    expect(await readActivityRows(env.DB, 'zenn')).toEqual([]);
    expect(await readFetchResult(env.DB, 'zenn')).toBeNull();
  });

  it('同じ項目を取り直しても行が増えない（FR-008。同じ URL は UNIQUE が拒む）', async () => {
    await activities.applyRefresh('zenn', insertsOnly([item(1)]), { fetchedAt: T1, reason: null });
    const [stored] = await activities.listStoredForRefresh('zenn');

    await activities.applyRefresh(
      'zenn',
      { inserts: [], updates: [], skippedWithoutDate: 0 },
      { fetchedAt: T2, reason: null },
    );

    expect(await readActivityRows(env.DB, 'zenn')).toHaveLength(1);
    expect(stored).toEqual({
      id: expect.any(Number),
      externalId: null,
      url: 'https://zenn.dev/ksyunnnn/articles/fake1',
      title: '作り物の記事 1',
      publishedAt: PUBLISHED,
      imageUrl: null,
    });
  });
});

describe('listStoredForRefresh', () => {
  it('その取得元の行だけを返す', async () => {
    await insertLifeEvent(env.DB);
    await insertActivity(env.DB, {
      source: 'zenn',
      url: 'https://zenn.dev/a',
      publishedAt: PUBLISHED,
    });
    await insertActivity(env.DB, {
      source: 'medium',
      url: 'https://medium.com/a',
      publishedAt: PUBLISHED,
    });

    const stored = await activities.listStoredForRefresh('zenn');

    expect(stored.map((row) => row.url)).toEqual(['https://zenn.dev/a']);
  });
});

describe('recordFetchFailure', () => {
  it('失敗と理由を書き、最後に成功した日時を残す（FR-016）', async () => {
    await activities.applyRefresh('zenn', insertsOnly([]), { fetchedAt: T1, reason: null });

    await activities.recordFetchFailure('zenn', T2, '作り物の失敗');

    expect(await readFetchResult(env.DB, 'zenn')).toEqual({
      fetched_at: T2,
      is_ok: 0,
      reason: '作り物の失敗',
      last_succeeded_at: T1,
    });
  });
});

describe('listFetchedAt', () => {
  it('取得元ごとの最後に取り直した日時を返す。成否を問わない（research.md の R9）', async () => {
    await activities.applyRefresh('zenn', insertsOnly([]), { fetchedAt: T1, reason: null });
    await activities.recordFetchFailure('medium', T2, '作り物の失敗');

    expect(await activities.listFetchedAt()).toEqual({ zenn: T1, medium: T2 });
  });
});
