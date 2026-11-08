import {
  parseCareerContent,
  type CareerField,
  type CareerFieldError,
  type CareerFormValues,
  type CareerId,
} from '@/features/career/domain/career';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';
import { canSaveWithOrganization } from '@/shared/domain/organization';
import type { CareerDeps } from './deps';

export type RegisterCareerOutcome =
  | { status: 'registered'; id: CareerId; uid: Uid }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<CareerField, CareerFieldError>>;
      values: CareerFormValues;
    };

/**
 * 職歴を登録する（FR-007・FR-010）。作り手でなければ何も書かない（FR-040）。
 * 組織を読み、FR-001 を確かめ、最後に書く
 */
export const registerCareer = async (
  { careers, organizations }: CareerDeps,
  author: Author | null,
  values: CareerFormValues,
): Promise<RegisterCareerOutcome> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseCareerContent(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const { content } = parsed;

  const organization = await organizations.findByName(content.organizationName);
  if (!canSaveWithOrganization(organization, content)) {
    return {
      status: 'invalid',
      errors: { organizationNameMasked: 'masked-name-required' },
      values,
    };
  }
  const result = await careers.register(content);
  return result.ok
    ? { status: 'registered', id: result.id, uid: result.uid }
    : { status: 'invalid', errors: { organizationNameMasked: 'masked-name-required' }, values };
};
