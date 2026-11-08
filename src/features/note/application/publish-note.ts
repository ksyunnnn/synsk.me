import type { NoteId, RevisionNumber } from '@/features/note/domain/note';
import type { Author } from '@/shared/domain/author';
import type { NoteDeps, NoteOperationOutcome } from './deps';

/**
 * 最新の版を公開する（FR-011〜FR-013）。題が空の版は公開しない。開いたときの版の番号と最新の
 * 版の番号が違えば公開しない（research.md の R4 の既定）。初めて公開した日時は、一度入れたら
 * 変えない。オーナーでなければ何も書かない（FR-033）
 */
export const publishNote = async (
  { notes, now }: Pick<NoteDeps, 'notes' | 'now'>,
  author: Author | null,
  id: NoteId,
  openedRevision: RevisionNumber | null,
): Promise<NoteOperationOutcome<'conflict' | 'deleted' | 'empty-title'>> => {
  if (!author) return { status: 'forbidden' };
  if (openedRevision === null) return { status: 'conflict' };
  const result = await notes.publish(id, openedRevision, now());
  return result.ok ? { status: 'done' } : { status: result.reason };
};
