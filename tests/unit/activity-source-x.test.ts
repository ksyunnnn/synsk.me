import { describe, expect, it } from 'vitest';
import { fetchByUrl } from '@/features/activity/server/sources/x';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { createFakeFetcher, jsonResponse } from '../support/activity-fakes';

/**
 * X の oEmbed の応答を詰め替える（#176「X を取り込む」、FR-009、research.md の R7・R10）。
 * oEmbed は題を返さないので、題を持たない（plan.md の U11 の (a)）。応答は作り物
 */

const LIMITS: FetchLimits = { maxRequests: 1, timeoutMs: 1000, maxBytes: 100_000 };
const URL_ = 'https://x.com/fake_user/status/1000000000000000000';
const OEMBED = `https://publish.twitter.com/oembed?url=${encodeURIComponent(URL_)}&omit_script=true`;

describe('X', () => {
  it('投稿があれば URL だけを返し、題・画像・公開日を持たない', async () => {
    const { fetcher } = createFakeFetcher({
      [OEMBED]: jsonResponse({
        url: URL_,
        author_name: '作り物の名前',
        author_url: 'https://twitter.com/fake_user',
        html: '<blockquote class="twitter-tweet"><p>作り物の投稿</p></blockquote>',
        type: 'rich',
      }),
    });

    expect(await fetchByUrl(fetcher, URL_, LIMITS)).toEqual({ url: URL_ });
  });

  it('無い投稿（404）なら取れない（null）', async () => {
    const { fetcher } = createFakeFetcher({});

    expect(await fetchByUrl(fetcher, URL_, LIMITS)).toBeNull();
  });

  it('html の無い応答なら取れない（null）', async () => {
    const { fetcher } = createFakeFetcher({ [OEMBED]: jsonResponse({ type: 'rich' }) });

    expect(await fetchByUrl(fetcher, URL_, LIMITS)).toBeNull();
  });

  it('取得元の不調（5xx）は投げる', async () => {
    const { fetcher } = createFakeFetcher({
      [OEMBED]: () => new Response('', { status: 503 }),
    });

    await expect(fetchByUrl(fetcher, URL_, LIMITS)).rejects.toThrow();
  });
});
