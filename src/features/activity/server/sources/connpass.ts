import 'server-only';

import type { FetchedItem, SourceListing } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import {
  createSourceHttp,
  type Fetcher,
} from '@/features/activity/server/sources/fetch-with-limits';
import {
  isRecord,
  isText,
  parseJson,
  shapeError,
  toIsoDateTime,
} from '@/features/activity/server/sources/shape';

/**
 * connpass（#174「connpass を取り込む」）。公式の REST API v2 で参加したイベントを読む。ID で同じ
 * 項目を判定し、公開日は開始日時（`started_at`）を使う。`results_available` まで辿ったら、すべて
 * 取ったことにする（specs/004-external-activity/research.md の R7）。
 *
 * - API キーは必須。欠ければ要求を出さずに失敗にする（R15、constitution II）
 * - 要求は 5 秒に 1 回まで（申請の条件。R8）。頁の間で待つ
 * - 応答の形は公式の OpenAPI（https://connpass.com/about/api/v2/openapi.json の
 *   `EventListResponseSchema`）による。API キーが無いため実データでは確かめていない
 */

const NAME = 'connpass';
const COUNT = 100;
const INTERVAL_MS = 5000;

const pageUrl = (start: number) =>
  `https://connpass.com/api/v2/users/ksyunnnn/attended_events/?start=${start}&count=${COUNT}`;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const fetchListing = async (
  fetcher: Fetcher,
  limits: FetchLimits,
  apiKey: string | undefined,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<SourceListing> => {
  if (!apiKey) throw new Error('CONNPASS_API_KEY が無いので、connpass に要求を出さなかった');
  const http = createSourceHttp(fetcher, limits);
  const items: FetchedItem[] = [];

  for (let start = 1; ; start += COUNT) {
    if (http.remaining === 0) return { items, isComplete: false };
    if (start > 1) await wait(INTERVAL_MS);
    const body = parseJson(NAME, (await http.get(pageUrl(start), { 'X-API-Key': apiKey })).text);
    if (
      !isRecord(body) ||
      !Array.isArray(body.events) ||
      typeof body.results_available !== 'number'
    ) {
      throw shapeError(NAME, 'events と results_available が無い');
    }
    items.push(...body.events.map(toItem));
    if (items.length >= body.results_available) return { items, isComplete: true };
    if (body.events.length === 0) return { items, isComplete: false };
  }
};

const toItem = (value: unknown): FetchedItem => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    !isText(value.title) ||
    !isText(value.url) ||
    !isText(value.started_at)
  ) {
    throw shapeError(NAME, 'id・題・URL・開始日時の無いイベントがある');
  }
  return {
    url: value.url,
    title: value.title,
    publishedAt: toIsoDateTime(NAME, value.started_at),
    externalId: String(value.id),
    ...(isText(value.image_url) && { imageUrl: value.image_url }),
  };
};
