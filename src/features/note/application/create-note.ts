import {
  validateDraft,
  type NoteContent,
  type NoteContentErrors,
  type NoteId,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

export type CreateNoteOutcome =
  | { ok: true; id: NoteId }
  /** 入力が規則に合わない */
  | { ok: false; reason: 'invalid'; errors: NoteContentErrors }
  /** slug が他の note と重なる */
  | { ok: false; reason: 'slug-taken' }
  /** データベースに届かないなどで、保存できなかった */
  | { ok: false; reason: 'failed' };

/** 下書きの note を作る。入力が規則に合わなければ書き込まない */
export const createNote = async (
  notes: NoteRepository,
  content: NoteContent,
): Promise<CreateNoteOutcome> => {
  const validation = validateDraft(content);
  if (!validation.ok) return { ok: false, reason: 'invalid', errors: validation.errors };

  try {
    return await notes.create(validation.content);
  } catch {
    return { ok: false, reason: 'failed' };
  }
};
