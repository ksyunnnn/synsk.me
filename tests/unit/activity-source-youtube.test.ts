import { describe, expect, it } from 'vitest';
import { fetchByUrl } from '@/features/activity/server/sources/youtube';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { createFakeFetcher, jsonResponse } from '../support/activity-fakes';

/**
 * YouTube の oEmbed の応答を `FetchedItem` に詰め替える（FR-009、research.md の R7・R10）。
 * 応答の形は spec の Assumptions（2026-11-04 実測）と 2026-11-09 の実測に合わせた作り物
 */

const LIMITS: FetchLimits = { maxRequests: 1, timeoutMs: 1000, maxBytes: 100_000 };
const URL_ = 'https://www.youtube.com/watch?v=fakefake000';
const OEMBED = `https://www.youtube.com/oembed?url=${encodeURIComponent(URL_)}&format=json`;

describe('YouTube', () => {
  it('題と画像の URL を詰め替え、公開日と ID を持たない', async () => {
    const { fetcher } = createFakeFetcher({
      [OEMBED]: jsonResponse({
        title: '作り物の動画',
        author_name: '作り物の人',
        type: 'video',
        thumbnail_url: 'https://i.ytimg.com/vi/fakefake000/hqdefault.jpg',
      }),
    });

    expect(await fetchByUrl(fetcher, URL_, LIMITS)).toEqual({
      url: URL_,
      title: '作り物の動画',
      imageUrl: 'https://i.ytimg.com/vi/fakefake000/hqdefault.jpg',
    });
  });

  it('無い動画（404）なら取れない（null）', async () => {
    const { fetcher } = createFakeFetcher({});

    expect(await fetchByUrl(fetcher, URL_, LIMITS)).toBeNull();
  });
});
