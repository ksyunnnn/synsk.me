import type { Nodes, Paragraph, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';
import { parseMediaStorageKey, type MediaStorageKey } from '@/shared/domain/media';
import { isWebUrl } from '@/shared/domain/web-url';

/**
 * 本文の Markdown の決まりと読み方（U4「本文の書式」の決定、specs/003-note/research.md の R11）。
 * 書式は CommonMark だけで、生の HTML を通さない。使い手は 001 の職歴・実績の本文と 003 の note の
 * 本文。描く部品は src/shared/components/markdown-body.tsx。
 *
 * 本文は構文木にしてから読む。正規表現で読むと、コードの中に書いた印まで拾う
 */

/** 画像の印の URL の欄の始まり。`![代替テキスト](media:<storageKey> "キャプション")` */
export const MEDIA_URL_PREFIX = 'media:';

/** 画像の印の URL から置き場のキーを読む。印でないか、キーの形が違えば null */
export const mediaKeyOf = (url: string): MediaStorageKey | null =>
  url.startsWith(MEDIA_URL_PREFIX)
    ? parseMediaStorageKey(url.slice(MEDIA_URL_PREFIX.length))
    : null;

/**
 * 段落の中身の文字列が、http か https の URL 1 つだけなら、その URL。URL カードにする行
 * （R11）。空白や改行を含めば、文と並べた URL として null
 */
export const urlLineOf = (text: string): string | null =>
  !/\s/.test(text) && isWebUrl(text) ? text : null;

/** 段落の子が文字列 1 つだけなら、その文字列 */
const soleTextOf = (paragraph: Paragraph): string | null => {
  const [child, ...rest] = paragraph.children;
  return rest.length === 0 && child?.type === 'text' ? child.value : null;
};

const walk = (node: Nodes, visit: (node: Nodes) => void) => {
  visit(node);
  if ('children' in node) for (const child of node.children) walk(child, visit);
};

export type MarkdownSummary = {
  /** 画像の印が指す置き場のキー。現れた順で、重ねない。参照の記法（`![a][b]`）で書いた印を含む */
  mediaKeys: MediaStorageKey[];
  /** URL だけの段落の URL。現れた順で、重ねない */
  urlLines: string[];
  /**
   * 文書の順で最初の、文字列を持つ段落の文字列。リストと引用の中の段落を含む。改行は空白にし、
   * 画像の代替テキストは含めない。無ければ null。説明文が空のときの説明に使う（R11）
   */
  firstParagraph: string | null;
};

/** 本文を構文木にして、画像の印・URL だけの段落・最初の段落を読む */
export const readMarkdown = (body: string): MarkdownSummary => {
  const tree: Root = fromMarkdown(body);

  /** 参照の記法の定義。識別子は構文木が正規化した値 */
  const definitions = new Map<string, string>();
  walk(tree, (node) => {
    if (node.type === 'definition' && !definitions.has(node.identifier))
      definitions.set(node.identifier, node.url);
  });

  const mediaKeys = new Set<MediaStorageKey>();
  const urlLines = new Set<string>();
  let firstParagraph: string | null = null;
  walk(tree, (node) => {
    const url =
      node.type === 'image'
        ? node.url
        : node.type === 'imageReference'
          ? definitions.get(node.identifier)
          : undefined;
    const key = url === undefined ? null : mediaKeyOf(url);
    if (key !== null) mediaKeys.add(key);

    if (node.type !== 'paragraph') return;
    const text = soleTextOf(node);
    const urlLine = text === null ? null : urlLineOf(text);
    if (urlLine !== null) urlLines.add(urlLine);
    if (firstParagraph === null) {
      const content = toString(node, { includeImageAlt: false }).replace(/\s+/g, ' ').trim();
      if (content !== '') firstParagraph = content;
    }
  });

  return { mediaKeys: [...mediaKeys], urlLines: [...urlLines], firstParagraph };
};
