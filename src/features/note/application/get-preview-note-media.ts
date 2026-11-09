import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';
import type { MediaAccess } from '@/shared/domain/media';

/**
 * 見た目の確認の画面（`/dash/notes/{uid}/preview`）で、note の画像を見せてよいか
 * （docs/REQUIREMENTS.md の FR-13、specs/003-note/research.md の R15）。オーナーにだけ、確認している
 * 版（最も新しい版）の本文が指すその note の画像と代表画像を `restricted`（どのキャッシュにも残さない、
 * NFR-09）で見せる。それ以外は `hidden`。訪問者の経路の確かめ（get-visitor-note-media.ts）は変えない
 */
export const getPreviewNoteMedia = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  storageKey: string,
): Promise<MediaAccess> => {
  if (!author) return 'hidden';
  const preview = await notes.findPreview(id);
  if (!preview) return 'hidden';
  if (preview.media.includes(storageKey)) return 'restricted';
  return preview.cardImage.kind === 'media' && preview.cardImage.storageKey === storageKey
    ? 'restricted'
    : 'hidden';
};
