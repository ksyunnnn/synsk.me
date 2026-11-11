import { describe, expect, it } from 'vitest';
import { fetchListing } from '@/features/activity/server/sources/speakerdeck';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { asListing, createFakeFetcher, xmlResponse } from '../support/activity-fakes';

/**
 * Speaker Deck の RSS を `FetchedItem` に詰め替える（FR-006・FR-007、research.md の R7）。
 * 応答の形は PR #47 の検証記録（2026-09-02 実測）に合わせた作り物
 */

const FEED = 'https://speakerdeck.com/ksyunnnn.rss';
const LIMITS: FetchLimits = { maxRequests: 1, timeoutMs: 1000, maxBytes: 1_000_000 };

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>ksyunnnn</title>
    <item>
      <title>作り物の登壇資料</title>
      <description>https://example.com/fake-event/</description>
      <media:content url="https://files.speakerdeck.com/presentations/fake/preview_slide_0.jpg?1" type="image/jpeg" medium="image"/>
      <content:encoded>https://example.com/fake-event/</content:encoded>
      <pubDate>Fri, 13 Sep 2019 00:00:00 -0400</pubDate>
      <link>https://speakerdeck.com/ksyunnnn/fake-deck</link>
      <guid>https://speakerdeck.com/ksyunnnn/fake-deck</guid>
    </item>
  </channel>
</rss>`;

describe('Speaker Deck', () => {
  it('RSS の項目を、URL・題・公開日・1 枚目の画像の URL に詰め替え、ID を持たない', async () => {
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(rss) });

    const listing = asListing(await fetchListing(fetcher, LIMITS));

    expect(listing.items).toEqual([
      {
        url: 'https://speakerdeck.com/ksyunnnn/fake-deck',
        title: '作り物の登壇資料',
        publishedAt: '2019-09-13T04:00:00.000Z',
        imageUrl: 'https://files.speakerdeck.com/presentations/fake/preview_slide_0.jpg?1',
      },
    ]);
  });

  it('全件を返すかを確かめていないので、すべて取ったことにしない（FR-018）', async () => {
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(rss) });

    expect(asListing(await fetchListing(fetcher, LIMITS)).isComplete).toBe(false);
  });
});
