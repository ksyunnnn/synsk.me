import type { ProjectSummary } from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';

/** オーナーの実績の一覧 */
export const listProjects = (projects: ProjectRepository): Promise<ProjectSummary[]> =>
  projects.list();
