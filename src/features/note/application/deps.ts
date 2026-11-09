import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { MediaStorage } from '@/shared/domain/media';

/** note のユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type NoteDeps = {
  notes: NoteRepository;
  /** 画像の置き場。共有担当の src/shared/server/media-storage.ts の R2 の実装 */
  media: MediaStorage;
};
