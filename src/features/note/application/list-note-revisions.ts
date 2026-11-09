import type { NoteId, NoteRevision, NoteRevisionSummary } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Uid } from '@/shared/domain/uid';

/** note の版の一覧。保存した日時の新しい順（FR-008） */
export const listNoteRevisions = (
  notes: NoteRepository,
  id: NoteId,
): Promise<NoteRevisionSummary[]> => notes.listRevisions(id);

/** note の 1 つの版を、保存したときのまま返す（FR-008）。その note の版でなければ null */
export const getNoteRevision = (
  notes: NoteRepository,
  id: NoteId,
  revisionUid: Uid,
): Promise<NoteRevision | null> => notes.findRevision(id, revisionUid);
