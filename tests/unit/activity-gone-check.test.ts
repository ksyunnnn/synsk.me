import { describe, expect, it } from 'vitest';
import type { ActivityDeps } from '@/features/activity/application/deps';
import { pickGoneChecks } from '@/features/activity/application/plan-removals';
import { refreshSources } from '@/features/activity/application/refresh-sources';
import type { StoredItem } from '@/features/activity/domain/activity-repository';
import type { RefreshLimits } from '@/features/activity/domain/limits';
import { checkGone as checkZennGone } from '@/features/activity/server/sources/zenn';
import { checkGone as checkSpeakerDeckGone } from '@/features/activity/server/sources/speakerdeck';
import { createFakeActivityRepository, createFakeFetcher } from '../support/activity-fakes';

/**
 * すべて取らない取得元（Zenn・Speaker Deck）で、一覧に無い activity の URL を取り直し、404 なら
 * 消えたと確かめる（T048、specs/004-external-activity/research.md の R6、FR-017・FR-019・FR-020）。
 * 確かめる順は `gone_checked_at` の古い順で、それは消えた印ではない。値はすべて作り物
 */

const NOW = '2026-11-09T00:00:00.000Z';
const LIMITS: RefreshLimits = {
  maxRequests: 1,
  timeoutMs: 1000,
  maxBytes: 100_000,
  maxRemovals: 5,
  maxGoneChecks: 2,
};

const stored = (id: number, goneCheckedAt: string | null = null, goneStreak = 0): StoredItem => ({
  id,
  externalId: null,
  url: `https://example.com/${id}`,
  title: `作り物 ${id}`,
  publishedAt: NOW,
  imageUrl: null,
  goneCheckedAt,
  goneStreak,
});

describe('pickGoneChecks', () => {
  it('一覧に無い行を、確かめたことの無いものを先に、確かめた日時の古い順に、上限まで選ぶ', () => {
    const rows = [
      stored(1, '2026-11-08T00:00:00.000Z'),
      stored(2, '2026-11-07T00:00:00.000Z'),
      stored(3),
      stored(4),
    ];
    const listed = [{ url: 'https://example.com/4', title: '作り物 4', publishedAt: NOW }];

    expect(pickGoneChecks(rows, listed, 2).map((row) => row.id)).toEqual([3, 2]);
  });

  it('404 が続いている行を、確かめたことの無い行より先に選ぶ。2 回目を待たせない', () => {
    const rows = [stored(1), stored(2, '2026-11-09T00:00:00.000Z', 1)];

    expect(pickGoneChecks(rows, [], 1).map((row) => row.id)).toEqual([2]);
  });
});

describe('取得元ごとの確かめ方', () => {
  it.each([
    ['Zenn', checkZennGone],
    ['Speaker Deck', checkSpeakerDeckGone],
  ])('%s は 404 で消えた、2xx で残る、ほかは判定しない', async (_, checkGone) => {
    const { fetcher } = createFakeFetcher({
      'https://example.com/ok': () => new Response('作り物'),
      'https://example.com/down': () => new Response('', { status: 503 }),
      'https://example.com/moved': () =>
        new Response('', { status: 302, headers: { Location: 'https://example.com/missing' } }),
    });

    expect(await checkGone(fetcher, 'https://example.com/missing', LIMITS)).toBe('gone');
    expect(await checkGone(fetcher, 'https://example.com/ok', LIMITS)).toBe('present');
    expect(await checkGone(fetcher, 'https://example.com/down', LIMITS)).toBe('unknown');
    // リダイレクトを辿らない。移った先が 404 でも、元の URL が消えた証拠にしない
    expect(await checkGone(fetcher, 'https://example.com/moved', LIMITS)).toBe('unknown');
  });
});

