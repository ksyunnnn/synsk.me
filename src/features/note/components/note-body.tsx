import Markdown, { defaultUrlTransform, type Components } from 'react-markdown';
import { toCardUrl } from '@/features/note/domain/link-card';
import type { LinkPreview } from '@/features/note/domain/note';
import { MEDIA_SCHEME } from '@/features/note/domain/note-image';

/**
 * note の本文（Markdown）を描く（specs/003-note/research.md の R6）。生の HTML は描かない
 * （`react-markdown` の既定）。リンクと画像の URL は既定の `urlTransform` を通し、`javascript:`
 * などを落とす。
 *
 * - 本文の画像 `![説明](media:{file})` は、`imageUrl` が返す URL に置き換える。訪問者のページと
 *   管理画面のプレビューで、配る経路が違うため
 * - URL 1 つだけの段落は、参照先の情報があればカードにし、無ければ URL の文字のリンクにする
 *   （research.md の R9）
 *
 * 使い手は訪問者のページと、管理画面のプレビュー・版の中身
 */

type Props = {
  body: string;
  imageUrl: (file: string) => string;
  linkPreviews: Record<string, LinkPreview>;
};

const LINK =
  'underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const LinkCard = ({ preview }: { preview: LinkPreview }) => {
  const host = new URL(preview.url).host;
  return (
    <a
      href={preview.url}
      rel="noopener noreferrer"
      className="not-prose flex overflow-hidden rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="font-bold break-words">{preview.title ?? preview.url}</span>
        <span className="text-sm text-muted-foreground">{host}</span>
      </span>
      {preview.imageUrl && (
        // 参照先の画像は保管せず、URL をそのまま指す（FR-030、#186 が出し方を決める）
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-auto w-32 shrink-0 object-cover sm:w-48"
        />
      )}
    </a>
  );
};

/** 段落の要素の中身の文字。URL だけの段落かを見るのに使う */
const textOf = (node: unknown): string => {
  const element = node as { type?: string; value?: string; children?: unknown[] };
  if (element.type === 'text') return element.value ?? '';
  return (element.children ?? []).map(textOf).join('');
};

export const NoteBody = ({ body, imageUrl, linkPreviews }: Props) => {
  const components: Components = {
    p: ({ node, children }) => {
      const only = node?.children.length === 1 ? node.children[0] : undefined;
      const isUrlOnly =
        only !== undefined &&
        (only.type === 'text' || (only.type === 'element' && only.tagName === 'a'));
      const url = isUrlOnly ? toCardUrl(textOf(only)) : null;
      const preview = url ? linkPreviews[url] : undefined;
      if (preview) return <LinkCard preview={preview} />;
      if (url) {
        return (
          <p>
            <a href={url} rel="noopener noreferrer" className={`${LINK} break-all`}>
              {url}
            </a>
          </p>
        );
      }
      return <p>{children}</p>;
    },
    a: ({ href, children }) => (
      <a href={href} rel="noopener noreferrer" className={LINK}>
        {children}
      </a>
    ),
    img: ({ src, alt }) => (
      // 本文の画像の大きさは決まっていないため、next/image の最適化を通さない
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={typeof src === 'string' ? src : undefined}
        alt={alt ?? ''}
        loading="lazy"
        className="h-auto max-w-full"
      />
    ),
  };

  return (
    <div className="flex flex-col gap-4 leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_code]:font-mono [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4">
      <Markdown
        components={components}
        urlTransform={(url) =>
          url.startsWith(MEDIA_SCHEME)
            ? imageUrl(encodeURIComponent(url.slice(MEDIA_SCHEME.length)))
            : defaultUrlTransform(url)
        }
      >
        {body}
      </Markdown>
    </div>
  );
};
