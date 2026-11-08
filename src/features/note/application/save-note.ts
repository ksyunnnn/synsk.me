import {
  parseNoteForm,
  type NoteField,
  type NoteFieldError,
  type NoteFormValues,
  type NoteId,
  type RevisionNumber,
} from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps } from './deps';
import { collectLinkPreviews } from './link-previews';

export type SaveNoteOutcome =
  | { status: 'saved'; revision: RevisionNumber }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'deleted'; values: NoteFormValues }
  | {
      status: 'invalid';
      errors: Partial<Record<NoteField, NoteFieldError>>;
      values: NoteFormValues;
    }
  | { status: 'conflict'; values: NoteFormValues };

/**
 * note を保存し、版を 1 つ足す（FR-006・FR-020・FR-021）。開いたときの版の番号と最新の版の
 * 番号が違えば保存を止め、送られた内容を返す（research.md の R4）。一度でも公開した note の
 * 識別子は変えない（FR-003）。オーナーでなければ何も書かない（FR-033）
 */
export const saveNote = async (
  deps: NoteDeps,
  author: Author | null,
  id: NoteId,
  values: NoteFormValues,
  openedRevision: RevisionNumber | null,
): Promise<SaveNoteOutcome> => {
  if (!author) return { status: 'forbidden' };
  const current = await deps.notes.findForEdit(id);
  if (!current) return { status: 'not-found' };
  if (current.isDeleted) return { status: 'deleted', values };
  if (openedRevision === null) return { status: 'conflict', values };

  const parsed = parseNoteForm(values);
  const slugLocked = current.publishedAt !== null && values.slug.trim() !== current.slug;
  if (!parsed.ok || slugLocked) {
    return {
      status: 'invalid',
      errors: {
        ...(parsed.ok ? {} : parsed.errors),
        ...(slugLocked ? { slug: 'slug-locked' } : {}),
      },
      values,
    };
  }

  const result = await deps.notes.save(id, parsed.slug, parsed.content, openedRevision);
  if (!result.ok) {
    switch (result.reason) {
      case 'not-found':
        return { status: 'not-found' };
      case 'deleted':
        return { status: 'deleted', values };
      case 'conflict':
        return { status: 'conflict', values };
      case 'slug-taken':
      case 'slug-locked':
        return { status: 'invalid', errors: { slug: result.reason }, values };
    }
  }
  await collectLinkPreviews(deps, parsed.content.body, { refresh: false });
  return { status: 'saved', revision: result.revision };
};
