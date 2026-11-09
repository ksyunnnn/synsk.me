import type { NoteSummary } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/** オーナーの note の一覧 */
export const listNotes = (notes: NoteRepository): Promise<NoteSummary[]> => notes.list();
