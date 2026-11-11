import 'server-only';

import type { UrlFetchedItem } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import {
  createSourceHttp,
  isClientError,
  type Fetcher,
} from '@/features/activity/server/sources/fetch-with-limits';
import { isRecord, isText, parseJson } from '@/features/activity/server/sources/shape';

/**
 * X（#176「X を取り込む」）。オーナーが指名した投稿の URL を、公式の oEmbed
 * （`publish.twitter.com/oembed`）で確かめる。oEmbed は題の項目を返さない（research.md の R7）ので
 * 題を返さず、登録ではオーナーが入れた題で保存する（plan.md の U11 の (a)。2026-11-10 に PM が
 * 決めた）。投稿の文を題にしない: 取った値を題に決め打ちすることになり、#281 でオーナーが望んだ
 * 「取った値を初期値にして直す」形と違うため。画像と公開日も返さない。
 *
 * 項目が無い（4xx）か、応答が oEmbed の形でない（`html` が無い）ときは null、取得元の不調
 * （5xx・待ち時間・大きさ）は投げる。URL のホストは登録のユースケースが
 * `src/features/activity/domain/sources.ts` の表で確かめる（R10）
 */
export const fetchByUrl = async (
  fetcher: Fetcher,
  url: string,
  limits: FetchLimits,
): Promise<UrlFetchedItem | null> => {
  let text;
  try {
    ({ text } = await createSourceHttp(fetcher, limits).get(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
    ));
  } catch (error) {
    if (isClientError(error)) return null;
    throw error;
  }
  const body = parseJson('X', text);
  return isRecord(body) && isText(body.html) ? { url } : null;
};
