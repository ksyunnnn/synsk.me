import {
  toDeletedNoteDto,
  toNoteSummaryDto,
  type DeletedNoteDto,
  type NoteSummaryDto,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/** 作り手向けに、削除していないすべての note を一覧する。読み出せなければ投げる */
export const listNotes = async (notes: NoteRepository): Promise<NoteSummaryDto[]> =>
  (await notes.listForAuthor()).map(toNoteSummaryDto);

/** 作り手向けに、削除した note を一覧する。読み出せなければ投げる */
export const listDeletedNotes = async (notes: NoteRepository): Promise<DeletedNoteDto[]> =>
  (await notes.listDeletedForAuthor()).map(toDeletedNoteDto);
