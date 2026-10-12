import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

export type RestoreNoteOutcome =
  | { ok: true }
  /** 削除した note が存在しない（別の画面で戻された） */
  | { ok: false; reason: 'not-found' }
  /** データベースに届かないなどで、戻せなかった */
  | { ok: false; reason: 'failed' };

/** 削除した note を戻す。状態（下書きか公開か）は削除する前のままになる */
export const restoreNote = async (
  notes: NoteRepository,
  id: NoteId,
): Promise<RestoreNoteOutcome> => {
  try {
    return await notes.restore(id);
  } catch {
    return { ok: false, reason: 'failed' };
  }
};
