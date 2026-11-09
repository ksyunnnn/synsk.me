import type { NoteRepository } from '@/features/note/domain/note-repository';

/** note のユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type NoteDeps = {
  notes: NoteRepository;
};
