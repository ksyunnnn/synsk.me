import type { Note, NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/** オーナーが編集する note。削除した note も返す。無い id なら null */
export const getNoteForEdit = (notes: NoteRepository, id: NoteId): Promise<Note | null> =>
  notes.findForEdit(id);
