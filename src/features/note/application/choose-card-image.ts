import { isCardImageSource, type NoteId } from '@/features/note/domain/note';
import { isNoteImageFile, toStorageKey } from '@/features/note/domain/note-image';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/**
 * 代表画像を選ぶ（FR-024・FR-025）。その note の画像だけを選べる。オーナーでなければ何も
 * 書かない（FR-033）
 */
export const chooseCardImage = async (
  { notes }: Pick<NoteDeps, 'notes'>,
  author: Author | null,
  id: NoteId,
  choice: { source: string; file: string },
): Promise<NoteOperationOutcome<'invalid' | 'deleted' | 'not-own-image'>> => {
  if (!author) return { status: 'forbidden' };
  if (!isCardImageSource(choice.source)) return { status: 'invalid' };
  if (choice.source === 'media' && !isNoteImageFile(choice.file))
    return { status: 'not-own-image' };
  const result = await notes.chooseCardImage(
    id,
    choice.source,
    choice.source === 'media' ? toStorageKey(choice.file) : null,
  );
  return result.ok ? { status: 'done' } : { status: result.reason };
};
