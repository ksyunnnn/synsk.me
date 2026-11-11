import { describe, expect, it } from 'vitest';
import { fetchListing } from '@/features/activity/server/sources/github';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { asListing, createFakeFetcher, jsonResponse } from '../support/activity-fakes';

/**
 * GitHub の REST の応答を `FetchedItem` に詰め替える（FR-006・FR-007、research.md の R7）。
 * 応答の形は PR #47 の検証記録（2026-09-02 実測）に合わせた作り物
 */

const LIMITS: FetchLimits = { maxRequests: 10, timeoutMs: 1000, maxBytes: 1_000_000 };
const page = (n: number) =>
  `https://api.github.com/users/ksyunnnn/repos?type=owner&sort=created&direction=asc&per_page=100&page=${n}`;
const ETAG = 'W/"fake-etag"';

const repo = (n: number) => ({
  id: 1000 + n,
  name: `fake-repo-${n}`,
  full_name: `ksyunnnn/fake-repo-${n}`,
  html_url: `https://github.com/ksyunnnn/fake-repo-${n}`,
  description: null,
  pushed_at: n === 1 ? null : '2026-09-01T15:08:13Z',
  created_at: '2022-11-26T03:04:05Z',
});

const repos = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => repo(from + i));

describe('GitHub', () => {
  it('ID・URL・名前・作成日時を詰め替える。pushed_at は使わない。画像は返さない', async () => {
    const { fetcher } = createFakeFetcher({ [page(1)]: jsonResponse(repos(1, 2)) });

    const listing = asListing(await fetchListing(fetcher, LIMITS));

    expect(listing).toEqual({
      items: [1, 2].map((n) => ({
        url: `https://github.com/ksyunnnn/fake-repo-${n}`,
        title: `fake-repo-${n}`,
        publishedAt: '2022-11-26T03:04:05.000Z',
        externalId: String(1000 + n),
      })),
      isComplete: true,
    });
  });

  it('per_page 未満の頁まで辿ったら、すべて取ったことにする', async () => {
    const { fetcher, requested } = createFakeFetcher({
      [page(1)]: jsonResponse(repos(1, 100)),
      [page(2)]: jsonResponse([]),
    });

    const listing = asListing(await fetchListing(fetcher, LIMITS));

    expect(listing.items).toHaveLength(100);
    expect(listing.isComplete).toBe(true);
    expect(requested.map((r) => r.url)).toEqual([page(1), page(2)]);
  });

  it('要求の数の上限で辿るのを止めたら、すべて取ったことにしない（R7・FR-018）', async () => {
    const { fetcher, requested } = createFakeFetcher({ [page(1)]: jsonResponse(repos(1, 100)) });

    const listing = asListing(await fetchListing(fetcher, { ...LIMITS, maxRequests: 1 }));

    expect(listing.items).toHaveLength(100);
    expect(listing.isComplete).toBe(false);
    expect(requested).toHaveLength(1);
  });

  it('トークンがあれば Authorization に付け、無ければ付けずに取る（R15）', async () => {
    const withToken = createFakeFetcher({ [page(1)]: jsonResponse([]) });
    await fetchListing(withToken.fetcher, LIMITS, 'fake-token');
    expect(withToken.requested[0]?.headers.get('Authorization')).toBe('Bearer fake-token');
    expect(withToken.requested[0]?.headers.get('Accept')).toBe('application/vnd.github+json');

    const without = createFakeFetcher({ [page(1)]: jsonResponse([]) });
    await fetchListing(without.fetcher, LIMITS);
    expect(without.requested[0]?.headers.has('Authorization')).toBe(false);
  });

  it('1 頁で取り切ったら ETag を持ち、前の値があれば 1 頁目に条件を付け、304 なら変わっていないと返す（R9）', async () => {
    const first = createFakeFetcher({ [page(1)]: jsonResponse(repos(1, 1), { ETag: ETAG }) });
    const listing = asListing(await fetchListing(first.fetcher, LIMITS));
    expect(listing.validators).toEqual({ etag: ETAG, lastModified: null });
    expect(first.requested[0]?.headers.has('If-None-Match')).toBe(false);

    const second = createFakeFetcher({
      [page(1)]: () => new Response(null, { status: 304 }),
    });
    expect(
      await fetchListing(second.fetcher, LIMITS, undefined, { etag: ETAG, lastModified: null }),
    ).toEqual({ notModified: true });
    expect(second.requested[0]?.headers.get('If-None-Match')).toBe(ETAG);
  });

  it('2 頁目以降を取ったら、値を持たず、2 頁目には条件を付けない（R9）', async () => {
    const { fetcher, requested } = createFakeFetcher({
      [page(1)]: jsonResponse(repos(1, 100), { ETag: ETAG }),
      [page(2)]: jsonResponse(repos(101, 101), { ETag: 'W/"other"' }),
    });

    const listing = asListing(
      await fetchListing(fetcher, LIMITS, undefined, { etag: 'W/"old"', lastModified: null }),
    );

    expect(listing.isComplete).toBe(true);
    expect(listing.validators).toBeUndefined();
    expect(requested[1]?.headers.has('If-None-Match')).toBe(false);
  });

  it('並びでないか、項目の形が違えば失敗する（FR-020）', async () => {
    const notArray = createFakeFetcher({ [page(1)]: jsonResponse({ message: 'fake' }) });
    await expect(fetchListing(notArray.fetcher, LIMITS)).rejects.toThrow(/形/);

    const broken = createFakeFetcher({
      [page(1)]: jsonResponse([{ ...repo(1), created_at: null }]),
    });
    await expect(fetchListing(broken.fetcher, LIMITS)).rejects.toThrow(/形/);
  });
});
