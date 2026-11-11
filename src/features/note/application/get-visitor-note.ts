import type { VisitorNote } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/** 訪問者に見せる note（FR-004・FR-012）。公開で削除していない note の識別子でなければ null */
export const getVisitorNote = (notes: NoteRepository, slug: string): Promise<VisitorNote | null> =>
  notes.findVisitorBySlug(slug);
