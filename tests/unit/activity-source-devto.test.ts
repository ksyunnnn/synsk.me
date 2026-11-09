import { describe, expect, it } from 'vitest';
import { fetchListing } from '@/features/activity/server/sources/devto';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { createFakeFetcher, jsonResponse } from '../support/activity-fakes';

/**
 * dev.to の REST の応答を `FetchedItem` に詰め替える（FR-006・FR-007、research.md の R7）。
 * 応答の形は PR #47 の検証記録（2026-09-02 実測）に合わせた作り物
 */

const LIMITS: FetchLimits = { maxRequests: 10, timeoutMs: 1000, maxBytes: 1_000_000 };
const page = (n: number) => `https://dev.to/api/articles?username=ksyunnnn&page=${n}&per_page=100`;

const article = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: n,
  title: `作り物の記事 ${n}`,
  description: '作り物',
  url: `https://dev.to/ksyunnnn/fake-${n}`,
  published_at: '2024-01-03T05:48:34Z',
  social_image: `https://media2.dev.to/fake-social-${n}.png`,
  cover_image: null,
  ...overrides,
});

describe('dev.to', () => {
  it('ID・URL・題・公開日・画像を詰め替える。表紙が無ければ共有用の画像を使う', async () => {
    const { fetcher } = createFakeFetcher({
      [page(1)]: jsonResponse([
        article(1),
        article(2, { cover_image: 'https://media2.dev.to/fake-cover-2.png' }),
      ]),
      [page(2)]: jsonResponse([]),
    });

    const listing = await fetchListing(fetcher, LIMITS);

    expect(listing.items).toEqual([
      {
        url: 'https://dev.to/ksyunnnn/fake-1',
        title: '作り物の記事 1',
        publishedAt: '2024-01-03T05:48:34.000Z',
        externalId: '1',
        imageUrl: 'https://media2.dev.to/fake-social-1.png',
      },
      {
        url: 'https://dev.to/ksyunnnn/fake-2',
        title: '作り物の記事 2',
        publishedAt: '2024-01-03T05:48:34.000Z',
        externalId: '2',
        imageUrl: 'https://media2.dev.to/fake-cover-2.png',
      },
    ]);
  });

  it('空の頁まで辿ったら、すべて取ったことにする', async () => {
    const { fetcher } = createFakeFetcher({
      [page(1)]: jsonResponse([article(1)]),
      [page(2)]: jsonResponse([]),
    });

    expect((await fetchListing(fetcher, LIMITS)).isComplete).toBe(true);
  });

  it('要求の数の上限で辿るのを止めたら、すべて取ったことにしない（R7・FR-018）', async () => {
    const { fetcher } = createFakeFetcher({ [page(1)]: jsonResponse([article(1)]) });

    const listing = await fetchListing(fetcher, { ...LIMITS, maxRequests: 1 });

    expect(listing.isComplete).toBe(false);
    expect(listing.items).toHaveLength(1);
  });

  it('User-Agent を付けて要求する（空なら 403 を返す。research.md の R7）', async () => {
    const { fetcher, requested } = createFakeFetcher({ [page(1)]: jsonResponse([]) });

    await fetchListing(fetcher, LIMITS);

    expect(requested[0]?.headers.get('User-Agent')).toBe('synsk.me (+https://synsk.me)');
  });

  it('項目の形が違えば失敗する（FR-020）', async () => {
    const { fetcher } = createFakeFetcher({
      [page(1)]: jsonResponse([{ id: 'x', title: '作り物' }]),
    });

    await expect(fetchListing(fetcher, LIMITS)).rejects.toThrow(/形/);
  });
});
