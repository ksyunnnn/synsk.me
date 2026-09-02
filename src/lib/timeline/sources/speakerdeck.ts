import { fetchJson, fetchText, PER_SOURCE_LIMIT } from '../registry';
import { itemGuid, itemMediaUrl, parseRssItems, stripHtml, toIsoDate } from '../rss';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * Speaker Deck に REST API は無い。公式 FAQ が案内するのは oEmbed だけで、
 * これは個別デッキ指定のため一覧を取れない。一覧は RSS から取る。
 */
const FEED_URL = 'https://speakerdeck.com/ksyunnnn.rss';
const REFERENCE = 'https://speakerdeck.com/faq';
const OEMBED = 'https://speakerdeck.com/oembed.json';

/**
 * デッキごとの player の URL を oEmbed から取る。
 * player のハッシュはデッキの slug と別物なので、URL からは組み立てられない。
 */
async function playerUrl(deckUrl: string): Promise<string | undefined> {
  const response = await fetchJson<{ html?: string }>(
    `${OEMBED}?url=${encodeURIComponent(deckUrl)}`
  );
  if (!response.ok || !response.body?.html) return undefined;
  return response.body.html.match(/src="([^"]+)"/)?.[1];
}

export const speakerdeckSource: TimelineSource = {
  platform: 'speakerdeck',
  label: 'Speaker Deck',
  fetch: async (): Promise<SourceResult> => {
    const response = await fetchText(FEED_URL);
    if (!response.ok || response.body === undefined) {
      return {
        platform: 'speakerdeck',
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

    const limited = entries.slice(0, PER_SOURCE_LIMIT);
    const players = await Promise.all(limited.map((entry) => playerUrl(entry.url)));
    limited.forEach((entry, index) => {
      entry.embedUrl = players[index];
    });

    return {
      platform: 'speakerdeck',
      status: 'ok',
      entries: limited,
      note: 'REST API が無いため RSS から取得する。1 枚目スライドの画像が media:content に入る。',
      reference: REFERENCE,
    };
  },
};
