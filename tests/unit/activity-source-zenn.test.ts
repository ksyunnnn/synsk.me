import { describe, expect, it } from 'vitest';
import { fetchListing } from '@/features/activity/server/sources/zenn';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { createFakeFetcher, xmlResponse } from '../support/activity-fakes';

/**
 * Zenn の RSS を `FetchedItem` に詰め替える（FR-006・FR-007、research.md の R7）。応答の形は
 * PR #47 の検証記録（docs/scraps/external-api-verification.md、2026-09-02 実測）に合わせた作り物
 */

const FEED = 'https://zenn.dev/ksyunnnn/feed';
const LIMITS: FetchLimits = { maxRequests: 1, timeoutMs: 1000, maxBytes: 1_000_000 };

const rss = `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0"><channel><title><![CDATA[作り物のフィード]]></title><link>https://zenn.dev/ksyunnnn</link>
<item><title><![CDATA[作り物の記事]]></title><description><![CDATA[作り物の本文]]></description><link>https://zenn.dev/ksyunnnn/articles/0000000000fake</link><guid isPermaLink="true">https://zenn.dev/ksyunnnn/articles/0000000000fake</guid><pubDate>Tue, 09 Sep 2025 08:02:10 GMT</pubDate><enclosure url="https://res.cloudinary.com/zenn/image/upload/fake.png" length="0" type="image/png"/><dc:creator>作り物の人</dc:creator></item>
</channel></rss>`;

describe('Zenn', () => {
  it('RSS の項目を、URL・題・公開日・画像の URL に詰め替え、ID を持たない', async () => {
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(rss) });

    const listing = await fetchListing(fetcher, LIMITS);

    expect(listing.items).toEqual([
      {
        url: 'https://zenn.dev/ksyunnnn/articles/0000000000fake',
        title: '作り物の記事',
        publishedAt: '2025-09-09T08:02:10.000Z',
        imageUrl: 'https://res.cloudinary.com/zenn/image/upload/fake.png',
      },
    ]);
  });

  it('RSS は 20 件で打ち切るので、すべて取ったことにしない（FR-018）', async () => {
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(rss) });

    expect((await fetchListing(fetcher, LIMITS)).isComplete).toBe(false);
  });

  it('題か URL の無い項目があれば、応答の形の誤りとして失敗する（FR-020）', async () => {
    const broken = rss.replace('<title><![CDATA[作り物の記事]]></title>', '');
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(broken) });

    await expect(fetchListing(fetcher, LIMITS)).rejects.toThrow(/形/);
  });

  it('読めない公開日があれば失敗する', async () => {
    const broken = rss.replace('Tue, 09 Sep 2025 08:02:10 GMT', '作り物の日付');
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(broken) });

    await expect(fetchListing(fetcher, LIMITS)).rejects.toThrow(/公開日/);
  });
});
