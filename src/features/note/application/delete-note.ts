import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';

export type DeleteNoteOutcome =
  { status: 'deleted' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * note に削除済みの印を付ける（FR-016）。データは残し、元に戻せる。オーナーでなければ何も
 * 書かない（FR-033）
 */
export const deleteNote = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  now: string,
): Promise<DeleteNoteOutcome> => {
  if (!author) return { status: 'forbidden' };
  return (await notes.delete(id, now)).ok ? { status: 'deleted' } : { status: 'not-found' };
};
