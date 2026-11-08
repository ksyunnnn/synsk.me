import { toCardUrl } from '@/features/note/domain/link-card';
import type { LinkPreview } from '@/features/note/domain/note';
import { LINK_CLASS, MarkdownBody } from '@/shared/components/markdown-body';

/**
 * note の本文を描く（specs/003-note/research.md の R6）。描き方は `MarkdownBody` が持ち、ここは
 * URL 1 つだけの段落を、参照先の情報があればカードにし、無ければ URL の文字のリンクにする
 * （research.md の R9）。
 *
 * 使い手は訪問者のページと、管理画面のプレビュー・版の中身
 */

type Props = {
  body: string;
  imageUrl: (file: string) => string;
  linkPreviews: Record<string, LinkPreview>;
};

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

export const NoteBody = ({ body, imageUrl, linkPreviews }: Props) => (
  <MarkdownBody
    body={body}
    imageUrl={imageUrl}
    renderTextParagraph={(text) => {
      const url = toCardUrl(text);
      if (!url) return null;
      const preview = linkPreviews[url];
      if (preview) return <LinkCard preview={preview} />;
      return (
        <p>
          <a href={url} rel="noopener noreferrer" className={`${LINK_CLASS} break-all`}>
            {url}
          </a>
        </p>
      );
    }}
  />
);
