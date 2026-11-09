import type { NoteId } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';

export type RemoveNoteSyndicationOutcome =
  { status: 'removed' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * note の転載先の URL を外す（FR-031、research.md の R14）。URL で行を指し、別の note の URL は
 * 外さない。オーナーでなければ何も書かない（FR-033）
 */
export const removeNoteSyndication = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  url: string,
): Promise<RemoveNoteSyndicationOutcome> => {
  if (!author) return { status: 'forbidden' };
  return (await notes.removeSyndication(id, url)).ok
    ? { status: 'removed' }
    : { status: 'not-found' };
};
