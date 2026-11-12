import type { ProjectSummary } from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';
import type { ProjectKind } from '@/shared/domain/project-kind';

/** オーナーの実績の一覧。`kind` が null なら、すべての種類 */
export const listProjects = (
  projects: ProjectRepository,
  kind: ProjectKind | null,
): Promise<ProjectSummary[]> => projects.list(kind === null ? undefined : { kind });
