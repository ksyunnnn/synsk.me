import {
  parseNoteInput,
  type NoteFieldErrors,
  type NoteFormValues,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';

export type CreateNoteOutcome =
  | { status: 'created'; uid: Uid }
  | { status: 'forbidden' }
  | { status: 'invalid'; errors: NoteFieldErrors; values: NoteFormValues };

/**
 * note を作る（FR-001・FR-002・FR-005）。オーナーでなければ何も書かない（FR-033）。
 * 入力を確かめてから書く（docs/SOFTWARE_DESIGN.md の「読む → 計算 → 書く」）
 */
export const createNote = async (
  notes: NoteRepository,
  author: Author | null,
  values: NoteFormValues,
): Promise<CreateNoteOutcome> => {
  if (!author) return { status: 'forbidden' };

  const parsed = parseNoteInput(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };

  const result = await notes.create(parsed.input);
  if (result.ok) return { status: 'created', uid: result.uid };
  return { status: 'invalid', errors: { slug: 'slug-taken' }, values };
};
