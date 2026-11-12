import type { LinkPreviewFetchFailure, VisitorLinkPreview } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { MediaStorage } from '@/shared/domain/media';

/**
 * 参照先の題と画像の URL を取る。取れた URL だけを返し、取れなかった URL は返さない。取る数・
 * 時間・大きさの上限は実装が持つ（plan.md の「参照先への取得の上限」）
 */
export type LinkPreviewSource = (urls: string[]) => Promise<VisitorLinkPreview[]>;

/**
 * 1 つの URL の題と画像の URL を取る。投げずに、取れたか取れなかった理由を返す。上限と内部の
 * アドレスの検査は実装が持つ（plan.md の「参照先への取得の上限」）
 */
type SingleLinkPreviewSource = (
  url: string,
) => Promise<
  | ({ status: 'fetched' } & VisitorLinkPreview)
  | { status: 'failed'; reason: LinkPreviewFetchFailure }
>;

/** note のユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type NoteDeps = {
  notes: NoteRepository;
  /** 画像の置き場。共有担当の src/shared/server/media-storage.ts の R2 の実装 */
  media: MediaStorage;
  /** 本番の実装は src/features/note/server/link-preview-fetch.ts を包む */
  fetchLinkPreviews: LinkPreviewSource;
  /** 本番の実装は src/features/note/server/link-preview-fetch.ts の `fetchLinkPreview` */
  fetchLinkPreview: SingleLinkPreviewSource;
};
