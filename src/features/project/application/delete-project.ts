import type { ProjectId } from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';
import type { Author } from '@/shared/domain/author';

export type DeleteProjectOutcome =
  { status: 'deleted' } | { status: 'forbidden' } | { status: 'not-found' };

/** 実績を物理削除する（FR-011）。オーナーでなければ何も書かない（FR-040） */
export const deleteProject = async (
  projects: ProjectRepository,
  author: Author | null,
  id: ProjectId,
): Promise<DeleteProjectOutcome> => {
  if (!author) return { status: 'forbidden' };
  return (await projects.delete(id)).ok ? { status: 'deleted' } : { status: 'not-found' };
};
