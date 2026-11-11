import type { VisitorLinkPreview } from '@/features/note/domain/note';

/**
 * URL だけの段落を描く（specs/003-note の FR-027・FR-030、research.md の R13）。参照先の題を持てば、
 * 題・ホスト名・画像を添えたカードのリンクで出す。参照先の情報が無いか題が無ければ、URL の文字列の
 * リンクで出す（原則 4: 取れなかった URL も本文は成り立つ）。
 *
 * 画像は参照先の URL のまま出し、保管しない（FR-030）。参照元のページの URL を参照先の画像の
 * サーバへ送らない（`referrerpolicy="no-referrer"`）
 */
export const LinkCard = ({ url, preview }: { url: string; preview?: VisitorLinkPreview }) => {
  if (!preview?.title) {
    return (
      <p>
        <a href={url}>{url}</a>
      </p>
    );
  }
  return (
    <a
      href={url}
      className="flex items-stretch overflow-hidden rounded-md border border-input no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
        <span className="font-bold">{preview.title}</span>
        <span className="truncate text-sm text-muted-foreground">{new URL(url).hostname}</span>
      </span>
      {preview.imageUrl && (
        // 参照先の画像は変換せずにそのまま出す。next/image の変換を通さない
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-32 shrink-0 object-cover"
        />
      )}
    </a>
  );
};
