import type { NoteRevisionSummary, NoteStatus } from '@/features/note/domain/note';
import { TextLink } from '@/shared/components/text-link';

/**
 * note の版の一覧（FR-008、specs/003-note/contracts/dash.md）。保存した日時の新しい順に並べ、
 * 最も新しい版と公開した版に印を付ける。公開した版の印は、note が公開のときだけ付ける。下書きに
 * 戻した note も公開した版を残す（FR-014）が、印があると、下書きの note の版を訪問者に見せていると読めるため。
 * 各版は過去の版の画面へのリンク
 */

/** 保存した日時を、日本の時刻で出す。版の一覧と過去の版の画面で同じ形にする */
export const formatSavedAt = (createdAt: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(createdAt));

export const NoteRevisionList = ({
  noteUid,
  noteStatus,
  revisions,
}: {
  noteUid: string;
  noteStatus: NoteStatus;
  revisions: NoteRevisionSummary[];
}) => (
  <ol className="flex flex-col gap-3">
    {revisions.map((revision) => (
      <li key={revision.uid} className="flex flex-col">
        <TextLink href={`/dash/notes/${noteUid}/revisions/${revision.uid}`}>
          <time dateTime={revision.createdAt}>{formatSavedAt(revision.createdAt)}</time>
        </TextLink>
        <span className="text-sm text-muted-foreground">
          {revision.title || '（題なし）'}
          {revision.isLatest && '・最も新しい版'}
          {noteStatus === 'published' && revision.isPublished && '・公開した版'}
        </span>
      </li>
    ))}
  </ol>
);
