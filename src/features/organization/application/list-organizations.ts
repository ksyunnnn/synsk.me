import type { Organization, OrganizationRepository } from '@/shared/domain/organization';

/** 作り手の組織の一覧 */
export const listOrganizations = (organizations: OrganizationRepository): Promise<Organization[]> =>
  organizations.list();
