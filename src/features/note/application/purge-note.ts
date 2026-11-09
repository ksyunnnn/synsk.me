import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps } from './deps';

export type PurgeNoteOutcome =
  { status: 'purged' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * note を完全に消す（FR-017、docs/REQUIREMENTS.md の FR-11、research.md の R6）。D1 の行を 1 つの
 * トランザクションで消してから、置き場の画像の実体を消す。置き場の削除に失敗しても、持ち主の行が
 * 無いため画像は訪問者に出ない。オーナーでなければ何も消さない（FR-033）。
 * 管理画面からこれを呼ぶ画面は作らない（spec の Assumptions）
 */
export const purgeNote = async (
  { notes, media }: NoteDeps,
  author: Author | null,
  id: NoteId,
): Promise<PurgeNoteOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await notes.purge(id);
  if (!result.ok) return { status: 'not-found' };
  await media.remove(result.storageKeys);
  return { status: 'purged' };
};
