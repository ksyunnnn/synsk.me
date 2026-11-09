import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';

export type RestoreNoteOutcome =
  { status: 'restored' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * 削除した note を元に戻す（FR-016・SC-007）。状態・版・識別子は削除の前のまま残っている。
 * オーナーでなければ何も書かない（FR-033）
 */
export const restoreNote = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
): Promise<RestoreNoteOutcome> => {
  if (!author) return { status: 'forbidden' };
  return (await notes.restore(id)).ok ? { status: 'restored' } : { status: 'not-found' };
};
