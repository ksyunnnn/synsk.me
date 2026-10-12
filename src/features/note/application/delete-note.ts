import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

export type DeleteNoteOutcome =
  | { ok: true }
  /** note が存在しないか、すでに削除されている */
  | { ok: false; reason: 'not-found' }
  /** データベースに届かないなどで、削除できなかった */
  | { ok: false; reason: 'failed' };

/** note を削除する。データは残り、`restoreNote` で戻せる。`deletedAt` を削除した日時にする */
export const deleteNote = async (
  notes: NoteRepository,
  id: NoteId,
  deletedAt: string,
): Promise<DeleteNoteOutcome> => {
  try {
    return await notes.delete(id, deletedAt);
  } catch {
    return { ok: false, reason: 'failed' };
  }
};
