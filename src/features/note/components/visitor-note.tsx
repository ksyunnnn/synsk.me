import type { NotePreview, VisitorNote } from '@/features/note/domain/note';
import { MarkdownBody } from '@/shared/components/markdown-body';

/**
 * 訪問者に見せる note（specs/003-note/contracts/visitor-note.md）。受け取った DTO の値だけを
 * 描画する。本文は共有担当の Markdown の部品で描き、生の HTML を要素にしない（research.md の R11）。
 *
 * 画像の `src` は、DTO の `media`（その note の画像で、公開した版の本文が指すもの）にある置き場の
 * キーだけから作る。ほかのキーの画像は出さない。URL だけの段落は、URL カードの出し方が決まるまで
 * 文字列の段落で出す（plan.md の U9）
 */

/** 初めて公開した日を、日本の暦の日付で出す */
const formatPublishedOn = (publishedAt: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(publishedAt));

/**
 * 見た目の確認（`/dash/notes/{uid}/preview`）も同じ部品で描く（research.md の R15）。一度も公開して
 * いない note は初めて公開した日時を持たない。見た目の確認は `mediaBase` にオーナーだけが通る画像の
 * 経路を渡す。訪問者の経路は公開した版の画像だけを返すため（spec の FR-026）
 */
export const VisitorNoteView = ({
  note,
  mediaBase = `/notes/${encodeURIComponent(note.slug)}/media`,
}: {
  note: VisitorNote | NotePreview;
  /** 画像の `src` の前に付ける経路。置き場のキーを `/` でつなぐ */
  mediaBase?: string;
}) => {
  const visibleMedia = new Set(note.media);
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{note.title}</h1>
        {note.description && <p className="text-muted-foreground">{note.description}</p>}
        <p className="text-sm text-muted-foreground">
          {note.publishedAt === null ? (
            '公開していません'
          ) : (
            <time dateTime={note.publishedAt}>{formatPublishedOn(note.publishedAt)}</time>
          )}
        </p>
      </header>
      <div className="flex flex-col gap-4">
        <MarkdownBody
          body={note.body}
          mediaSrc={(storageKey) =>
            visibleMedia.has(storageKey) ? `${mediaBase}/${storageKey}` : null
          }
        />
      </div>
    </article>
  );
};
