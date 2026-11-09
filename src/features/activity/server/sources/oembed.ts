import 'server-only';

import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import {
  createSourceHttp,
  isClientError,
  type Fetcher,
} from '@/features/activity/server/sources/fetch-with-limits';
import { isRecord, isText, parseJson } from '@/features/activity/server/sources/shape';

/**
 * oEmbed（https://oembed.com/）の応答から `FetchedItem` を作る。使い手は Spotify と YouTube の
 * 取得元ごとの処理。題（`title`）と画像（`thumbnail_url`）を取り、公開日と ID は返さない
 * （specs/004-external-activity/research.md の R7）。項目を取れない（4xx・題が無い）ときは null、
 * 取得元の不調（5xx・待ち時間・大きさ）は投げる
 */
export const fetchOEmbed = async (
  name: string,
  fetcher: Fetcher,
  endpoint: string,
  url: string,
  limits: FetchLimits,
): Promise<FetchedItem | null> => {
  let text;
  try {
    ({ text } = await createSourceHttp(fetcher, limits).get(endpoint));
  } catch (error) {
    if (isClientError(error)) return null;
    throw error;
  }
  const body = parseJson(name, text);
  if (!isRecord(body) || !isText(body.title)) return null;
  return {
    url,
    title: body.title.trim(),
    ...(isText(body.thumbnail_url) && { imageUrl: body.thumbnail_url }),
  };
};
