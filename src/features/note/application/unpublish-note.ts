import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/**
 * 公開の note を下書きに戻す（FR-014）。公開した版と初めて公開した日時は残す。オーナーで
 * なければ何も書かない（FR-033）
 */
export const unpublishNote = async (
  { notes }: Pick<NoteDeps, 'notes'>,
  author: Author | null,
  id: NoteId,
): Promise<NoteOperationOutcome<'deleted'>> => {
  if (!author) return { status: 'forbidden' };
  const result = await notes.unpublish(id);
  return result.ok ? { status: 'done' } : { status: result.reason };
};
