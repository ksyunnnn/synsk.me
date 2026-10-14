import {
  validateDraft,
  type NoteContent,
  type NoteContentErrors,
  type NoteId,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

export type SaveNoteOutcome =
  | { ok: true }
  /** 入力が規則に合わない */
  | { ok: false; reason: 'invalid'; errors: NoteContentErrors }
  /** slug が他の note と重なる */
  | { ok: false; reason: 'slug-taken' }
  /** note が存在しない（別の画面で削除された） */
  | { ok: false; reason: 'not-found' }
  /** 公開した note の slug を変えようとした */
  | { ok: false; reason: 'slug-fixed' }
  /** データベースに届かないなどで、保存できなかった */
  | { ok: false; reason: 'failed' };

/**
 * 入力した内容を版として保存する。公開している版は変えない。
 * 入力が規則に合わなければ書き込まない。`savedAt` を版を作った日時にする
 */
export const saveNote = async (
  notes: NoteRepository,
  id: NoteId,
  content: NoteContent,
  savedAt: string,
): Promise<SaveNoteOutcome> => {
  const validation = validateDraft(content);
  if (!validation.ok) return { ok: false, reason: 'invalid', errors: validation.errors };

  try {
    return await notes.save(id, validation.content, savedAt);
  } catch {
    return { ok: false, reason: 'failed' };
  }
};
