import { fetchWithTimeout, PER_SOURCE_LIMIT } from '../registry';
import { itemGuid, parseRssItems, stripHtml, toIsoDate } from '../rss';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * Zenn は公開 API を持たない。
 * Zenn 運営メンバーが zenn-dev/zenn-community#496 で「公開しているAPIはありません」と回答している。
 * Zenn 自身が配信する RSS を使う。`https://zenn.dev/api/articles` は動作するが非公式のため採らない。
 */
const FEED_URL = 'https://zenn.dev/ksyunnnn/feed';
const REFERENCE = 'https://github.com/zenn-dev/zenn-community/issues/496';

export const zennSource: TimelineSource = {
  platform: 'zenn',
  label: 'Zenn',
  fetch: async (): Promise<SourceResult> => {
    const response = await fetchWithTimeout(FEED_URL);
    if (!response.ok) {
      return {
        platform: 'zenn',
        status: 'error',
        entries: [],
        note: `RSS の取得が ${response.status} で失敗した。`,
        reference: REFERENCE,
      };
    }

    const items = parseRssItems(await response.text());
    const entries: TimelineEntry[] = [];

    for (const item of items) {
      const publishedAt = toIsoDate(item.pubDate);
      const url = item.link ?? itemGuid(item);
      if (!publishedAt || !url || !item.title) continue;

      entries.push({
        id: `zenn:${url}`,
        kind: 'article',
        platform: 'zenn',
        title: String(item.title),
        url,
        publishedAt,
        summary: stripHtml(item.description),
      });
    }

    return {
      platform: 'zenn',
      status: 'ok',
      entries: entries.slice(0, PER_SOURCE_LIMIT),
      note: 'Zenn は公開 API を持たないため RSS から取得する。RSS は 20 件固定。',
      reference: REFERENCE,
    };
  },
};
