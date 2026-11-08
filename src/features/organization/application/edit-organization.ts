import type { Author } from '@/shared/domain/author';
import {
  canChangeMaskedName,
  parseOrganizationName,
  type OrganizationId,
  type OrganizationRepository,
} from '@/shared/domain/organization';

/** 組織のフォームが、入力の項目とは別に送る値 */
export const ORGANIZATION_UID_FIELD = 'organizationUid';

export type OrganizationField = 'name' | 'nameMasked';
export type OrganizationFieldError = 'missing' | 'name-taken' | 'masked-name-required';
export type OrganizationFormValues = Record<OrganizationField, string>;

export type EditOrganizationOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | {
      status: 'invalid';
      errors: Partial<Record<OrganizationField, OrganizationFieldError>>;
      values: OrganizationFormValues;
    };

/**
 * 組織名と秘匿化した組織名を直す（FR-001・FR-003・FR-004）。オーナーでなければ何も書かない
 * （FR-040）。指している職歴・実績を読み、決まりを確かめ、最後に書く
 */
export const editOrganization = async (
  organizations: OrganizationRepository,
  author: Author | null,
  id: OrganizationId,
  values: OrganizationFormValues,
): Promise<EditOrganizationOutcome> => {
  if (!author) return { status: 'forbidden' };

  const name = parseOrganizationName(values.name);
  if (name === null) return { status: 'invalid', errors: { name: 'missing' }, values };
  const nameMasked = values.nameMasked.trim() === '' ? null : values.nameMasked.trim();

  const references = await organizations.findReferences(id);
  if (!canChangeMaskedName(nameMasked, references)) {
    return { status: 'invalid', errors: { nameMasked: 'masked-name-required' }, values };
  }

  const result = await organizations.edit(id, { name, nameMasked });
  if (result.ok) return { status: 'saved' };
  switch (result.reason) {
    case 'not-found':
      return { status: 'not-found' };
    case 'name-taken':
      return { status: 'invalid', errors: { name: 'name-taken' }, values };
    case 'masked-name-required':
      return { status: 'invalid', errors: { nameMasked: 'masked-name-required' }, values };
  }
};
