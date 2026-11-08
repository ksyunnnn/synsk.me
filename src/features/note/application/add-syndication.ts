import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import { isWebUrl } from '@/shared/domain/web-url';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/**
 * 転載先の URL を記録する（FR-031・FR-032）。同じ URL は、どの note にも 2 つ目を記録しない。
 * オーナーでなければ何も書かない（FR-033）
 */
export const addSyndication = async (
  { notes }: Pick<NoteDeps, 'notes'>,
  author: Author | null,
  id: NoteId,
  url: string,
): Promise<NoteOperationOutcome<'invalid' | 'deleted' | 'syndication-taken'>> => {
  if (!author) return { status: 'forbidden' };
  const trimmed = url.trim();
  if (!isWebUrl(trimmed)) return { status: 'invalid' };
  const result = await notes.addSyndication(id, trimmed);
  return result.ok ? { status: 'done' } : { status: result.reason };
};
