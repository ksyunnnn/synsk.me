import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';

export type UnpublishNoteOutcome =
  { status: 'unpublished' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * 公開の note を下書きに戻す（FR-014）。公開した版と初めて公開した日時は残す。オーナーでなければ
 * 何も書かない（FR-033）。無いか削除した note は not-found
 */
export const unpublishNote = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
): Promise<UnpublishNoteOutcome> => {
  if (!author) return { status: 'forbidden' };
  return (await notes.unpublish(id)).ok ? { status: 'unpublished' } : { status: 'not-found' };
};
