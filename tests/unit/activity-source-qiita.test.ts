import { describe, expect, it } from 'vitest';
import { fetchListing } from '@/features/activity/server/sources/qiita';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { asListing, createFakeFetcher, jsonResponse } from '../support/activity-fakes';

/**
 * Qiita の REST の応答を `FetchedItem` に詰め替える（FR-006・FR-007、research.md の R7）。
 * 応答の形は PR #47 の検証記録（2026-09-02 実測）に合わせた作り物
 */

const LIMITS: FetchLimits = { maxRequests: 10, timeoutMs: 1000, maxBytes: 1_000_000 };
const page = (n: number) => `https://qiita.com/api/v2/users/ksyunnnn/items?page=${n}&per_page=20`;

const qiitaItem = (n: number) => ({
  id: `fake${String(n).padStart(16, '0')}`,
  title: `作り物の記事 ${n}`,
  url: `https://qiita.com/ksyunnnn/items/fake${String(n).padStart(16, '0')}`,
  created_at: '2022-05-19T10:20:46+09:00',
  likes_count: 0,
  body: '作り物の本文',
});

const items = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => qiitaItem(from + i));

describe('Qiita', () => {
  it('ID・URL・題・作成日時を詰め替える。画像は返さない', async () => {
    const { fetcher } = createFakeFetcher({
      [page(1)]: jsonResponse(items(1, 1), { 'Total-Count': '1' }),
    });

    const listing = asListing(await fetchListing(fetcher, LIMITS));

    expect(listing).toEqual({
      items: [
        {
          url: 'https://qiita.com/ksyunnnn/items/fake0000000000000001',
          title: '作り物の記事 1',
          publishedAt: '2022-05-19T01:20:46.000Z',
          externalId: 'fake0000000000000001',
        },
      ],
      isComplete: true,
    });
  });

  it('total-count まで頁を辿ったら、すべて取ったことにする', async () => {
    const { fetcher, requested } = createFakeFetcher({
      [page(1)]: jsonResponse(items(1, 20), { 'Total-Count': '21' }),
      [page(2)]: jsonResponse(items(21, 21), { 'Total-Count': '21' }),
    });

    const listing = asListing(await fetchListing(fetcher, LIMITS));

    expect(listing.items).toHaveLength(21);
    expect(listing.isComplete).toBe(true);
    expect(requested.map((r) => r.url)).toEqual([page(1), page(2)]);
  });

  it('頁を辿るあいだに total-count が変わったら、すべて取ったことにしない（R6・FR-020）', async () => {
    const { fetcher } = createFakeFetcher({
      [page(1)]: jsonResponse(items(1, 20), { 'Total-Count': '22' }),
      [page(2)]: jsonResponse(items(22, 22), { 'Total-Count': '21' }),
    });

    const listing = asListing(await fetchListing(fetcher, LIMITS));

    expect(listing.isComplete).toBe(false);
  });

  it('要求の数の上限で辿るのを止めたら、すべて取ったことにしない（R7・FR-018）', async () => {
    const { fetcher, requested } = createFakeFetcher({
      [page(1)]: jsonResponse(items(1, 20), { 'Total-Count': '21' }),
    });

    const listing = asListing(await fetchListing(fetcher, { ...LIMITS, maxRequests: 1 }));

    expect(listing.items).toHaveLength(20);
    expect(listing.isComplete).toBe(false);
    expect(requested).toHaveLength(1);
  });

  it('アクセストークンがあれば Authorization に付け、無ければ付けずに取る（R15）', async () => {
    const withToken = createFakeFetcher({
      [page(1)]: jsonResponse([], { 'Total-Count': '0' }),
    });
    await fetchListing(withToken.fetcher, LIMITS, 'fake-token');
    expect(withToken.requested[0]?.headers.get('Authorization')).toBe('Bearer fake-token');

    const without = createFakeFetcher({ [page(1)]: jsonResponse([], { 'Total-Count': '0' }) });
    await fetchListing(without.fetcher, LIMITS);
    expect(without.requested[0]?.headers.has('Authorization')).toBe(false);
  });

  it('total-count が無いか、項目の形が違えば失敗する（FR-020）', async () => {
    const noCount = createFakeFetcher({ [page(1)]: jsonResponse(items(1, 1)) });
    await expect(fetchListing(noCount.fetcher, LIMITS)).rejects.toThrow(/形/);

    const emptyCount = createFakeFetcher({
      [page(1)]: jsonResponse(items(1, 20), { 'Total-Count': '' }),
    });
    await expect(fetchListing(emptyCount.fetcher, LIMITS)).rejects.toThrow(/形/);

    const broken = createFakeFetcher({
      [page(1)]: jsonResponse([{ id: 1, title: null }], { 'Total-Count': '1' }),
    });
    await expect(fetchListing(broken.fetcher, LIMITS)).rejects.toThrow(/形/);
  });
});
