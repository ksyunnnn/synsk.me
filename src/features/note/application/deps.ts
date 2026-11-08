import type { LinkPreview } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { ImageStorage } from '@/shared/domain/media-image';

/** note のユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type NoteDeps = {
  notes: NoteRepository;
  images: ImageStorage;
  /** 参照先の情報を取る。取れなかった URL は返さない（specs/003-note/research.md の R9） */
  fetchLinkPreviews: (urls: string[]) => Promise<LinkPreview[]>;
  /** 時刻。`Date.prototype.toISOString()` の形 */
  now: () => string;
};

/** 状態を変える操作の結果。成功したときは Server Action が別の画面へ移す */
export type NoteOperationOutcome<R extends string = never> =
  { status: 'done' } | { status: 'forbidden' } | { status: 'not-found' } | { status: R };
