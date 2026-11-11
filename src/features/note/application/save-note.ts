import {
  checkSlugChange,
  parseNoteInput,
  type NoteFieldErrors,
  type NoteFormValues,
  type NoteId,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';

export type SaveNoteOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; errors: NoteFieldErrors; values: NoteFormValues }
  | { status: 'conflict'; values: NoteFormValues };

/**
 * note に版を 1 つ足す（FR-006・FR-020・FR-021）。オーナーでなければ何も書かない（FR-033）。
 * 今の note を読み、入力と識別子の書き換えを確かめ、開いた版と比べて書く（research.md の R4）
 */
export const saveNote = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  values: NoteFormValues,
  openedRevisionUid: Uid,
): Promise<SaveNoteOutcome> => {
  if (!author) return { status: 'forbidden' };

  const current = await notes.findForEdit(id);
  if (!current || current.deletedAt !== null) return { status: 'not-found' };

  const parsed = parseNoteInput(values);
  const slugError = checkSlugChange(current, values.slug);
  if (!parsed.ok || slugError) {
    return {
      status: 'invalid',
      errors: { ...(parsed.ok ? {} : parsed.errors), ...(slugError ? { slug: slugError } : {}) },
      values,
    };
  }

  const result = await notes.save(id, parsed.input, openedRevisionUid);
  if (result.ok) return { status: 'saved' };
  switch (result.reason) {
    case 'not-found':
      return { status: 'not-found' };
    case 'conflict':
      return { status: 'conflict', values };
    case 'slug-taken':
    case 'slug-locked':
      return { status: 'invalid', errors: { slug: result.reason }, values };
  }
};
