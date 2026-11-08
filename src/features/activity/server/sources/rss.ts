/**
 * RSS の `<item>` の要素と属性を読む（specs/004-external-activity/research.md の R4）。Workers に
 * XML の解析器が無いため、取得元の RSS が使う形（要素の文字・CDATA・自分で閉じる要素の属性）
 * だけを読む。使い手は Zenn・Medium・Speaker Deck
 */

const decodeEntities = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

const escapeName = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const unwrapCdata = (value: string) => {
  const match = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(value);
  return match ? match[1] : decodeEntities(value);
};

export type RssItem = {
  /** 要素の中の文字。CDATA を外し、文字参照を戻す。無ければ null */
  text: (name: string) => string | null;
  /** 要素の属性の値。無ければ null */
  attribute: (name: string, attribute: string) => string | null;
};

const toItem = (body: string): RssItem => ({
  text: (name) => {
    const pattern = new RegExp(
      `<${escapeName(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeName(name)}>`,
    );
    const match = pattern.exec(body);
    return match ? unwrapCdata(match[1]).trim() : null;
  },
  attribute: (name, attribute) => {
    const tag = new RegExp(`<${escapeName(name)}\\s[^>]*>`).exec(body)?.[0];
    if (!tag) return null;
    const value = new RegExp(`\\s${escapeName(attribute)}="([^"]*)"`).exec(tag)?.[1];
    return value === undefined ? null : decodeEntities(value);
  },
});

/** RSS の `<item>` を、並んだ順に読む */
export const readRssItems = (xml: string): RssItem[] =>
  [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)].map(([, body]) => toItem(body));

/** HTML の中の最初の `<img>` の `src`。Medium の本文から代表の画像を取る */
export const firstImageSource = (html: string | null): string | null => {
  if (!html) return null;
  const src = /<img\b[^>]*\ssrc="([^"]+)"/.exec(html)?.[1];
  return src === undefined ? null : decodeEntities(src);
};

/** HTML の要素を外し、文字だけにする。連なる空白は 1 つにする */
export const stripTags = (html: string): string =>
  decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
