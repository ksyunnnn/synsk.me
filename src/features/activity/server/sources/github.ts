import 'server-only';

import type {
  FetchedItem,
  NotModified,
  SourceListing,
  Validators,
} from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { conditionalHeaders, validatorsOf } from '@/features/activity/server/sources/conditional';
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
 * GitHub（#173「GitHub を取り込む」）。公式の REST API の `/users/ksyunnnn/repos` を読む。
 * ID で同じ項目を判定し、公開日は `created_at` を使う。`per_page` 未満の頁まで辿ったら、
 * すべて取ったことにする（specs/004-external-activity/research.md の R7）。トークンが無ければ
 * 未認証で取る（R15）
 *
 * 作成日時の古い順に並べ、新しいリポジトリが最後の頁に足されるようにする。頁を辿るあいだに
 * 足されても、取った頁の境目がずれない
 */

const NAME = 'GitHub';
/** API が受け付ける 1 頁の件数の上限（https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user） */
const PER_PAGE = 100;

const pageUrl = (page: number) =>
  `https://api.github.com/users/ksyunnnn/repos?type=owner&sort=created&direction=asc&per_page=${PER_PAGE}&page=${page}`;

export const fetchListing = async (
  fetcher: Fetcher,
  limits: FetchLimits,
  token?: string,
  previous?: Validators | null,
): Promise<SourceListing | NotModified> => {
  const http = createSourceHttp(fetcher, limits);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
  const items: FetchedItem[] = [];

  for (let page = 1; http.remaining > 0; page += 1) {
    // 前の取得を 1 頁で取り切ったときだけ値を持つので、条件は 1 頁目にだけ付ける（research.md の R9）
    const response = await http.get(
      pageUrl(page),
      page === 1 ? { ...headers, ...conditionalHeaders(previous) } : headers,
    );
    if (response.status === 304) return { notModified: true };
    const body = parseJson(NAME, response.text);
    if (!Array.isArray(body)) throw shapeError(NAME, 'リポジトリの並びでない');

    items.push(...body.map(toItem));
    if (body.length < PER_PAGE) {
      const validators = page === 1 ? validatorsOf(response.headers) : undefined;
      return { items, isComplete: true, ...(validators && { validators }) };
    }
  }
  return { items, isComplete: false };
};

const toItem = (value: unknown): FetchedItem => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    !isText(value.name) ||
    !isText(value.html_url) ||
    !isText(value.created_at)
  ) {
    throw shapeError(NAME, 'id・名前・URL・作成日時の無いリポジトリがある');
  }
  return {
    url: value.html_url,
    title: value.name,
    publishedAt: toIsoDateTime(NAME, value.created_at),
    externalId: String(value.id),
  };
};
