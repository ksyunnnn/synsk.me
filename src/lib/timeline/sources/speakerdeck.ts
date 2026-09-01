import { fetchWithTimeout, PER_SOURCE_LIMIT } from '../registry';
import { itemGuid, itemMediaUrl, parseRssItems, stripHtml, toIsoDate } from '../rss';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * Speaker Deck に REST API は無い。公式 FAQ が案内するのは oEmbed だけで、
 * これは個別デッキ指定のため一覧を取れない。一覧は RSS から取る。
 */
const FEED_URL = 'https://speakerdeck.com/ksyunnnn.rss';
const REFERENCE = 'https://speakerdeck.com/faq';

export const speakerdeckSource: TimelineSource = {
  platform: 'speakerdeck',
  label: 'Speaker Deck',
  fetch: async (): Promise<SourceResult> => {
    const response = await fetchWithTimeout(FEED_URL);
    if (!response.ok) {
      return {
        platform: 'speakerdeck',
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
        id: `speakerdeck:${url}`,
        kind: 'talk',
        platform: 'speakerdeck',
        title: String(item.title),
        url,
        publishedAt,
        summary: stripHtml(item.description),
        thumbnailUrl: itemMediaUrl(item),
      });
    }

    return {
      platform: 'speakerdeck',
      status: 'ok',
      entries: entries.slice(0, PER_SOURCE_LIMIT),
      note: 'REST API が無いため RSS から取得する。1 枚目スライドの画像が media:content に入る。',
      reference: REFERENCE,
    };
  },
};
