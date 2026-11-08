import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/**
 * note を削除する（FR-016）。削除の印を付けるだけで、状態と版と識別子を残す。オーナーで
 * なければ何も書かない（FR-033）
 */
export const deleteNote = async (
  { notes, now }: Pick<NoteDeps, 'notes' | 'now'>,
  author: Author | null,
  id: NoteId,
): Promise<NoteOperationOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await notes.delete(id, now());
  return result.ok ? { status: 'done' } : { status: result.reason };
};
