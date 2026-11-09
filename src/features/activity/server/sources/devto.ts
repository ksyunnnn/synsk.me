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
 * dev.to（#170「dev.to を取り込む」）。公式の Forem API v1 を読む。ID で同じ項目を判定する。
 * 空の頁まで辿ったら、すべて取ったことにする（specs/004-external-activity/research.md の R7）。
 * User-Agent が空だと 403 を返すので、`createSourceHttp` が付ける値で要求する。画像は表紙
 * （`cover_image`）を、無ければ共有用の画像（`social_image`）を使う
 */

const NAME = 'dev.to';
const PER_PAGE = 100;

const pageUrl = (page: number) =>
  `https://dev.to/api/articles?username=ksyunnnn&page=${page}&per_page=${PER_PAGE}`;

export const fetchListing = async (
  fetcher: Fetcher,
  limits: FetchLimits,
): Promise<SourceListing> => {
  const http = createSourceHttp(fetcher, limits);
  const items: FetchedItem[] = [];

  for (let page = 1; http.remaining > 0; page += 1) {
    const body = parseJson(NAME, (await http.get(pageUrl(page))).text);
    if (!Array.isArray(body)) throw shapeError(NAME, '記事の並びでない');
    if (body.length === 0) return { items, isComplete: true };
    items.push(...body.map(toItem));
  }
  return { items, isComplete: false };
};

const toItem = (value: unknown): FetchedItem => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    !isText(value.title) ||
    !isText(value.url) ||
    !isText(value.published_at)
  ) {
    throw shapeError(NAME, 'id・題・URL・公開日の無い記事がある');
  }
  const imageUrl = isText(value.cover_image)
    ? value.cover_image
    : isText(value.social_image)
      ? value.social_image
      : null;
  return {
    url: value.url,
    title: value.title,
    publishedAt: toIsoDateTime(NAME, value.published_at),
    externalId: String(value.id),
    ...(imageUrl !== null && { imageUrl }),
  };
};
