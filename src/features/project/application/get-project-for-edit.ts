import type { Project, ProjectId } from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';

/** オーナーが編集する実績。無い id なら null */
export const getProjectForEdit = (
  projects: ProjectRepository,
  id: ProjectId,
): Promise<Project | null> => projects.findForEdit(id);
