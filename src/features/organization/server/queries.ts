import 'server-only';

import { listOrganizations as listOrganizationsUseCase } from '@/features/organization/application/list-organizations';
import type { Organization, OrganizationRepository } from '@/shared/domain/organization';
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

/** 文字列の id を読む。正の整数でなければ null。個人の組織の id（0）も読む */
const parseOrganizationId = (value: string): number | null =>
  /^(0|[1-9]\d{0,15})$/.test(value) ? Number(value) : null;

/** 作り手が編集する組織と、指している職歴・実績の有無。作り手でなければ 403。無い id なら null */
export const getOrganizationForEdit = async (
  id: string,
): Promise<{
  organization: Organization;
  references: { isReferenced: boolean; isReferencedByMasked: boolean };
} | null> => {
  await requireAuthor();
  const organizationId = parseOrganizationId(id);
  if (organizationId === null) return null;
  const organizations = await createOrganizationRepository();
  const organization = await organizations.findById(organizationId);
  if (!organization) return null;
  return { organization, references: await organizations.findReferences(organizationId) };
};

export { parseOrganizationId };

/** `src/proxy.ts` が呼ぶ。作り手が編集できる組織がある id か */
export const hasOrganizationId = async (id: string): Promise<boolean> => {
  const organizationId = parseOrganizationId(id);
  return (
    organizationId !== null &&
    (await (await createOrganizationRepository()).findById(organizationId)) !== null
  );
};