describe('refreshSources で確かめる', () => {
  const deps = (
    repository: ActivityDeps['activities'],
    results: Record<string, 'gone' | 'present' | 'unknown'>,
    checked: string[],
  ): ActivityDeps => ({
    activities: repository,
    fetchListing: async () => ({ items: [], isComplete: false }),
    goneCheckOf: () => async (url) => {
      checked.push(url);
      return results[url] ?? 'unknown';
    },
  });

  it('1 回目の 404 では消さず、404 が続いた回数を 1 にする。2xx の行は回数を 0 にする', async () => {
    const { repository, applied } = createFakeActivityRepository({
      fake_feed: [stored(1), stored(2, null, 1), stored(3, NOW)],
    });
    const checked: string[] = [];

    const outcomes = await refreshSources(
      deps(
        repository,
        { 'https://example.com/1': 'gone', 'https://example.com/2': 'present' },
        checked,
      ),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(checked).toEqual(['https://example.com/1', 'https://example.com/2']);
    expect(applied[0]?.plan.deletes).toEqual([]);
    expect(applied[0]?.plan.goneChecked).toEqual([
      { id: 1, goneStreak: 1 },
      { id: 2, goneStreak: 0 },
    ]);
    expect(outcomes).toMatchObject([{ source: 'fake_feed', ok: true, removed: 0 }]);
  });

  it('続けて 2 回 404 の行を消す（2026-11-09 の決定、原則 2）', async () => {
    const { repository, applied } = createFakeActivityRepository({
      fake_feed: [stored(1, null, 1)],
    });

    const outcomes = await refreshSources(
      deps(repository, { 'https://example.com/1': 'gone' }, []),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(applied[0]?.plan.deletes).toEqual([1]);
    expect(applied[0]?.plan.goneChecked).toBeUndefined();
    expect(outcomes).toMatchObject([{ source: 'fake_feed', ok: true, removed: 1 }]);
  });

  it('404 の間に判定できない応答が挟まったら、回数を 0 に戻す', async () => {
    const { repository, applied } = createFakeActivityRepository({
      fake_feed: [stored(1, null, 1)],
    });

    await refreshSources(
      deps(repository, { 'https://example.com/1': 'unknown' }, []),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(applied[0]?.plan.deletes).toEqual([]);
    expect(applied[0]?.plan.goneChecked).toEqual([{ id: 1, goneStreak: 0 }]);
  });

  it('取得元が変わっていないと答えた（304）回も、保存した行を確かめ、続けて 2 回 404 の行を消す（R6）', async () => {
    const { repository, applied } = createFakeActivityRepository({
      fake_feed: [stored(1, null, 1), stored(2, NOW)],
    });
    const checked: string[] = [];

    await refreshSources(
      {
        ...deps(repository, { 'https://example.com/1': 'gone' }, checked),
        fetchListing: async () => ({ notModified: true }),
      },
      ['fake_feed'],
      NOW,
      { ...LIMITS, maxGoneChecks: 1 },
    );

    expect(checked).toEqual(['https://example.com/1']);
    expect(applied[0]?.plan.deletes).toEqual([1]);
  });

  it('確かめる手段を持たない取得元（Medium など）では確かめない', async () => {
    const { repository, applied } = createFakeActivityRepository({ fake_feed: [stored(1)] });

    await refreshSources(
      {
        activities: repository,
        fetchListing: async () => ({ items: [], isComplete: false }),
      },
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(applied[0]?.plan.deletes).toEqual([]);
    expect(applied[0]?.plan.goneChecked).toBeUndefined();
  });

  it('消えたと確かめた行が上限を超えた回は 1 件も消さない（FR-019）', async () => {
    const { repository, applied } = createFakeActivityRepository({
      fake_feed: [stored(1, null, 1), stored(2, null, 1)],
    });

    await refreshSources(
      deps(repository, { 'https://example.com/1': 'gone', 'https://example.com/2': 'gone' }, []),
      ['fake_feed'],
      NOW,
      { ...LIMITS, maxRemovals: 1 },
    );

    expect(applied[0]?.plan.deletes).toEqual([]);
    expect(applied[0]?.result.reason).toMatch(/1 件も消さなかった/);
  });

  it('確かめるのに失敗しても、その行を消さない（FR-020）', async () => {
    const { repository, applied } = createFakeActivityRepository({ fake_feed: [stored(1)] });

    await refreshSources(
      {
        activities: repository,
        fetchListing: async () => ({ items: [], isComplete: false }),
        goneCheckOf: () => async () => {
          throw new Error('作り物の通信の失敗');
        },
      },
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(applied[0]?.plan.deletes).toEqual([]);
    expect(applied[0]?.plan.goneChecked).toEqual([{ id: 1, goneStreak: 0 }]);
  });
});
