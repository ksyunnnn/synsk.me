import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

export type DeleteNoteOutcome =
  | { ok: true }
  /** note が存在しない（別の画面で削除された） */
  | { ok: false; reason: 'not-found' }
  /** データベースに届かないなどで、削除できなかった */
  | { ok: false; reason: 'failed' };

/** note を、公開している内容とともに削除する */
export const deleteNote = async (notes: NoteRepository, id: NoteId): Promise<DeleteNoteOutcome> => {
  try {
    return await notes.delete(id);
  } catch {
    return { ok: false, reason: 'failed' };
  }
};
