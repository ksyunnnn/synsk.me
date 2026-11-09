import { describe, expect, it } from 'vitest';
import { refreshSources } from '@/features/activity/application/refresh-sources';
import type { ActivityDeps } from '@/features/activity/application/deps';
import type { SourceListing } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { createFakeActivityRepository } from '../support/activity-fakes';

/**
 * 取得のユースケース（specs/004-external-activity/contracts/fetch.md、research.md の R4、
 * FR-006・FR-016）。取得元の名前と応答は作り物
 */

const NOW = '2026-11-09T00:00:00.000Z';
const LIMITS: FetchLimits = { maxRequests: 3, timeoutMs: 1000, maxBytes: 1024 };

const listing = (items: SourceListing['items']): SourceListing => ({ items, isComplete: false });

const deps = (
  repository: ActivityDeps['activities'],
  listings: Record<string, SourceListing>,
): ActivityDeps => ({
  activities: repository,
  fetchListing: async (source) => {
    const found = listings[source];
    if (!found) throw new Error(`作り物の取得元 ${source} は無い`);
    return found;
  },
});

describe('refreshSources', () => {
  it('取得元ごとに読み、足す行を求め、取得の結果と一緒に 1 回で書く', async () => {
    const { repository, applied } = createFakeActivityRepository();
    const item = { url: 'https://example.com/a', title: '作り物', publishedAt: NOW };

    const outcomes = await refreshSources(
      deps(repository, { fake_feed: listing([item]) }),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(outcomes).toEqual([
      { source: 'fake_feed', ok: true, added: 1, updated: 0, skippedWithoutDate: 0 },
    ]);
    expect(applied).toEqual([
      {
        source: 'fake_feed',
        plan: { inserts: [item], updates: [], skippedWithoutDate: 0 },
        result: { fetchedAt: NOW, reason: null },
      },
    ]);
  });

  it('公開日が無くて取り込まなかった項目の数を、取得の結果の理由に書く（FR-011）', async () => {
    const { repository, applied } = createFakeActivityRepository();

    await refreshSources(
      deps(repository, {
        fake_feed: listing([{ url: 'https://example.com/a', title: '作り物' }]),
      }),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(applied[0]?.result.reason).toMatch(/公開日の無い項目を 1 件/);
  });

  it('書き込みが失敗したら、その取得元の取得の結果に失敗と理由を別に書く（R4）', async () => {
    const { repository, failures } = createFakeActivityRepository(
      {},
      { failApplyFor: ['fake_feed'] },
    );
    const item = { url: 'https://example.com/a', title: '作り物', publishedAt: NOW };

    const outcomes = await refreshSources(
      deps(repository, { fake_feed: listing([item]) }),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(outcomes).toEqual([
      { source: 'fake_feed', ok: false, reason: expect.stringMatching(/書き込み/) },
    ]);
    expect(failures).toEqual([
      { source: 'fake_feed', fetchedAt: NOW, reason: expect.stringMatching(/書き込み/) },
    ]);
  });
});
