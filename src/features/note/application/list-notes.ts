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

/** `/dash` に出す2つの一覧。読み出せなかった一覧は null */
export type NoteDashboard = {
  notes: NoteSummaryDto[] | null;
  deletedNotes: DeletedNoteDto[] | null;
};

/**
 * `/dash` に出す、削除していない note と削除した note の一覧を読む。片方だけ読み出せ
 * なければ、読み出せた方を返し、もう片方を null にする。両方とも読み出せなければ投げる
 * （docs/SOFTWARE_DESIGN.md の原則4「部分的に成り立つ over 全部か無か」）
 */
export const listNoteDashboard = async (notes: NoteRepository): Promise<NoteDashboard> => {
  const [active, deleted] = await Promise.allSettled([listNotes(notes), listDeletedNotes(notes)]);
  if (active.status === 'rejected' && deleted.status === 'rejected') throw active.reason;
  return {
    notes: active.status === 'fulfilled' ? active.value : null,
    deletedNotes: deleted.status === 'fulfilled' ? deleted.value : null,
  };
};
