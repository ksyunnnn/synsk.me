import { toPublishedNoteDto, type PublishedNoteDto } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/**
 * 訪問者に見せる note を slug で読む。下書きと存在しない slug は区別せず null。
 * 読み出せなければ投げる
 */
export const getPublishedNote = async (
  notes: NoteRepository,
  slug: string,
): Promise<PublishedNoteDto | null> => {
  const note = await notes.findPublishedBySlug(slug);
  return note && toPublishedNoteDto(note);
};
