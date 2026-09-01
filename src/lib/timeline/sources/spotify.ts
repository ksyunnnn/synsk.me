import { SPOTIFY_PLAYLISTS } from '@/data/manual-entries';
import { fetchWithTimeout } from '../registry';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * oEmbed は認証不要で、指定したプレイリストのタイトルとジャケット画像を返す。
 * ユーザーのプレイリスト一覧を返す経路ではないため、掲載対象は
 * `src/data/manual-entries.ts` で指名する。
 */
const OEMBED = 'https://open.spotify.com/oembed';
const REFERENCE = 'https://developer.spotify.com/documentation/embeds';

interface SpotifyOembed {
  title: string;
  thumbnail_url: string;
  iframe_url: string;
}

export const spotifySource: TimelineSource = {
  platform: 'spotify',
  label: 'Spotify',
  fetch: async (): Promise<SourceResult> => {
    const settled = await Promise.allSettled(
      SPOTIFY_PLAYLISTS.map(async (ref) => {
        const response = await fetchWithTimeout(`${OEMBED}?url=${encodeURIComponent(ref.url)}`);
        if (!response.ok) throw new Error(`${ref.url} → ${response.status}`);
        const data = (await response.json()) as SpotifyOembed;

        const entry: TimelineEntry = {
          id: `spotify:${ref.url}`,
          kind: 'playlist',
          platform: 'spotify',
          title: data.title,
          url: ref.url,
          publishedAt: ref.registeredAt,
          thumbnailUrl: data.thumbnail_url,
          embedUrl: data.iframe_url,
        };
        return entry;
      }),
    );

    const entries = settled
      .filter((result): result is PromiseFulfilledResult<TimelineEntry> => result.status === 'fulfilled')
      .map((result) => result.value);
    const failed = settled.length - entries.length;

    if (entries.length === 0) {
      return {
        platform: 'spotify',
        status: 'error',
        entries: [],
        note: `oEmbed の取得が ${settled.length} 件すべて失敗した。`,
        reference: REFERENCE,
      };
    }

    return {
      platform: 'spotify',
      status: 'ok',
      entries,
      note:
        `oEmbed から ${entries.length} 件取得した` +
        (failed > 0 ? `（${failed} 件が失敗）` : '') +
        '。一覧取得の経路が無いため掲載対象は src/data/manual-entries.ts で指名する。並び順の日付は登録日。',
      reference: REFERENCE,
    };
  },
};
