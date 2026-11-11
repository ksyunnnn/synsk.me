import { checkPublishable, type NoteFieldErrors, type NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';

export type PublishNoteOutcome =
  | { status: 'published' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; errors: NoteFieldErrors; values: Record<string, never> };

/**
 * その時点の最も新しい版を公開する（FR-011・FR-013）。オーナーでなければ何も書かない（FR-033）。
 * 題が空の版は書く前に止め、題の項目で知らせる。開いたときの版とは比べない（plan.md の U6）
 */
export const publishNote = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  now: string,
): Promise<PublishNoteOutcome> => {
  if (!author) return { status: 'forbidden' };

  const current = await notes.findForEdit(id);
  if (!current || current.deletedAt !== null) return { status: 'not-found' };

  const errors = checkPublishable(current.latestRevision);
  if (Object.keys(errors).length > 0) return { status: 'invalid', errors, values: {} };

  const result = await notes.publish(id, now);
  if (result.ok) return { status: 'published' };
  return result.reason === 'not-found'
    ? { status: 'not-found' }
    : { status: 'invalid', errors: { title: 'missing' }, values: {} };
};
