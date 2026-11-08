import type { NoteId } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps } from './deps';
import { collectLinkPreviews } from './link-previews';

/**
 * 最新の版の本文のカードにする URL の、参照先の情報を取り直す（FR-029、research.md の R9）。
 * 取り直した中身は、同じ URL を書いたすべての note のカードに出る。オーナーでなければ何も
 * 書かない（FR-033）
 */
export const refreshLinkPreviews = async (
  deps: Pick<NoteDeps, 'notes' | 'fetchLinkPreviews' | 'now'>,
  author: Author | null,
  id: NoteId,
): Promise<
  { status: 'done'; count: number } | { status: 'forbidden' } | { status: 'not-found' }
> => {
  if (!author) return { status: 'forbidden' };
  const note = await deps.notes.findForEdit(id);
  if (!note) return { status: 'not-found' };
  const count = await collectLinkPreviews(deps, note.latest.body, { refresh: true });
  return { status: 'done', count };
};
