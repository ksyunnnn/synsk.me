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

  it.each([
    'https://youtu.be/fakefake000?si=fake-share',
    'https://m.youtube.com/watch?v=fakefake000',
    'https://www.youtube.com/shorts/fakefake000',
    'https://www.youtube.com/watch?v=fakefake000&si=fake-share',
    'https://www.youtube.com/live/fakefake000',
    'https://www.youtube.com/embed/fakefake000',
  ])('%s は www.youtube.com/watch?v=<ID> に揃えて取る（research.md の R10）', async (url) => {
    const { fetcher, requested } = createFakeFetcher({
      [OEMBED]: jsonResponse({ title: '作り物の動画' }),
    });

    expect((await fetchByUrl(fetcher, url, LIMITS))?.url).toBe(URL_);
    expect(requested.map((request) => request.url)).toEqual([OEMBED]);
  });

  it.each([
    'https://example.com/watch?v=fakefake000',
    'https://www.youtube.com/watch?v=fakefake000&list=PLfake',
  ])('%s は揃えない。ほかのホストと、プレイリストの中の再生', async (url) => {
    const { fetcher, requested } = createFakeFetcher({});

    await fetchByUrl(fetcher, url, LIMITS);
    expect(requested.map((request) => request.url)).toEqual([
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    ]);
  });
});
