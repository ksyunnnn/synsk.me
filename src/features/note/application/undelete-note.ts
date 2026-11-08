import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/**
 * 削除した note を戻す（FR-016・SC-007）。削除前の状態（下書きか公開か）と版に戻る。オーナーで
 * なければ何も書かない（FR-033）
 */
export const undeleteNote = async (
  { notes }: Pick<NoteDeps, 'notes'>,
  author: Author | null,
  id: NoteId,
): Promise<NoteOperationOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await notes.undelete(id);
  return result.ok ? { status: 'done' } : { status: result.reason };
};
