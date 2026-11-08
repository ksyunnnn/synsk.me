import type { NoteId, RevisionNumber } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/**
 * note を過去の版に戻す（FR-009）。戻した版の題・説明文・本文を新しい版として保存する。公開した
 * 版は変えない。開いたときの版の番号と最新の版の番号が違えば戻さない（research.md の R4）。
 * オーナーでなければ何も書かない（FR-033）
 */
export const restoreRevision = async (
  { notes }: Pick<NoteDeps, 'notes'>,
  author: Author | null,
  id: NoteId,
  number: RevisionNumber | null,
  openedRevision: RevisionNumber | null,
): Promise<NoteOperationOutcome<'conflict' | 'deleted'>> => {
  if (!author) return { status: 'forbidden' };
  const [current, revision] = await Promise.all([
    notes.findForEdit(id),
    number === null ? null : notes.findRevision(id, number),
  ]);
  if (!current || !revision) return { status: 'not-found' };
  if (current.isDeleted) return { status: 'deleted' };
  if (openedRevision === null) return { status: 'conflict' };

  const result = await notes.save(
    id,
    current.slug,
    { title: revision.title, description: revision.description, body: revision.body },
    openedRevision,
  );
  if (result.ok) return { status: 'done' };
  // 識別子は今の値のまま書くため、識別子の理由では止まらない
  return result.reason === 'slug-taken' || result.reason === 'slug-locked'
    ? { status: 'conflict' }
    : { status: result.reason };
};
