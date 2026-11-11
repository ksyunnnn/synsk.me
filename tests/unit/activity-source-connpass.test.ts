import { describe, expect, it } from 'vitest';
import { fetchListing } from '@/features/activity/server/sources/connpass';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { createFakeFetcher, jsonResponse } from '../support/activity-fakes';

/**
 * connpass の REST v2 の応答を `FetchedItem` に詰め替える（FR-006・FR-007、research.md の R7・R15）。
 * 実データが無いため、応答の形は公式の OpenAPI（https://connpass.com/about/api/v2/openapi.json の
 * `EventListResponseSchema`）に合わせた作り物
 */

const LIMITS: FetchLimits = { maxRequests: 10, timeoutMs: 1000, maxBytes: 1_000_000 };
const page = (start: number) =>
  `https://connpass.com/api/v2/users/ksyunnnn/attended_events/?start=${start}&count=100`;

const event = (n: number) => ({
  id: n,
  title: `作り物のイベント ${n}`,
  url: `https://fake.connpass.com/event/${n}/`,
  image_url: null,
  started_at: '2019-09-13T19:00:00+09:00',
});

const body = (start: number, events: unknown[], available: number) => ({
  results_returned: events.length,
  results_available: available,
  results_start: start,
  events,
});

const noWait = async () => {};

describe('connpass', () => {
  it('API キーが無ければ、要求を出さずに失敗する（R15）', async () => {
    const { fetcher, requested } = createFakeFetcher({});

    await expect(fetchListing(fetcher, LIMITS, undefined, noWait)).rejects.toThrow(
      /CONNPASS_API_KEY/,
    );
    expect(requested).toHaveLength(0);
  });

  it('ID・URL・題・開始日時を詰め替え、API キーを X-API-Key に付ける', async () => {
    const { fetcher, requested } = createFakeFetcher({
      [page(1)]: jsonResponse(body(1, [event(1)], 1)),
    });

    const listing = await fetchListing(fetcher, LIMITS, 'fake-key', noWait);

    expect(listing).toEqual({
      items: [
        {
          url: 'https://fake.connpass.com/event/1/',
          title: '作り物のイベント 1',
          publishedAt: '2019-09-13T10:00:00.000Z',
          externalId: '1',
        },
      ],
      isComplete: true,
    });
    expect(requested[0]?.headers.get('X-API-Key')).toBe('fake-key');
  });

  it('results_available まで辿り、頁の間で 5 秒待つ（R8）', async () => {
    const waits: number[] = [];
    const { fetcher } = createFakeFetcher({
      [page(1)]: jsonResponse(
        body(
          1,
          Array.from({ length: 100 }, (_, i) => event(i + 1)),
          101,
        ),
      ),
      [page(101)]: jsonResponse(body(101, [event(101)], 101)),
    });

    const listing = await fetchListing(fetcher, LIMITS, 'fake-key', async (ms) => {
      waits.push(ms);
    });

    expect(listing.items).toHaveLength(101);
    expect(listing.isComplete).toBe(true);
    expect(waits).toEqual([5000]);
  });

  it('要求の数の上限で辿るのを止めたら、すべて取ったことにしない（R7・FR-018）', async () => {
    const { fetcher } = createFakeFetcher({
      [page(1)]: jsonResponse(
        body(
          1,
          Array.from({ length: 100 }, (_, i) => event(i + 1)),
          101,
        ),
      ),
    });

    const listing = await fetchListing(fetcher, { ...LIMITS, maxRequests: 1 }, 'fake-key', noWait);

    expect(listing.isComplete).toBe(false);
  });

  it('形の違う応答は失敗にする（FR-020）', async () => {
    const { fetcher } = createFakeFetcher({ [page(1)]: jsonResponse({ events: 'x' }) });

    await expect(fetchListing(fetcher, LIMITS, 'fake-key', noWait)).rejects.toThrow(/形/);
  });
});
