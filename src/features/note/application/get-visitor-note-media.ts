import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { MediaAccess } from '@/shared/domain/media';

/**
 * note の画像を訪問者に見せてよいか（FR-026、research.md の R12）。公開で削除していない note の、
 * 公開した版の本文が指すその note の画像と、代表画像だけを `public` にする。それ以外は `hidden`。
 * 下書き・削除した note の画像と、公開した後に保存した版にだけ置いた画像は見せない
 */
export const getVisitorNoteMedia = async (
  notes: NoteRepository,
  slug: string,
  storageKey: string,
): Promise<MediaAccess> => {
  const note = await notes.findVisitorBySlug(slug);
  if (!note) return 'hidden';
  if (note.media.includes(storageKey)) return 'public';
  return note.cardImage.kind === 'media' && note.cardImage.storageKey === storageKey
    ? 'public'
    : 'hidden';
};
