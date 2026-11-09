import type { NoteId, SyndicationFieldError } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';
import { isWebUrl } from '@/shared/domain/web-url';

export type AddNoteSyndicationOutcome =
  | { status: 'added' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; error: SyndicationFieldError };

/**
 * note に転載先の URL を記録する（FR-031・FR-032）。URL は http か https に限る
 * （`src/shared/domain/web-url.ts`）。オーナーでなければ何も書かない（FR-033）
 */
export const addNoteSyndication = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  value: string,
): Promise<AddNoteSyndicationOutcome> => {
  if (!author) return { status: 'forbidden' };
  const url = value.trim();
  if (url === '') return { status: 'invalid', error: 'missing' };
  if (!isWebUrl(url)) return { status: 'invalid', error: 'invalid' };

  const result = await notes.addSyndication(id, url);
  if (result.ok) return { status: 'added' };
  return result.reason === 'url-taken'
    ? { status: 'invalid', error: 'taken' }
    : { status: 'not-found' };
};
