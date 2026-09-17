import { toNoteSummaryDto, type NoteSummaryDto } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/** 作り手向けに、すべての note を一覧する。読み出せなければ投げる */
export const listNotes = async (notes: NoteRepository): Promise<NoteSummaryDto[]> =>
  (await notes.listForAuthor()).map(toNoteSummaryDto);
