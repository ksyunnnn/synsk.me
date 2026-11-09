import { describe, expect, it } from 'vitest';
import { fetchByUrl } from '@/features/activity/server/sources/spotify';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { createFakeFetcher, jsonResponse } from '../support/activity-fakes';

/**
 * Spotify の oEmbed の応答を `FetchedItem` に詰め替える（#175「Spotify を取り込む」、FR-009、
 * research.md の R7・R10）。応答の形は PR #47 の検証記録（2026-09-02 実測）に合わせた作り物
 */

const LIMITS: FetchLimits = { maxRequests: 1, timeoutMs: 1000, maxBytes: 100_000 };
const URL_ = 'https://open.spotify.com/playlist/0000000000000000000fake';
const OEMBED = `https://open.spotify.com/oembed?url=${encodeURIComponent(URL_)}`;

describe('Spotify', () => {
  it('題と画像の URL を詰め替え、公開日と ID を持たない', async () => {
    const { fetcher } = createFakeFetcher({
      [OEMBED]: jsonResponse({
        title: '作り物のプレイリスト',
        thumbnail_url: 'https://mosaic.scdn.co/300/fake',
        iframe_url: 'https://open.spotify.com/embed/playlist/0000000000000000000fake',
        width: 456,
        height: 352,
      }),
    });

    expect(await fetchByUrl(fetcher, URL_, LIMITS)).toEqual({
      url: URL_,
      title: '作り物のプレイリスト',
      imageUrl: 'https://mosaic.scdn.co/300/fake',
    });
  });

  it('無い URL（404）なら取れない（null）', async () => {
    const { fetcher } = createFakeFetcher({});

    expect(await fetchByUrl(fetcher, URL_, LIMITS)).toBeNull();
  });

  it('題が無ければ取れない（null）', async () => {
    const { fetcher } = createFakeFetcher({ [OEMBED]: jsonResponse({ title: '' }) });

    expect(await fetchByUrl(fetcher, URL_, LIMITS)).toBeNull();
  });

  it('取得元の不調（5xx）は、取れないと区別して失敗にする', async () => {
    const { fetcher } = createFakeFetcher({
      [OEMBED]: () => new Response('', { status: 503 }),
    });

    await expect(fetchByUrl(fetcher, URL_, LIMITS)).rejects.toThrow(/503/);
  });

  it.each([403, 429])(
    '項目が無いことを表さない 4xx（%i）も、取れないと区別して失敗にする',
    async (status) => {
      const { fetcher } = createFakeFetcher({ [OEMBED]: () => new Response('', { status }) });

      await expect(fetchByUrl(fetcher, URL_, LIMITS)).rejects.toThrow(String(status));
    },
  );
});
