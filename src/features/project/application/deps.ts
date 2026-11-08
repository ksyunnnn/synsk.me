import type { ProjectRepository } from '@/features/project/domain/project-repository';
import type { ImageStorage } from '@/shared/domain/media-image';
import type { OrganizationRepository } from '@/shared/domain/organization';

/** 実績の書き込みのユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type ProjectDeps = {
  projects: ProjectRepository;
  organizations: Pick<OrganizationRepository, 'findByName'>;
  /** 画像の置き場（src/shared/server/media-storage.ts） */
  images: ImageStorage;
};
