import type { Author } from '@/shared/domain/author';
import {
  isPersonalOrganization,
  type OrganizationId,
  type OrganizationRepository,
} from '@/shared/domain/organization';

export type DeleteOrganizationOutcome =
  | { status: 'deleted' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'referenced' }
  | { status: 'personal' };

/**
 * 組織を消す。職歴・実績が指している組織（FR-006）と個人の組織（FR-041）は消さない。
 * オーナーでなければ何も書かない（FR-040）
 */
export const deleteOrganization = async (
  organizations: OrganizationRepository,
  author: Author | null,
  id: OrganizationId,
): Promise<DeleteOrganizationOutcome> => {
  if (!author) return { status: 'forbidden' };
  if (isPersonalOrganization(id)) return { status: 'personal' };
  const result = await organizations.delete(id);
  return result.ok ? { status: 'deleted' } : { status: result.reason };
};
