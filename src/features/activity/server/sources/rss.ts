import 'server-only';

/**
 * RSS 2.0 の項目を読む（specs/004-external-activity/research.md の R3）。workerd に `DOMParser` が
 * 無いため、Zenn・Medium・Speaker Deck の 3 つの取得元が使う最小の読み手を持つ。
 * 項目（`<item>`）の子の要素ごとに、文字（CDATA と実体参照を解いたもの）と、属性を
 * `<要素名>@<属性名>` の名前で返す。同じ名前の子が 2 つ以上あれば最初の値を使う
 */

export type RssItem = Record<string, string>;

export const readRssItems = (xml: string): RssItem[] => {
  if (!/<rss\b[^>]*>[\s\S]*?<channel\b/.test(xml)) {
    throw new Error('応答が RSS の形でない');
  }
  return Array.from(xml.matchAll(ITEM), (match) => readChildren(match[1] ?? ''));
};

const ITEM = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
/**
 * 子の要素 1 つ。空の要素（`<x/>`）か、同じ名前の閉じタグまで。CDATA の中は次の要素として読まない。
 * 中身の 3 つの選び方は先頭の文字で重ならないので、読み直しが膨らまない
 */
const CHILD =
  /<([A-Za-z_][\w.:-]*)\b([^>]*?)(?:\/>|>((?:<!\[CDATA\[[\s\S]*?\]\]>|[^<]|<(?!\/\1>|!\[CDATA\[))*)<\/\1>)/g;
const ATTRIBUTE = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const CDATA = /<!\[CDATA\[([\s\S]*?)\]\]>/g;

const readChildren = (body: string): RssItem => {
  const item: RssItem = {};
  for (const [, name = '', attributes = '', content] of body.matchAll(CHILD)) {
    if (content !== undefined && !(name in item)) item[name] = readText(content);
    for (const [, attribute, doubleQuoted, singleQuoted] of attributes.matchAll(ATTRIBUTE)) {
      const key = `${name}@${attribute}`;
      if (!(key in item)) item[key] = decodeEntities(doubleQuoted ?? singleQuoted ?? '');
    }
  }
  return item;
};

/** CDATA の中はそのまま、外は実体参照を解く */
const readText = (raw: string): string => {
  let text = '';
  let last = 0;
  for (const match of raw.matchAll(CDATA)) {
    text += decodeEntities(raw.slice(last, match.index));
    text += match[1];
    last = match.index + match[0].length;
  }
  return (text + decodeEntities(raw.slice(last))).trim();
};

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (whole, entity: string) => {
    if (entity.startsWith('#x')) return codePoint(Number.parseInt(entity.slice(2), 16), whole);
    if (entity.startsWith('#')) return codePoint(Number.parseInt(entity.slice(1), 10), whole);
    return NAMED[entity] ?? whole;
  });

const codePoint = (value: number, fallback: string): string =>
  Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : fallback;
