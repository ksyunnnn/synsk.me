import 'server-only';

import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import type { Fetcher } from '@/features/activity/server/sources/fetch-with-limits';
import { fetchOEmbed } from '@/features/activity/server/sources/oembed';

/**
 * Spotify（#175「Spotify を取り込む」）。オーナーが指名したプレイリストの URL から、公式の oEmbed で
 * 題と画像を取る。一覧を取る経路は無い（検証記録）。URL のホストは登録のユースケースが
 * `src/features/activity/domain/sources.ts` の表で確かめる（research.md の R10）
 */
export const fetchByUrl = (
  fetcher: Fetcher,
  url: string,
  limits: FetchLimits,
): Promise<FetchedItem | null> => {
  const canonical = canonicalSpotifyUrl(url);
  return fetchOEmbed(
    'Spotify',
    fetcher,
    `https://open.spotify.com/oembed?url=${encodeURIComponent(canonical)}`,
    canonical,
    limits,
  );
};

/**
 * 共有の印 `si` を除く（research.md の R10）。アプリの「共有」が付ける値で、付けても付けなくても
 * oEmbed は同じプレイリストを返した（2026-11-09 実測）。ほかのクエリは残す
 */
export const canonicalSpotifyUrl = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.searchParams.has('si')) return url;
  parsed.searchParams.delete('si');
  return parsed.href;
};
