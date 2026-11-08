import { describe, expect, it, vi } from 'vitest';
import { refreshRegistered } from '@/features/activity/application/refresh-registered';
import { refreshSource } from '@/features/activity/application/refresh-source';
import {
  cycleAt,
  runScheduledFetch,
  slotAt,
} from '@/features/activity/application/run-scheduled-fetch';
import type { ActivityRepository } from '@/features/activity/domain/activity-repository';
import type { FetchedItem, FetchOutcome } from '@/features/activity/domain/fetched-item';

/**
 * 取得のユースケース（specs/004-external-activity/spec.md の User Story 1〜3・FR-012・FR-014・
 * FR-015、contracts/fetch.md）。Repository と取得元は作り物で、値はすべて作り物
 */

const NOW = new Date('2026-11-09T00:00:00.000Z');

const fakeActivities = (overrides: Partial<ActivityRepository> = {}): ActivityRepository => ({
  listStoredKeys: vi.fn(async () => []),
  applyFetch: vi.fn(async (_source, write) => ({
    written: write.items.length,
    removed: write.removeIds.length,
  })),
  recordFetchResult: vi.fn(async () => {}),
  listFetchResults: vi.fn(async () => []),
  list: vi.fn(async () => []),
  findForEdit: vi.fn(async () => null),
  findIdByUid: vi.fn(async () => null),
  register: vi.fn(),
  edit: vi.fn(),
  delete: vi.fn(),
  listRefreshTargets: vi.fn(async () => []),
  applyRefresh: vi.fn(async () => {}),
  ...overrides,
});

const item = (n: number): FetchedItem => ({
  externalId: null,
  url: `https://zenn.dev/ksyunnnn/articles/fake-${n}`,
  title: `作り物の記事 ${n}`,
  publishedAt: `2026-0${n}-01T00:00:00.000Z`,
  imageUrl: null,
});

describe('refreshSource', () => {
  it('取得に失敗したら、取得の結果に失敗を書き、activity を書き換えない（FR-014・SC-002）', async () => {
    const activities = fakeActivities();
    const outcome = await refreshSource(
      {
        activities,
        fetchList: async () => ({ ok: false, reason: '状態 503 を返した' }),
        checkUrl: vi.fn(),
      },
      'zenn_article',
      NOW,
    );
    expect(outcome).toEqual({ status: 'failed', reason: '状態 503 を返した' });
    expect(activities.recordFetchResult).toHaveBeenCalledWith('zenn_article', {
      fetchedAt: NOW.toISOString(),
      isOk: false,
      reason: '状態 503 を返した',
    });
    expect(activities.applyFetch).not.toHaveBeenCalled();
  });

  it('取れた項目を書き、取得の結果を成功として書く（FR-006）', async () => {
    const activities = fakeActivities();
    const fetched: FetchOutcome = { ok: true, items: [item(1)], isComplete: false, skipped: 0 };
    await refreshSource(
      { activities, fetchList: async () => fetched, checkUrl: vi.fn() },
      'zenn_article',
      NOW,
    );
    expect(activities.applyFetch).toHaveBeenCalledWith('zenn_article', {
      items: [item(1)],
      removeIds: [],
      result: { fetchedAt: NOW.toISOString(), isOk: true, reason: '1 件を取得' },
    });
  });

  it('一覧に無い activity は、URL が 404 を返したものだけを消す（FR-017・FR-020・SC-003）', async () => {
    const activities = fakeActivities({
      listStoredKeys: vi.fn(async () => [
        {
          id: 10,
          externalId: null,
          url: 'https://zenn.dev/ksyunnnn/articles/gone',
          publishedAt: '2026-05-01T00:00:00.000Z',
        },
        {
          id: 11,
          externalId: null,
          url: 'https://zenn.dev/ksyunnnn/articles/flaky',
          publishedAt: '2026-04-01T00:00:00.000Z',
        },
      ]),
    });
    const checkUrl = vi.fn(
      async (url: string) => (url.endsWith('/gone') ? 'gone' : 'unknown') as const,
    );
    await refreshSource(
      {
        activities,
        fetchList: async () => ({
          ok: true,
          items: [item(3), item(6)],
          isComplete: false,
          skipped: 0,
        }),
        checkUrl,
      },
      'zenn_article',
      NOW,
    );
    expect(checkUrl).toHaveBeenCalledTimes(2);
    expect(activities.applyFetch).toHaveBeenCalledWith(
      'zenn_article',
      expect.objectContaining({ removeIds: [10] }),
    );
  });

  it('件数が決まっている取得元で、一覧に無いだけの古い activity は確かめもしない（FR-018・SC-004）', async () => {
    const activities = fakeActivities({
      listStoredKeys: vi.fn(async () => [
        {
          id: 10,
          externalId: null,
          url: 'https://zenn.dev/ksyunnnn/articles/old',
          publishedAt: '2020-01-01T00:00:00.000Z',
        },
      ]),
    });
    const checkUrl = vi.fn();
    await refreshSource(
      {
        activities,
        fetchList: async () => ({ ok: true, items: [item(3)], isComplete: false, skipped: 0 }),
        checkUrl,
      },
      'zenn_article',
      NOW,
    );
    expect(checkUrl).not.toHaveBeenCalled();
    expect(activities.applyFetch).toHaveBeenCalledWith(
      'zenn_article',
      expect.objectContaining({ removeIds: [] }),
    );
  });
});

