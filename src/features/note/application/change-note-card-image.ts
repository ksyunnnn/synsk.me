import { parseCardImageChoice, type NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';

export type ChangeNoteCardImageOutcome =
  | { status: 'changed' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; error: 'invalid' | 'media-not-owned' };

/**
 * 代表画像の出どころを変える（FR-024・FR-025）。`media` は、その note の画像だけを選べる。
 * オーナーでなければ何も書かない（FR-033）
 */
export const changeNoteCardImage = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  value: string,
): Promise<ChangeNoteCardImageOutcome> => {
  if (!author) return { status: 'forbidden' };
  const choice = parseCardImageChoice(value);
  if (choice === null) return { status: 'invalid', error: 'invalid' };

  const result = await notes.changeCardImage(id, choice);
  if (result.ok) return { status: 'changed' };
  return result.reason === 'not-found'
    ? { status: 'not-found' }
    : { status: 'invalid', error: 'media-not-owned' };
};
