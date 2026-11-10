import type { Emphasis, Nodes, Paragraph, PhrasingContent, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';
import { parseMediaStorageKey, type MediaStorageKey } from '@/shared/domain/media';
import { isWebUrl } from '@/shared/domain/web-url';

/**
 * 本文の Markdown の決まりと読み方（U4「本文の書式」の決定、specs/003-note/research.md の R11）。
 * 書式は CommonMark だけで、生の HTML を通さない。使い手は 001 の職歴・実績の本文と 003 の note の
 * 本文。描く部品は src/shared/components/markdown-body.tsx。
 *
 * 本文は構文木にしてから読む。正規表現で読むと、コードの中に書いた印まで拾う。画像だけの段落と
 * URL だけの段落の見分けは `paragraphKindOf` の 1 か所が持ち、読む側（`readMarkdown`）と描く側
 * （`remarkMarkParagraphs`）が同じ構文木の段落で使う
 *
 * 画像の印は `![代替テキスト](media:<storageKey> "ホバーで出す文")` と書く。題の欄（`"…"`）は
 * ホバーで出す文（`title` の属性）にする。キャプションは Zenn の書き方に揃え、画像の行のすぐ下に
 * 空行を挟まずに強調だけの行（`*キャプション*`）を書く。題の欄とキャプションは、どちらか片方でも
 * 両方でも書ける
 */

/** 画像の印の URL の欄の始まり */
export const MEDIA_URL_PREFIX = 'media:';

/**
 * 本文に貼る画像の印（specs/003-note/research.md の R11）。1 行目の題の欄はホバーで出す文、2 行目は
 * キャプション。オーナーが書き換え、要らなければ題の欄も 2 行目も消せる。使い手は note・実績・職歴の
 * 画像の一覧
 */
export const mediaMarkOf = (storageKey: MediaStorageKey) =>
  `![代替テキスト](${MEDIA_URL_PREFIX}${storageKey} "ホバーで出す文")\n*キャプション*`;

/** 画像の印の URL から置き場のキーを読む。印でないか、キーの形が違えば null */
export const mediaKeyOf = (url: string): MediaStorageKey | null =>
  url.startsWith(MEDIA_URL_PREFIX)
    ? parseMediaStorageKey(url.slice(MEDIA_URL_PREFIX.length))
    : null;

/**
 * 段落の中身の文字列が、http か https の URL 1 つだけなら、その URL を `URL` の形に揃えた値。
 * URL カードにする行（R11）。空白や改行を含めば、文と並べた URL として null
 */
export const urlLineOf = (text: string): string | null =>
  !/\s/.test(text) && isWebUrl(text) ? new URL(text).href : null;

const walk = (node: Nodes, visit: (node: Nodes) => void) => {
  visit(node);
  if ('children' in node) for (const child of node.children) walk(child, visit);
};

/** 参照の記法の定義。識別子は構文木が正規化した値。同じ識別子は最初の定義を使う（CommonMark） */
const definitionsOf = (tree: Root): Map<string, string> => {
  const definitions = new Map<string, string>();
  walk(tree, (node) => {
    if (node.type === 'definition' && !definitions.has(node.identifier))
      definitions.set(node.identifier, node.url);
  });
  return definitions;
};

/** 画像の URL。参照の記法は定義を引く。画像でなければ undefined */
const imageUrlOf = (node: Nodes, definitions: Map<string, string>): string | undefined =>
  node.type === 'image'
    ? node.url
    : node.type === 'imageReference'
      ? definitions.get(node.identifier)
      : undefined;

const isBlank = (child: PhrasingContent) => child.type === 'text' && child.value.trim() === '';

/** 前と後ろの空白だけの文字列を除いた段落の中身 */
const trimBlank = (children: PhrasingContent[]): PhrasingContent[] => {
  let start = 0;
  let end = children.length;
  while (start < end && isBlank(children[start])) start++;
  while (end > start && isBlank(children[end - 1])) end--;
  return children.slice(start, end);
};

/** 行を分ける要素。空白だけで改行を含む文字列（ふつうの改行）か、強制改行 */
const isLineBreak = (child: PhrasingContent) =>
  child.type === 'break' || (isBlank(child) && child.type === 'text' && child.value.includes('\n'));

/**
 * 中身が画像の印 1 つだけの段落か、画像の印の次の行が強調だけの段落（`<figure>` にする。強調を
 * キャプションにする）か、URL だけの段落（URL カードにする）
 */
export type ParagraphKind =
  | { kind: 'media'; key: MediaStorageKey; image: PhrasingContent; caption: Emphasis | null }
  | { kind: 'url'; url: string };

/** 段落を見分ける。どちらでもなければ null。リストと引用の中の段落も同じに見分ける（R11） */
export const paragraphKindOf = (
  paragraph: Paragraph,
  definitions: Map<string, string>,
): ParagraphKind | null => {
  const content = trimBlank(paragraph.children);
  const [child, lineBreak, caption] = content;
  const imageUrl = child === undefined ? undefined : imageUrlOf(child, definitions);
  const key = imageUrl === undefined ? null : mediaKeyOf(imageUrl);
  if (key !== null && content.length === 1)
    return { kind: 'media', key, image: child, caption: null };
  // キャプションは画像の行のすぐ下の行。空行を挟めば別の段落になり、キャプションにしない
  if (key !== null && content.length === 3 && isLineBreak(lineBreak) && caption.type === 'emphasis')
    return { kind: 'media', key, image: child, caption };
  if (content.length !== 1) return null;
  // autolink（`<https://…>`）は link の子になるため、ここで文字列 1 つにならない（R11）
  const url =
    paragraph.children.length === 1 && child.type === 'text' ? urlLineOf(child.value) : null;
  return url === null ? null : { kind: 'url', url };
};

/** 描く側が見分けた段落に付ける要素の名前と属性。生の HTML は文字列で出るため、この要素は作れない */
export const MARKED_PARAGRAPH_TAG = 'div';
export const MARKED_MEDIA_PROPERTY = 'dataMarkdownMedia';
export const MARKED_URL_PROPERTY = 'dataMarkdownUrl';

/** 描く側がキャプションの強調に付ける要素の名前 */
const CAPTION_TAG = 'figcaption';

/**
 * react-markdown に渡す remark の plugin。見分けた段落を `<p>` でなく印の付いた要素にする。
 * 画像だけの段落の中身は、画像とキャプションだけにし、キャプションの強調を `<figcaption>` にする。
 * remark-rehype は詰めたリスト（項目の間に空行の無いリスト）の `<p>` を外すため、描く側で
 * `<p>` を見分けると、リストの中の段落を読む側と違えて見分ける
 */
export const remarkMarkParagraphs = () => (tree: Root) => {
  const definitions = definitionsOf(tree);
  walk(tree, (node) => {
    if (node.type !== 'paragraph') return;
    const kind = paragraphKindOf(node, definitions);
    if (kind === null) return;
    if (kind.kind === 'media') {
      if (kind.caption !== null) kind.caption.data = { ...kind.caption.data, hName: CAPTION_TAG };
      node.children = kind.caption === null ? [kind.image] : [kind.image, kind.caption];
    }
    node.data = {
      ...node.data,
      hName: MARKED_PARAGRAPH_TAG,
      hProperties:
        kind.kind === 'media'
          ? { [MARKED_MEDIA_PROPERTY]: kind.key }
          : { [MARKED_URL_PROPERTY]: kind.url },
    };
  });
};

export type MarkdownSummary = {
  /** 画像の印が指す置き場のキー。現れた順で、重ねない。参照の記法（`![a][b]`）で書いた印を含む */
  mediaKeys: MediaStorageKey[];
  /** URL だけの段落の URL。現れた順で、重ねない */
  urlLines: string[];
  /**
   * 文書の順で最初の、文字列を持つ段落の文字列。リストと引用の中の段落を含む。改行は空白にし、
   * 画像の代替テキストは含めない。画像だけの段落（キャプションを含む）は除く。無ければ null。
   * 説明文が空のときの説明に使う（R11）
   */
  firstParagraph: string | null;
};

/** 本文を構文木にして、画像の印・URL だけの段落・最初の段落を読む */
export const readMarkdown = (body: string): MarkdownSummary => {
  const tree: Root = fromMarkdown(body);
  const definitions = definitionsOf(tree);

  const mediaKeys = new Set<MediaStorageKey>();
  const urlLines = new Set<string>();
  let firstParagraph: string | null = null;
  walk(tree, (node) => {
    const imageUrl = imageUrlOf(node, definitions);
    const key = imageUrl === undefined ? null : mediaKeyOf(imageUrl);
    if (key !== null) mediaKeys.add(key);

    if (node.type !== 'paragraph') return;
    const kind = paragraphKindOf(node, definitions);
    if (kind?.kind === 'url') urlLines.add(kind.url);
    if (firstParagraph === null && kind?.kind !== 'media') {
      const content = toString(node, { includeImageAlt: false }).replace(/\s+/g, ' ').trim();
      if (content !== '') firstParagraph = content;
    }
  });

  return { mediaKeys: [...mediaKeys], urlLines: [...urlLines], firstParagraph };
};
