import type { LinkPreview } from '@/features/note/domain/note';
import { NoteBody } from './note-body';

/**
 * note の見た目（specs/003-note/contracts/visitor-note.md）。受け取った値だけを描く。
 * 訪問者のページは公開した版の DTO を、管理画面のプレビューは最新の版を渡す
 * （REQUIREMENTS.md の FR-13 の「公開されたときの見た目」）
 */

type Props = {
  title: string;
  description: string | null;
  body: string;
  /** 初めて公開した日時。一度も公開していない note のプレビューでは null */
  publishedAt: string | null;
  imageUrl: (file: string) => string;
  linkPreviews: Record<string, LinkPreview>;
};

/** 日本時間の暦の日付（YYYY-MM-DD） */
const toTokyoDate = (iso: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date(iso));

export const NoteView = ({
  title,
  description,
  body,
  publishedAt,
  imageUrl,
  linkPreviews,
}: Props) => (
  <article className="flex flex-col gap-8">
    <header className="flex flex-col gap-2">
      {publishedAt && (
        <p className="text-sm text-muted-foreground">
          <time dateTime={publishedAt}>{toTokyoDate(publishedAt)}</time>
        </p>
      )}
      <h1 className="text-3xl font-bold break-words">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
    </header>
    <NoteBody body={body} imageUrl={imageUrl} linkPreviews={linkPreviews} />
  </article>
);
