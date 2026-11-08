import {
  parseCareerContent,
  type CareerField,
  type CareerFieldError,
  type CareerFormValues,
  type CareerId,
} from '@/features/career/domain/career';
import type { Author } from '@/shared/domain/author';
import { canSaveWithOrganization } from '@/shared/domain/organization';
import type { CareerDeps } from './deps';

export type EditCareerOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | {
      status: 'invalid';
      errors: Partial<Record<CareerField, CareerFieldError>>;
      values: CareerFormValues;
    }
  | { status: 'conflict'; values: CareerFormValues };

/** 職歴を編集する（FR-007・FR-042）。作り手でなければ何も書かない（FR-040） */
export const editCareer = async (
  { careers, organizations }: CareerDeps,
  author: Author | null,
  id: CareerId,
  values: CareerFormValues,
  times: { openedUpdatedAt: string; now: string },
): Promise<EditCareerOutcome> => {
  if (!author) return { status: 'forbidden' };
  if (!(await careers.hasId(id))) return { status: 'not-found' };

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
  const result = await careers.edit(id, content, times);
  if (result.ok) return { status: 'saved' };
  if (result.reason === 'not-found') return { status: 'not-found' };
  return result.reason === 'conflict'
    ? { status: 'conflict', values }
    : { status: 'invalid', errors: { organizationNameMasked: 'masked-name-required' }, values };
};
