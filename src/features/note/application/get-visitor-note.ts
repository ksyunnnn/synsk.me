import { extractCardUrls } from '@/features/note/domain/link-card';
import type { VisitorNote } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/**
 * 訪問者に見せる note（FR-004・FR-012）。公開した版の本文のカードにする URL の参照先の情報を、
 * 保存してあるものから詰める。参照先へは取りに行かない（FR-028・SC-005）。無い識別子・下書き・
 * 削除した note なら null
 */
export const getVisitorNote = async (
  notes: NoteRepository,
  slug: string,
): Promise<VisitorNote | null> => {
  const note = await notes.findVisitorBySlug(slug);
  if (!note) return null;
  const previews = await notes.findLinkPreviews(extractCardUrls(note.body));
  return {
    ...note,
    linkPreviews: Object.fromEntries(previews.map((preview) => [preview.url, preview])),
  };
};
