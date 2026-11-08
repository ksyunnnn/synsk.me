import type { VisitorProject } from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';

/** 訪問者に見せる実績（FR-014・FR-019）。無い識別子なら null */
export const getVisitorProject = (
  projects: ProjectRepository,
  slug: string,
): Promise<VisitorProject | null> => projects.findVisitorBySlug(slug);
