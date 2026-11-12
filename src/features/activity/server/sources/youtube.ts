import 'server-only';

import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import type { Fetcher } from '@/features/activity/server/sources/fetch-with-limits';
import { SOURCES } from '@/features/activity/domain/sources';
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
): Promise<FetchedItem | null> => {
  const canonical = canonicalYouTubeUrl(url);
  return fetchOEmbed(
    'YouTube',
    fetcher,
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`,
    canonical,
    limits,
  );
};

/** 動画の ID の形。YouTube の ID は英数字と `-`・`_` */
const VIDEO_ID = /^[\w-]+$/;

/**
 * 同じ動画を指す URL の表記を `https://www.youtube.com/watch?v=<ID>` に揃える（research.md の R10）。
 * `youtu.be/<ID>`・`m.youtube.com/watch?v=<ID>`・`www.youtube.com/shorts/<ID>`・`/live/<ID>`・`/embed/<ID>` と、共有の印
 * `si` などのクエリが付いた形は、oEmbed がどれも同じ動画を返した（2026-11-09 実測）。動画の ID を
 * 読めない URL はそのまま返す
 */
const canonicalYouTubeUrl = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  // 取得元のホストの URL だけを揃える（research.md の R10）
  if (!(SOURCES.youtube.hosts as readonly string[]).includes(parsed.hostname)) return url;
  // プレイリストの中の再生は、動画 1 本の URL にすると別のプレイリストが 1 つにまとまるので揃えない
  if (parsed.searchParams.has('list')) return url;
  const [first, second] = parsed.pathname.split('/').filter(Boolean);
  const id =
    parsed.hostname === 'youtu.be'
      ? first
      : first === 'shorts' || first === 'live' || first === 'embed'
        ? second
        : first === 'watch'
          ? (parsed.searchParams.get('v') ?? undefined)
          : undefined;
  return id !== undefined && VIDEO_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : url;
};
