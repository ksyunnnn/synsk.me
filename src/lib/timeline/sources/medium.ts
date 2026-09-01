import { fetchText, PER_SOURCE_LIMIT } from '../registry';
import { firstImageUrl, itemGuid, parseRssItems, stripHtml, toIsoDate } from '../rss';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * Medium API は提供終了している（Medium/medium-api-docs の README に明記、2023-03-02 アーカイブ）。
 * RSS のみ。10 件固定でページングの手段は無い。
 */
const FEED_URL = 'https://medium.com/feed/@ksyunnnn';
const REFERENCE = 'https://github.com/Medium/medium-api-docs';

/** RSS の link に付く `?source=rss-...` を落とす。 */
function cleanUrl(url: string): string {
  const index = url.indexOf('?source=');
  return index === -1 ? url : url.slice(0, index);
}

export const mediumSource: TimelineSource = {
  platform: 'medium',
  label: 'Medium',
  fetch: async (): Promise<SourceResult> => {
    const response = await fetchText(FEED_URL);
    if (!response.ok || response.body === undefined) {
      return {
        platform: 'medium',
        status: 'error',
        entries: [],
        note: `RSS の取得が ${response.status} で失敗した。`,
        reference: REFERENCE,
      };
    }

    const items = parseRssItems(response.body);
    const entries: TimelineEntry[] = [];

    for (const item of items) {
      const publishedAt = toIsoDate(item.pubDate);
      const rawUrl = item.link ?? itemGuid(item);
      if (!publishedAt || !rawUrl || !item.title) continue;

      const html = item['content:encoded'];
      entries.push({
        id: `medium:${itemGuid(item) ?? rawUrl}`,
        kind: 'article',
        platform: 'medium',
        title: String(item.title),
        url: cleanUrl(rawUrl),
        publishedAt,
        summary: stripHtml(html),
        thumbnailUrl: firstImageUrl(html),
        tags: item.category?.map(String),
      });
    }

    return {
      platform: 'medium',
      status: 'ok',
      entries: entries.slice(0, PER_SOURCE_LIMIT),
      note: 'Medium API は提供終了のため RSS から取得する。10 件固定、いいね数は取得できない。',
      reference: REFERENCE,
    };
  },
};
