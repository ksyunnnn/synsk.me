import 'server-only';

import type { GoneCheck } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import {
  SourceHttpError,
  createSourceHttp,
  type Fetcher,
} from '@/features/activity/server/sources/fetch-with-limits';

/**
 * 1 つの URL が取得元で消えたかを確かめる（specs/004-external-activity/research.md の R6）。404 なら
 * 消えた、2xx なら残っている、ほか（3xx・5xx・待ち時間・大きさの上限・ほかの 4xx）は判定しない。
 * リダイレクトは辿らない。移った先の 404 は、元の URL が消えた証拠にならない（FR-020）
 * 使い手は Zenn と Speaker Deck（無い URL で 404、ある URL で 200 を返すことを 2026-11-09 に実測）
 */
export const checkGoneByStatus = async (
  fetcher: Fetcher,
  url: string,
  limits: FetchLimits,
): Promise<GoneCheck> => {
  try {
    await createSourceHttp(fetcher, limits, { followRedirects: false }).get(url);
    return 'present';
  } catch (error) {
    return error instanceof SourceHttpError && error.status === 404 ? 'gone' : 'unknown';
  }
};
