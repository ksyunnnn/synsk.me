import {
  parseNoteForm,
  type NoteField,
  type NoteFieldError,
  type NoteFormValues,
} from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';
import type { NoteDeps } from './deps';
import { collectLinkPreviews } from './link-previews';

export type CreateNoteOutcome =
  | { status: 'created'; uid: Uid }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<NoteField, NoteFieldError>>;
      values: NoteFormValues;
    };

/**
 * note を作る（FR-001・FR-002・FR-005）。作った note は下書きで、版を 1 つ持つ。オーナーで
 * なければ何も書かない（FR-033）。版を書いた後、本文のカードにする URL の参照先の情報を取る
 */
export const createNote = async (
  deps: NoteDeps,
  author: Author | null,
  values: NoteFormValues,
): Promise<CreateNoteOutcome> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseNoteForm(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };

  const result = await deps.notes.create(parsed.slug, parsed.content);
  if (!result.ok) return { status: 'invalid', errors: { slug: 'slug-taken' }, values };
  await collectLinkPreviews(deps, parsed.content.body, { refresh: false });
  return { status: 'created', uid: result.uid };
};
