import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps } from './deps';

export type PurgeNoteOutcome =
  { status: 'purged' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * note を完全に消す（FR-017、docs/REQUIREMENTS.md の FR-11、research.md の R6）。D1 の行を 1 つの
 * トランザクションで消してから、置き場の画像の実体を消す。D1 を消した時点で完全に消す操作は
 * 成り立つため、置き場の削除に失敗しても投げずに成功を返す。持ち主の行が無いため画像は訪問者に
 * 出ず、残った画像は共有担当の置き場の突き合わせが消す（tasks.md の T057）。オーナーでなければ
 * 何も消さない（FR-033）。
 * 管理画面からこれを呼ぶ画面は作らない（spec の Assumptions）
 */
export const purgeNote = async (
  { notes, media }: Pick<NoteDeps, 'notes' | 'media'>,
  author: Author | null,
  id: NoteId,
): Promise<PurgeNoteOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await notes.purge(id);
  if (!result.ok) return { status: 'not-found' };
  try {
    await media.remove(result.storageKeys);
  } catch {
    // 残った画像は、どの行からも指されない。共有担当の突き合わせが後で消す
  }
  return { status: 'purged' };
};
