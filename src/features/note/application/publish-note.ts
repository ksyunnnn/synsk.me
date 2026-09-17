import {
  validatePublication,
  type NoteContent,
  type NoteContentErrors,
  type NoteId,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

export type PublishNoteOutcome =
  | { ok: true }
  /** 入力が規則に合わない。題が空のときを含む */
  | { ok: false; reason: 'invalid'; errors: NoteContentErrors }
  /** slug が他の note と重なる */
  | { ok: false; reason: 'slug-taken' }
  /** note が存在しない（別の画面で削除された） */
  | { ok: false; reason: 'not-found' }
  /** 公開した note の slug を変えようとした */
  | { ok: false; reason: 'slug-fixed' }
  /** データベースに届かないなどで、保存も公開もできなかった */
  | { ok: false; reason: 'failed' };

/**
 * 入力した内容を保存し、公開する。公開済みの note では公開し直す。
 * 入力が規則に合わなければ、保存も公開もしない。
 *
 * `publishedAt` は、初めて公開するときだけ、初めて公開した日時として残る
 */
export const publishNote = async (
  notes: NoteRepository,
  id: NoteId,
  content: NoteContent,
  publishedAt: string,
): Promise<PublishNoteOutcome> => {
  const validation = validatePublication(content);
  if (!validation.ok) return { ok: false, reason: 'invalid', errors: validation.errors };

  try {
    return await notes.publish(id, validation.content, publishedAt);
  } catch {
    return { ok: false, reason: 'failed' };
  }
};
