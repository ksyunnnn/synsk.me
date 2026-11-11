import { parseFirstParagraphAsDescription, type NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';

export type ChangeNoteFirstParagraphAsDescriptionOutcome =
  { status: 'changed' } | { status: 'forbidden' } | { status: 'not-found' } | { status: 'invalid' };

/**
 * 説明文が空のときに本文の最初の段落を説明に使うかを変える（FR-034）。版は足さない。
 * オーナーでなければ何も書かない（FR-033）
 */
export const changeNoteFirstParagraphAsDescription = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  value: string,
): Promise<ChangeNoteFirstParagraphAsDescriptionOutcome> => {
  if (!author) return { status: 'forbidden' };
  const isFirstParagraphAsDescription = parseFirstParagraphAsDescription(value);
  if (isFirstParagraphAsDescription === null) return { status: 'invalid' };

  const result = await notes.changeFirstParagraphAsDescription(id, isFirstParagraphAsDescription);
  return result.ok ? { status: 'changed' } : { status: 'not-found' };
};
