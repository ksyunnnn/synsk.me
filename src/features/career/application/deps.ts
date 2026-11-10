import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { MediaStorage } from '@/shared/domain/media';
import type { OrganizationRepository } from '@/shared/domain/organization';

/** 職歴の書き込みのユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type CareerDeps = {
  careers: CareerRepository;
  organizations: Pick<OrganizationRepository, 'findByName'>;
  /** 画像の置き場（FR-027） */
  media: MediaStorage;
};
