import 'server-only';

import type { FetchedItem, SourceListing } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import {
  createSourceHttp,
  type Fetcher,
} from '@/features/activity/server/sources/fetch-with-limits';
import { readRssItems } from '@/features/activity/server/sources/rss';
import { isText, shapeError, toIsoDateTime } from '@/features/activity/server/sources/shape';

/**
 * Medium（#171「Medium を取り込む」）。公式の RSS を読む。guid を ID にし、link は問い合わせの
 * 部分を除いて URL にする。画像は本文（`content:encoded`）の先頭の `<img>` から取る。RSS は
 * 10 件で打ち切るので、すべて取ったことにしない（specs/004-external-activity/research.md の R7）
 */

const FEED = 'https://medium.com/feed/@ksyunnnn';
const NAME = 'Medium';

export const fetchListing = async (
  fetcher: Fetcher,
  limits: FetchLimits,
): Promise<SourceListing> => {
  const { text } = await createSourceHttp(fetcher, limits).get(FEED);
  const items = readRssItems(text).map((item): FetchedItem => {
    const { title, link, guid, pubDate } = item;
    if (!isText(title) || !isText(link) || !isText(guid)) {
      throw shapeError(NAME, '題・URL・guid の無い項目がある');
    }
    const imageUrl = firstImage(item['content:encoded'] ?? '');
    return {
      url: withoutQuery(link),
      title,
      ...(isText(pubDate) && { publishedAt: toIsoDateTime(NAME, pubDate) }),
      externalId: guid,
      ...(imageUrl !== null && { imageUrl }),
    };
  });
  return { items, isComplete: false };
};

const withoutQuery = (link: string): string => {
  const url = new URL(link);
  url.search = '';
  url.hash = '';
  return url.toString();
};

const firstImage = (html: string): string | null => {
  const src = /<img\b[^>]*?\bsrc\s*=\s*"([^"]+)"/i.exec(html)?.[1];
  return isText(src) ? src : null;
};
