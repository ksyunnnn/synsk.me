import type { ElementContent } from 'hast';
import type { ReactNode } from 'react';
import Markdown, { defaultUrlTransform, type Components, type UrlTransform } from 'react-markdown';
import type { MediaStorageKey } from '@/shared/domain/media';
import {
  MARKED_IMAGE_PROPERTY,
  MARKED_URL_PROPERTY,
  MEDIA_URL_PREFIX,
  imageSourceOf,
  remarkMarkParagraphs,
} from '@/shared/domain/markdown';

/**
 * 本文の Markdown を描く（U4「本文の書式」の決定、specs/003-note/research.md の R11）。読み方の
 * 決まりは src/shared/domain/markdown.ts が持つ。画像だけの段落と URL だけの段落は、読む側と同じ
 * 関数で構文木の段落を見分け、印を付けた要素（`remarkMarkParagraphs`）をここで描く。
 *
 * - HTML の文字列を作って差し込まない。React の要素として描く（docs/SOFTWARE_DESIGN.md の原則 1）
 * - 本文に書いた生の HTML は、要素にせず文字列で出す（react-markdown の既定。`rehype-raw` を足さない）
 * - 画像は `media:<storageKey>` の印と、http か https の外の URL の画像を出す（ADR-0054）。ほかの
 *   URL の画像は読みに行かず、代替テキストを文字列で出す。題の欄は `title` の属性（ホバーで出す文）に
 *   する。画像だけの段落は `<figure>` にし、画像のすぐ下の行の強調だけの行を `<figcaption>` にする
 * - 外の URL の画像は、取りに行かず、変換もせず、そのまま `src` にする。遅れて読み
 *   （`loading="lazy"`）、参照元のページの URL を画像のサーバへ送らない（`referrerPolicy="no-referrer"`）
 * - URL だけの段落は `renderUrlLine` で描く。渡さなければ文字列の段落で出す
 *
 * Server Component からも Client Component からも使える。関数の引数を受けるため、Server
 * Component から Client Component へは渡せない
 */

type Props = {
  body: string;
  /** 置き場のキーから画像の `src` を作る（例: note は `/notes/{slug}/media/{storageKey}`）。出さない画像は null */
  mediaSrc: (storageKey: MediaStorageKey) => string | null;
  /** URL だけの段落を描く（例: note の URL カード） */
  renderUrlLine?: (url: string) => ReactNode;
};

/**
 * 画像の `src` の `media:` だけをそのまま通し、ほかは既定に任せる。既定は `media:` を許さない
 * スキームとして空の文字列にし、http と https の URL はそのまま通す（react-markdown 10.1.0 の
 * `defaultUrlTransform`）。既定が通す相対の URL は、下の `img` が画像にしない
 */
const urlTransform: UrlTransform = (url, key, node) =>
  key === 'src' && node.tagName === 'img' && url.startsWith(MEDIA_URL_PREFIX)
    ? url
    : defaultUrlTransform(url);

const remarkPlugins = [remarkMarkParagraphs];

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const isBlank = (child: ElementContent) => child.type === 'text' && child.value.trim() === '';

/** 画像だけの段落の印が付いた要素なら、その画像の URL の欄 */
const markedImageUrlOf = (node: ElementContent | undefined): string | null =>
  node?.type === 'element' ? (asString(node.properties[MARKED_IMAGE_PROPERTY]) ?? null) : null;

export const MarkdownBody = ({ body, mediaSrc, renderUrlLine }: Props) => {
  /** 出さない置き場の画像か。外の URL の画像はいつも出す */
  const isHidden = (url: string) => {
    const source = imageSourceOf(url);
    return source?.kind === 'media' && mediaSrc(source.key) === null;
  };

  const components: Components = {
    // 印を付けた段落。生の HTML は文字列で出るため、ほかに div の要素は出ない
    div: ({ node, children }) => {
      const imageUrl = markedImageUrlOf(node);
      if (imageUrl !== null) {
        if (isHidden(imageUrl)) return null;
        // 中身は画像（下の img が描く）と、あればキャプションの figcaption だけ（remarkMarkParagraphs）
        return <figure>{children}</figure>;
      }
      const url = asString(node?.properties[MARKED_URL_PROPERTY]);
      if (url !== undefined && renderUrlLine) return renderUrlLine(url);
      return <p>{children}</p>;
    },
    // 出さない画像だけの項目は、中身の無い項目を残さず、項目ごと描かない
    li: ({ node, children }) => {
      const content = node?.children.filter((child) => !isBlank(child)) ?? [];
      const imageUrl = content.length === 1 ? markedImageUrlOf(content[0]) : null;
      if (imageUrl !== null && isHidden(imageUrl)) return null;
      return <li>{children}</li>;
    },
    // 画像。文の中に置いた画像はキャプションを持たない
    img: ({ src, alt, title }) => {
      const source = imageSourceOf(asString(src) ?? '');
      if (source === null) return <>{alt}</>;
      if (source.kind === 'external')
        return (
          // 外の URL の画像は、取りに行かずにそのまま出す（ADR-0054）。next/image の変換を通さない
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.url}
            alt={alt ?? ''}
            title={title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        );
      const resolved = mediaSrc(source.key);
      if (resolved === null) return null;
      // 画像は R2 の原本を変換せずに返す（U5 の決定）。next/image の変換を通さない
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={resolved} alt={alt ?? ''} title={title} />;
    },
  };

  return (
    <Markdown remarkPlugins={remarkPlugins} urlTransform={urlTransform} components={components}>
      {body}
    </Markdown>
  );
};
