import type { ProjectRepository } from '@/features/project/domain/project-repository';
import type { OrganizationRepository } from '@/shared/domain/organization';

/** 実績の書き込みのユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type ProjectDeps = {
  projects: ProjectRepository;
  organizations: Pick<OrganizationRepository, 'findByName'>;
};
