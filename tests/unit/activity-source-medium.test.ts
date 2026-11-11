import { describe, expect, it } from 'vitest';
import { fetchListing } from '@/features/activity/server/sources/medium';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { asListing, createFakeFetcher, xmlResponse } from '../support/activity-fakes';

/**
 * Medium の RSS を `FetchedItem` に詰め替える（FR-006・FR-007、research.md の R7）。応答の形は
 * PR #47 の検証記録（2026-09-02 実測）に合わせた作り物
 */

const FEED = 'https://medium.com/feed/@ksyunnnn';
const LIMITS: FetchLimits = { maxRequests: 1, timeoutMs: 1000, maxBytes: 1_000_000 };

const item = (content: string) => `<item>
  <title><![CDATA[作り物の記事]]></title>
  <link>https://medium.com/syunsukekobashi/fake-article-000000000000?source=rss-fake------2</link>
  <guid isPermaLink="false">https://medium.com/p/000000000000</guid>
  <category><![CDATA[作り物]]></category>
  <pubDate>Sun, 03 Jan 2021 12:13:20 GMT</pubDate>
  <content:encoded><![CDATA[${content}]]></content:encoded>
</item>`;

const rss = (items: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0"><channel><title><![CDATA[作り物]]></title>${items}</channel></rss>`;

describe('Medium', () => {
  it('guid を ID に、問い合わせを除いた link を URL に、本文の先頭の画像を画像の URL にする', async () => {
    const { fetcher } = createFakeFetcher({
      [FEED]: xmlResponse(
        rss(
          item(
            '<h4>作り物</h4><figure><img alt="" src="https://cdn-images-1.medium.com/max/1024/fake-1.jpeg" /></figure><img src="https://cdn-images-1.medium.com/fake-2.jpeg">',
          ),
        ),
      ),
    });

    const listing = asListing(await fetchListing(fetcher, LIMITS));

    expect(listing.items).toEqual([
      {
        url: 'https://medium.com/syunsukekobashi/fake-article-000000000000',
        title: '作り物の記事',
        publishedAt: '2021-01-03T12:13:20.000Z',
        externalId: 'https://medium.com/p/000000000000',
        imageUrl: 'https://cdn-images-1.medium.com/max/1024/fake-1.jpeg',
      },
    ]);
  });

  it('本文に画像が無ければ画像の URL を持たない', async () => {
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(rss(item('<p>作り物</p>'))) });

    const [first] = asListing(await fetchListing(fetcher, LIMITS)).items;

    expect(first).not.toHaveProperty('imageUrl');
  });

  it('RSS は 10 件で打ち切るので、すべて取ったことにしない（FR-018）', async () => {
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(rss(item('<p>作り物</p>'))) });

    expect(asListing(await fetchListing(fetcher, LIMITS)).isComplete).toBe(false);
  });

  it('guid の無い項目があれば、応答の形の誤りとして失敗する（FR-020）', async () => {
    const broken = rss(item('<p>作り物</p>')).replace(
      '<guid isPermaLink="false">https://medium.com/p/000000000000</guid>',
      '',
    );
    const { fetcher } = createFakeFetcher({ [FEED]: xmlResponse(broken) });

    await expect(fetchListing(fetcher, LIMITS)).rejects.toThrow(/形/);
  });
});
