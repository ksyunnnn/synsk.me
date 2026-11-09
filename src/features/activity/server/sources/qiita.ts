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
 * Qiita（#169「Qiita を取り込む」）。公式の REST API v2 を読む。ID で同じ項目を判定し、
 * 公開日は `created_at` を使う。応答の見出し `Total-Count` まで頁を辿ったら、すべて取った
 * ことにする（specs/004-external-activity/research.md の R7）。アクセストークンが無ければ
 * 未認証で取る（R15）
 *
 * 1 頁は 20 件にする。項目が本文の全文を持ち、100 件の頁は 941 KB になった（2026-11-09、77 件の実測）。
 * 1 本の応答の大きさの上限（R8）の内側に収めるため
 */

const NAME = 'Qiita';
const PER_PAGE = 20;
/** API が受け付ける頁の番号の上限（https://qiita.com/api/v2/docs） */
const MAX_PAGE = 100;

const pageUrl = (page: number) =>
  `https://qiita.com/api/v2/users/ksyunnnn/items?page=${page}&per_page=${PER_PAGE}`;

export const fetchListing = async (
  fetcher: Fetcher,
  limits: FetchLimits,
  accessToken?: string,
): Promise<SourceListing> => {
  const http = createSourceHttp(fetcher, limits);
  const headers: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};
  const items: FetchedItem[] = [];

  for (let page = 1; page <= MAX_PAGE; page += 1) {
    if (http.remaining === 0) return { items, isComplete: false };
    const response = await http.get(pageUrl(page), headers);
    const total = Number(response.headers.get('Total-Count') ?? Number.NaN);
    if (!Number.isInteger(total)) throw shapeError(NAME, 'Total-Count が無い');
    const body = parseJson(NAME, response.text);
    if (!Array.isArray(body)) throw shapeError(NAME, '項目の並びでない');

    items.push(...body.map(toItem));
    if (items.length >= total) return { items, isComplete: true };
    if (body.length === 0) return { items, isComplete: false };
  }
  return { items, isComplete: false };
};

const toItem = (value: unknown): FetchedItem => {
  if (
    !isRecord(value) ||
    !isText(value.id) ||
    !isText(value.title) ||
    !isText(value.url) ||
    !isText(value.created_at)
  ) {
    throw shapeError(NAME, 'id・題・URL・作成日時の無い項目がある');
  }
  return {
    url: value.url,
    title: value.title,
    publishedAt: toIsoDateTime(NAME, value.created_at),
    externalId: value.id,
  };
};