describe('refreshRegistered', () => {
  it('題と代表の画像だけを書き換え、日付を渡さない（FR-012・SC-005）', async () => {
    const activities = fakeActivities({
      listRefreshTargets: vi.fn(async () => [
        {
          id: 1,
          source: 'spotify_playlist' as const,
          url: 'https://open.spotify.com/playlist/fake',
        },
      ]),
    });
    await refreshRegistered(
      {
        activities,
        fetchRegistered: async () => ({ ok: true, title: '新しい題', imageUrl: null }),
      },
      3,
      NOW,
    );
    expect(activities.listRefreshTargets).toHaveBeenCalledWith(expect.any(Array), 15, 5);
    expect(activities.applyRefresh).toHaveBeenCalledWith({
      updates: [{ id: 1, title: '新しい題', imageUrl: null }],
      removeIds: [],
      results: [
        {
          source: 'spotify_playlist',
          result: {
            fetchedAt: NOW.toISOString(),
            isOk: true,
            reason: 'URL を指名した activity を取り直した',
          },
        },
      ],
    });
  });

  it('取得元が 404 を返したものは消し、取れなかったものは残して失敗を記録する', async () => {
    const activities = fakeActivities({
      listRefreshTargets: vi.fn(async () => [
        { id: 1, source: 'x_post' as const, url: 'https://x.com/a/status/1' },
        { id: 2, source: 'x_post' as const, url: 'https://x.com/a/status/2' },
      ]),
    });
    await refreshRegistered(
      {
        activities,
        fetchRegistered: async (_source, url) =>
          url.endsWith('/1')
            ? { ok: false, reason: '状態 404 を返した', gone: true }
            : { ok: false, reason: '状態 503 を返した', gone: false },
      },
      0,
      NOW,
    );
    expect(activities.applyRefresh).toHaveBeenCalledWith({
      updates: [],
      removeIds: [1],
      results: [
        {
          source: 'x_post',
          result: { fetchedAt: NOW.toISOString(), isOk: false, reason: '状態 503 を返した' },
        },
      ],
    });
  });

  it('URL を指名した activity が無ければ、何も書かない', async () => {
    const activities = fakeActivities();
    await refreshRegistered({ activities, fetchRegistered: vi.fn() }, 0, NOW);
    expect(activities.applyRefresh).not.toHaveBeenCalled();
  });
});

describe('枠の選び方（research.md の R6）', () => {
  it.each([
    ['2026-11-09T00:00:00.000Z', 'zenn_article'],
    ['2026-11-09T06:00:00.000Z', 'connpass_event'],
    ['2026-11-09T07:00:00.000Z', 'registered'],
    ['2026-11-09T08:00:00.000Z', 'zenn_article'],
    ['2026-11-09T23:00:00.000Z', 'registered'],
  ])('%s は %s', (time, slot) => {
    expect(slotAt(new Date(time))).toBe(slot);
  });

  it('取り直しの巡は 8 時間ごとに進む', () => {
    const first = cycleAt(new Date('2026-11-09T07:00:00.000Z'));
    expect(cycleAt(new Date('2026-11-09T15:00:00.000Z'))).toBe(first + 1);
  });

  it('1 回に 1 つの枠だけを取る（FR-015）', async () => {
    const fetchList = vi.fn(async (): Promise<FetchOutcome> => ({
      ok: true,
      items: [],
      isComplete: true,
      skipped: 0,
    }));
    const deps = {
      activities: fakeActivities(),
      fetchList,
      fetchRegistered: vi.fn(),
      checkUrl: vi.fn(),
    };
    expect(await runScheduledFetch(deps, new Date('2026-11-09T01:00:00.000Z'))).toMatchObject({
      slot: 'qiita_article',
    });
    expect(fetchList).toHaveBeenCalledTimes(1);
    expect(fetchList).toHaveBeenCalledWith('qiita_article');
  });
});
