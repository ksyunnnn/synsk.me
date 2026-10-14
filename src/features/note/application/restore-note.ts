import type { NoteId, RestoreAs } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

export type RestoreNoteOutcome =
  | { ok: true }
  /** 削除した note が存在しない（別の画面で戻された）か、公開したことのない note を公開で戻そうとした */
  | { ok: false; reason: 'not-found' }
  /** データベースに届かないなどで、戻せなかった */
  | { ok: false; reason: 'failed' };

/** 削除した note を、`as` の状態（下書きか公開か）で戻す */
export const restoreNote = async (
  notes: NoteRepository,
  id: NoteId,
  as: RestoreAs,
): Promise<RestoreNoteOutcome> => {
  try {
    return await notes.restore(id, as);
  } catch {
    return { ok: false, reason: 'failed' };
  }
};
