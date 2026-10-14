import { toDeletedNoteDto, type DeletedNoteDto, type NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/** 削除した note を読む。削除した note でなければ null。読み出せなければ投げる */
export const getDeletedNote = async (
  notes: NoteRepository,
  id: NoteId,
): Promise<DeletedNoteDto | null> => {
  const note = await notes.findDeleted(id);
  return note && toDeletedNoteDto(note);
};
