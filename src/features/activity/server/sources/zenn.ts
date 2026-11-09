import 'server-only';

import type {
  FetchedItem,
  NotModified,
  SourceListing,
  Validators,
} from '@/features/activity/domain/fetched-item';
import { conditionalHeaders, validatorsOf } from '@/features/activity/server/sources/conditional';
import { checkGoneByStatus } from '@/features/activity/server/sources/gone';
import type { FetchLimits } from '@/features/activity/domain/limits';
import {
  createSourceHttp,
  type Fetcher,
} from '@/features/activity/server/sources/fetch-with-limits';
import { readRssItems } from '@/features/activity/server/sources/rss';
import { isText, shapeError, toIsoDateTime } from '@/features/activity/server/sources/shape';

/**
 * Zenn（#168「外部の取得の仕組みを作り、Zenn を取り込む」）。公式の RSS を読む。guid は URL と
 * 同じなので ID を持たず、URL で同じ項目を判定する。RSS は 20 件で打ち切るので、すべて取った
 * ことにしない（specs/004-external-activity/research.md の R7）
 */

const FEED = 'https://zenn.dev/ksyunnnn/feed';
const NAME = 'Zenn';

export const fetchListing = async (
  fetcher: Fetcher,
  limits: FetchLimits,
  previous?: Validators | null,
): Promise<SourceListing | NotModified> => {
  const response = await createSourceHttp(fetcher, limits).get(FEED, conditionalHeaders(previous));
  if (response.status === 304) return { notModified: true };
  const { text } = response;
  const items = readRssItems(text).map((item): FetchedItem => {
    const { title, link, pubDate } = item;
    if (!isText(title) || !isText(link)) throw shapeError(NAME, '題か URL の無い項目がある');
    const imageUrl = item['enclosure@url'];
    return {
      url: link,
      title,
      ...(isText(pubDate) && { publishedAt: toIsoDateTime(NAME, pubDate) }),
      ...(isText(imageUrl) && { imageUrl }),
    };
  });
  const validators = validatorsOf(response.headers);
  return { items, isComplete: false, ...(validators && { validators }) };
};

/** 一覧に無い記事の URL が消えたかを確かめる。404 で消えた（research.md の R6） */
export const checkGone = checkGoneByStatus;
