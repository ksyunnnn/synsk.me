import { toEditableNoteDto, type EditableNoteDto, type NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/** 作り手が編集する note を読む。存在しなければ null。読み出せなければ投げる */
export const getNoteForEdit = async (
  notes: NoteRepository,
  id: NoteId,
): Promise<EditableNoteDto | null> => {
  const note = await notes.findForEdit(id);
  return note && toEditableNoteDto(note);
};
