import type { Element, ElementContent } from 'hast';
import type { ReactNode } from 'react';
import Markdown, { defaultUrlTransform, type Components, type UrlTransform } from 'react-markdown';
import type { MediaStorageKey } from '@/shared/domain/media';
import { MEDIA_URL_PREFIX, mediaKeyOf, urlLineOf } from '@/shared/domain/markdown';

/**
 * 本文の Markdown を描く（U4「本文の書式」の決定、specs/003-note/research.md の R11）。読み方の
 * 決まりは src/shared/domain/markdown.ts が持ち、この部品は同じ関数で見分ける。
 *
 * - HTML の文字列を作って差し込まない。React の要素として描く（docs/SOFTWARE_DESIGN.md の原則 1）
 * - 本文に書いた生の HTML は、要素にせず文字列で出す（react-markdown の既定。`rehype-raw` を足さない）
 * - 画像は `media:<storageKey>` の印だけを出す。ほかの URL の画像は読みに行かず、代替テキストを
 *   文字列で出す。画像だけの段落は `<figure>` にし、印の題の欄をキャプションにする
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
 * スキームとして空の文字列にする（react-markdown 10.1.0 の `defaultUrlTransform`）
 */
const urlTransform: UrlTransform = (url, key, node) =>
  key === 'src' && node.tagName === 'img' && url.startsWith(MEDIA_URL_PREFIX)
    ? url
    : defaultUrlTransform(url);

const isBlank = (child: ElementContent) => child.type === 'text' && child.value.trim() === '';

/** 段落の中身が画像 1 つだけなら、その画像の要素 */
const soleImageOf = (paragraph: Element | undefined): Element | null => {
  const rest = paragraph?.children.filter((child) => !isBlank(child)) ?? [];
  const [child] = rest;
  return rest.length === 1 && child.type === 'element' && child.tagName === 'img' ? child : null;
};

/** 段落の子が文字列 1 つだけなら、その文字列 */
const soleTextOf = (paragraph: Element | undefined): string | null => {
  const [child, ...rest] = paragraph?.children ?? [];
  return rest.length === 0 && child?.type === 'text' ? child.value : null;
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const MarkdownBody = ({ body, mediaSrc, renderUrlLine }: Props) => {
  const srcOf = (src: string | undefined) => {
    const key = src === undefined ? null : mediaKeyOf(src);
    return key === null ? null : mediaSrc(key);
  };

  const components: Components = {
    p: ({ node, children }) => {
      const image = soleImageOf(node);
      const imageSrc = asString(image?.properties.src);
      if (image && imageSrc?.startsWith(MEDIA_URL_PREFIX)) {
        const src = srcOf(imageSrc);
        if (src === null) return null;
        const caption = asString(image.properties.title);
        return (
          <figure>
            {/* 画像は R2 の原本を変換せずに返す（U5 の決定）。next/image の変換を通さない */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={asString(image.properties.alt) ?? ''} />
            {caption && <figcaption>{caption}</figcaption>}
          </figure>
        );
      }
      const text = soleTextOf(node);
      const url = text === null ? null : urlLineOf(text);
      if (url !== null && renderUrlLine) return <>{renderUrlLine(url)}</>;
      return <p>{children}</p>;
    },
    // 文の中に置いた画像。キャプションを持たない
    img: ({ src, alt }) => {
      const source = typeof src === 'string' ? src : undefined;
      if (!source?.startsWith(MEDIA_URL_PREFIX)) return <>{alt}</>;
      const resolved = srcOf(source);
      if (resolved === null) return null;
      // 画像は R2 の原本を変換せずに返す（U5 の決定）。next/image の変換を通さない
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={resolved} alt={alt ?? ''} />;
    },
  };

  return (
    <Markdown urlTransform={urlTransform} components={components}>
      {body}
    </Markdown>
  );
};
