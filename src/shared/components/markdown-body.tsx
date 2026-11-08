import type { ReactNode } from 'react';
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown';
import { MEDIA_SCHEME } from '@/shared/domain/media-image';

/**
 * 本文（Markdown）を描く（specs/003-note/research.md の R6、specs/001-career-and-project/plan.md の
 * U4）。生の HTML は描かない（`react-markdown` の既定）。リンクと画像の URL は既定の
 * `urlTransform` を通し、`javascript:` などを落とす。
 *
 * - 本文の画像 `![説明](media:{file} "キャプション")` は、`imageUrl` が返す URL に置き換える。
 *   配る経路が画面ごとに違うため。`imageUrl` を渡さなければ、本文の画像を描かない
 * - 画像だけの段落は `<figure>` にし、画像の題をキャプション（`<figcaption>`）にする
 * - 文字か 1 つのリンクだけの段落は、`renderTextParagraph` が返すもので描く。null なら段落のまま
 *
 * 使い手は note・実績・職務経歴書の本文
 */

type Props = {
  body: string;
  imageUrl?: (file: string) => string;
  /** 文字か 1 つのリンクだけの段落の、中身の文字を受け取る */
  renderTextParagraph?: (text: string) => ReactNode | null;
};

export const LINK_CLASS =
  'underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** 段落の要素の中身の文字 */
const textOf = (node: unknown): string => {
  const element = node as { type?: string; value?: string; children?: unknown[] };
  if (element.type === 'text') return element.value ?? '';
  return (element.children ?? []).map(textOf).join('');
};

type ImageNode = { type: 'element'; tagName: 'img'; properties: Record<string, unknown> };

const isImage = (node: unknown): node is ImageNode => {
  const element = node as { type?: string; tagName?: string } | undefined;
  return element?.type === 'element' && element.tagName === 'img';
};

const Image = ({ src, alt, title }: { src?: unknown; alt?: unknown; title?: unknown }) =>
  typeof src === 'string' && src !== '' ? (
    // 本文の画像の大きさは決まっていないため、next/image の最適化を通さない
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={typeof alt === 'string' ? alt : ''}
      title={typeof title === 'string' ? title : undefined}
      loading="lazy"
      className="h-auto max-w-full"
    />
  ) : null;

export const MarkdownBody = ({ body, imageUrl, renderTextParagraph }: Props) => {
  const components: Components = {
    p: ({ node, children }) => {
      const nodes = (node?.children ?? []).filter(
        (child) => !(child.type === 'text' && child.value.trim() === ''),
      );
      const only = nodes.length === 1 ? nodes[0] : undefined;
      if (isImage(only)) {
        // `urlTransform` は描く前に木の URL を置き換える。描かない画像の URL は空になる
        const { src, alt, title } = only.properties;
        if (typeof src !== 'string' || src === '') return null;
        return (
          <figure className="flex flex-col gap-2">
            <Image src={src} alt={alt} />
            {typeof title === 'string' && title !== '' && (
              <figcaption className="text-sm text-muted-foreground">{title}</figcaption>
            )}
          </figure>
        );
      }
      const isText =
        only !== undefined &&
        (only.type === 'text' || (only.type === 'element' && only.tagName === 'a'));
      const custom = isText && renderTextParagraph ? renderTextParagraph(textOf(only)) : null;
      return custom ?? <p>{children}</p>;
    },
    a: ({ href, children }) => (
      <a href={href} rel="noopener noreferrer" className={LINK_CLASS}>
        {children}
      </a>
    ),
    img: ({ src, alt, title }) => <Image src={src} alt={alt} title={title} />,
  };

  return (
    <div className="flex flex-col gap-4 leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_code]:font-mono [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4">
      <Markdown
        components={components}
        urlTransform={(url) => {
          if (!url.startsWith(MEDIA_SCHEME)) return defaultUrlTransform(url);
          return imageUrl ? imageUrl(encodeURIComponent(url.slice(MEDIA_SCHEME.length))) : '';
        }}
      >
        {body}
      </Markdown>
    </div>
  );
};
