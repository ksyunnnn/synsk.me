import type { NoteId, NotePreview } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/**
 * 公開したときの見た目を確かめる形（REQUIREMENTS.md の FR-13、research.md の R15）。最も新しい版を、
 * 状態と削除に関わらず詰める。無い id なら null
 */
export const getNotePreview = (notes: NoteRepository, id: NoteId): Promise<NotePreview | null> =>
  notes.findPreview(id);
