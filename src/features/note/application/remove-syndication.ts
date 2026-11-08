import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/** 記録した転載先の URL を消す。オーナーでなければ何も書かない（FR-033） */
export const removeSyndication = async (
  { notes }: Pick<NoteDeps, 'notes'>,
  author: Author | null,
  id: NoteId,
  url: string,
): Promise<NoteOperationOutcome<'deleted'>> => {
  if (!author) return { status: 'forbidden' };
  const result = await notes.removeSyndication(id, url);
  return result.ok ? { status: 'done' } : { status: result.reason };
};
