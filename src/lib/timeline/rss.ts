import { XMLParser } from 'fast-xml-parser';

/**
 * Cloudflare Workers の runtime には DOMParser が無いため、純 JS のパーサを使う。
 * 出典: https://developers.cloudflare.com/workers/runtime-apis/web-standards/
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // <category> が 1 件のときも配列で受け取り、呼び出し側の分岐を減らす。
  isArray: (name) => name === 'item' || name === 'category',
});

export interface RssItem {
  title?: string;
  link?: string;
  guid?: string | { '#text'?: string };
  pubDate?: string;
  description?: string;
  category?: string[];
  'content:encoded'?: string;
  enclosure?: { '@_url'?: string };
  'media:content'?: { '@_url'?: string } | { '@_url'?: string }[];
}

export function parseRssItems(xml: string): RssItem[] {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: RssItem[] } };
  };
  return parsed.rss?.channel?.item ?? [];
}

export function itemGuid(item: RssItem): string | undefined {
  if (typeof item.guid === 'string') return item.guid;
  return item.guid?.['#text'];
}

export function itemMediaUrl(item: RssItem): string | undefined {
  const media = item['media:content'];
  if (Array.isArray(media)) return media[0]?.['@_url'];
  if (media) return media['@_url'];
  return item.enclosure?.['@_url'];
}

/** RFC822 などの日付文字列を ISO 8601 へ揃える。解釈できない場合は undefined。 */
export function toIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString();
}

/** HTML タグを落として要約に使う。RSS の description は HTML を含みうる。 */
export function stripHtml(value: string | undefined, limit = 160): string | undefined {
  if (!value) return undefined;
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length === 0) return undefined;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/** content:encoded の先頭 <img> を拾う。Medium は専用のサムネイルフィールドを持たない。 */
export function firstImageUrl(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}
