import 'server-only';

import { listOrganizations as listOrganizationsUseCase } from '@/features/organization/application/list-organizations';
import type { Organization, OrganizationRepository } from '@/shared/domain/organization';
import { findIdByUid } from '@/shared/domain/uid';
import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';
import { createD1OrganizationRepository } from '@/shared/server/organization-repository';

/**
 * 組織の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる
 */

export const createOrganizationRepository = async (): Promise<OrganizationRepository> =>
  createD1OrganizationRepository((await readEnv()).DB);

/** 作り手の一覧。作り手でなければ 403 */
export const listOrganizations = async (): Promise<Organization[]> => {
  await requireAuthor();
  return listOrganizationsUseCase(await createOrganizationRepository());
};

/** 作り手が編集する組織と、指している職歴・実績の有無。作り手でなければ 403。無い uid なら null */
export const getOrganizationForEdit = async (
  uid: string,
): Promise<{
  organization: Organization;
  references: { isReferenced: boolean; isReferencedByMasked: boolean };
} | null> => {
  await requireAuthor();
  const organizations = await createOrganizationRepository();
  const organizationId = await findIdByUid(organizations, uid);
  if (organizationId === null) return null;
  const organization = await organizations.findById(organizationId);
  if (!organization) return null;
  return { organization, references: await organizations.findReferences(organizationId) };
};

/** `src/proxy.ts` が呼ぶ。作り手が編集できる組織がある uid か */
export const hasOrganizationUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid(await createOrganizationRepository(), uid)) !== null;
