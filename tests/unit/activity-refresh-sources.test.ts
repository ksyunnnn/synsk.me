import { describe, expect, it } from 'vitest';
import { refreshSources } from '@/features/activity/application/refresh-sources';
import type { ActivityDeps } from '@/features/activity/application/deps';
import type { SourceListing } from '@/features/activity/domain/fetched-item';
import type { RefreshLimits } from '@/features/activity/domain/limits';
import { createFakeActivityRepository } from '../support/activity-fakes';

/**
 * 取得のユースケース（specs/004-external-activity/contracts/fetch.md、research.md の R4、
 * FR-006・FR-016）。取得元の名前と応答は作り物
 */

const NOW = '2026-11-09T00:00:00.000Z';
const LIMITS: RefreshLimits = { maxRequests: 3, timeoutMs: 1000, maxBytes: 1024, maxRemovals: 2 };

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
      {
        source: 'fake_feed',
        ok: true,
        added: 1,
        updated: 0,
        removed: 0,
        keptOverLimit: 0,
        skippedWithoutDate: 0,
      },
    ]);
    expect(applied).toEqual([
      {
        source: 'fake_feed',
        plan: { inserts: [item], updates: [], deletes: [], skippedWithoutDate: 0 },
        result: { fetchedAt: NOW, reason: null, validators: null },
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

/**
 * 1 つの取得元の失敗で、ほかの取得元を止めない（User Story 2、FR-014・FR-015・FR-016・FR-020・SC-002）
 */
describe('refreshSources の失敗の扱い', () => {
  const itemB = { url: 'https://example.com/b', title: '作り物 B', publishedAt: NOW };

  const failingDeps = (
    repository: ActivityDeps['activities'],
    fetchA: () => Promise<SourceListing>,
  ): ActivityDeps => ({
    activities: repository,
    fetchListing: async (source) => (source === 'fake_a' ? fetchA() : listing([itemB])),
  });

  it.each([
    ['投げる', () => Promise.reject(new Error('作り物の通信の失敗'))],
    ['形の違う応答を返す', () => Promise.reject(new Error('作り物 の応答の形が想定と違う'))],
    ['上限を超える', () => Promise.reject(new Error('応答の大きさが上限（16 バイト）を超えた'))],
  ])('取得元 A が%sとき、A を書き換えず、B を取り込み、A の失敗と理由を返す', async (_, fetchA) => {
    const { repository, applied, failures } = createFakeActivityRepository();

    const outcomes = await refreshSources(
      failingDeps(repository, fetchA),
      ['fake_a', 'fake_b'],
      NOW,
      LIMITS,
    );

    const reason = (await fetchA().catch((error: Error) => error)).message;
    expect(outcomes).toEqual([
      { source: 'fake_a', ok: false, reason: expect.stringContaining(String(reason)) },
      {
        source: 'fake_b',
        ok: true,
        added: 1,
        updated: 0,
        removed: 0,
        keptOverLimit: 0,
        skippedWithoutDate: 0,
      },
    ]);
    expect(applied.map((write) => write.source)).toEqual(['fake_b']);
    expect(failures).toEqual([
      { source: 'fake_a', fetchedAt: NOW, reason: expect.stringContaining(String(reason)) },
    ]);
  });

  it('読む・書くの外で投げても、A の取得の結果に失敗を書く', async () => {
    const { repository, failures } = createFakeActivityRepository();
    const broken = async () => ({ isComplete: false }) as unknown as SourceListing;

    const outcomes = await refreshSources(
      failingDeps(repository, broken),
      ['fake_a', 'fake_b'],
      NOW,
      LIMITS,
    );

    expect(outcomes.map((outcome) => [outcome.source, outcome.ok])).toEqual([
      ['fake_a', false],
      ['fake_b', true],
    ]);
    expect(failures).toEqual([
      { source: 'fake_a', fetchedAt: NOW, reason: expect.stringMatching(/取り直しに失敗した/) },
    ]);
  });

  it('取得元 A の書き込みが失敗しても、B の書き込みは止まらない', async () => {
    const { repository, applied, failures } = createFakeActivityRepository(
      {},
      { failApplyFor: ['fake_a'] },
    );

    const outcomes = await refreshSources(
      failingDeps(repository, async () => listing([itemB])),
      ['fake_a', 'fake_b'],
      NOW,
      LIMITS,
    );

    expect(outcomes.map((outcome) => [outcome.source, outcome.ok])).toEqual([
      ['fake_a', false],
      ['fake_b', true],
    ]);
    expect(applied.map((write) => write.source)).toEqual(['fake_b']);
    expect(failures.map((failure) => failure.source)).toEqual(['fake_a']);
  });

  it('失敗を書くことも失敗したら、投げずに理由を返す', async () => {
    const { repository } = createFakeActivityRepository();
    const broken = {
      ...repository,
      recordFetchFailure: () => Promise.reject(new Error('作り物の D1 の失敗')),
    };

    const outcomes = await refreshSources(
      failingDeps(broken, () => Promise.reject(new Error('作り物の通信の失敗'))),
      ['fake_a', 'fake_b'],
      NOW,
      LIMITS,
    );

    expect(outcomes).toEqual([
      { source: 'fake_a', ok: false, reason: expect.stringMatching(/作り物の D1 の失敗/) },
      {
        source: 'fake_b',
        ok: true,
        added: 1,
        updated: 0,
        removed: 0,
        keptOverLimit: 0,
        skippedWithoutDate: 0,
      },
    ]);
  });
});

/**
 * 取得元で消えた activity を消す（User Story 3、FR-017〜FR-019）
 */
describe('refreshSources の消す行', () => {
  const storedItem = (id: number) => ({
    id,
    externalId: null,
    url: `https://example.com/${id}`,
    title: `作り物 ${id}`,
    publishedAt: NOW,
    imageUrl: null,
  });
  const complete = (items: SourceListing['items']): SourceListing => ({ items, isComplete: true });

  it('すべて取った取得元で一覧に無い activity を、足す行と同じ書き込みで消す', async () => {
    const { repository, applied } = createFakeActivityRepository({
      fake_feed: [storedItem(1), storedItem(2)],
    });

    const outcomes = await refreshSources(
      deps(repository, {
        fake_feed: complete([
          { url: 'https://example.com/1', title: '作り物 1', publishedAt: NOW },
        ]),
      }),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(outcomes).toEqual([
      {
        source: 'fake_feed',
        ok: true,
        added: 0,
        updated: 0,
        removed: 1,
        keptOverLimit: 0,
        skippedWithoutDate: 0,
      },
    ]);
    expect(applied[0]?.plan.deletes).toEqual([2]);
    expect(applied[0]?.result.reason).toBeNull();
  });

  it('消す候補が上限を超えたら 1 件も消さず、止めた旨を取得の結果の理由に書く', async () => {
    const { repository, applied } = createFakeActivityRepository({
      fake_feed: [storedItem(1), storedItem(2), storedItem(3)],
    });

    const outcomes = await refreshSources(
      deps(repository, {
        fake_feed: complete([
          { url: 'https://example.com/9', title: '作り物 9', publishedAt: NOW },
        ]),
      }),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(outcomes).toEqual([
      {
        source: 'fake_feed',
        ok: true,
        added: 1,
        updated: 0,
        removed: 0,
        keptOverLimit: 3,
        skippedWithoutDate: 0,
      },
    ]);
    expect(applied[0]?.plan.deletes).toEqual([]);
    expect(applied[0]?.result.reason).toMatch(
      /消す候補が 3 件で、上限（2 件）を超えたので、1 件も消さなかった/,
    );
  });
});
