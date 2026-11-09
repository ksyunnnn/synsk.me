import 'server-only';

import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import type { Fetcher } from '@/features/activity/server/sources/fetch-with-limits';
import { fetchOEmbed } from '@/features/activity/server/sources/oembed';

/**
 * YouTube。オーナーが指名した動画の URL から、公式の oEmbed で題と画像を取る。公開日は返さない
 * （spec の Assumptions、2026-11-04 実測）。無い動画は 404（2026-11-09 実測）。URL のホストは
 * 登録のユースケースが `src/features/activity/domain/sources.ts` の表で確かめる（research.md の R10）
 */
export const fetchByUrl = (
  fetcher: Fetcher,
  url: string,
  limits: FetchLimits,
): Promise<FetchedItem | null> =>
  fetchOEmbed(
    'YouTube',
    fetcher,
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    url,
    limits,
  );
