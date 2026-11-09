import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';

export type RevertNoteOutcome =
  | { status: 'reverted' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'conflict' };

/**
 * 過去の版に戻す（FR-009）。戻す版の中身を新しい版として足し、公開した版は変えない。オーナーで
 * なければ何も書かない（FR-033）。開いた後に別の画面で保存されていれば書かない（FR-020）。
 * 無い・削除した note と、その note に無い版は not-found（contracts/dash.md）
 */
export const revertNote = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  revisionUid: Uid,
  openedRevisionUid: Uid,
): Promise<RevertNoteOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await notes.revert(id, revisionUid, openedRevisionUid);
  if (result.ok) return { status: 'reverted' };
  return result.reason === 'conflict' ? { status: 'conflict' } : { status: 'not-found' };
};
