import {
  parseCareerContent,
  type CareerField,
  type CareerFieldError,
  type CareerFormValues,
  type CareerId,
} from '@/features/career/domain/career';
import type { Author } from '@/shared/domain/author';
import { checkOrganizationForSave } from '@/shared/domain/organization';
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

/** 職歴を編集する（FR-007・FR-042）。オーナーでなければ何も書かない（FR-040） */
export const editCareer = async (
  { careers, organizations }: CareerDeps,
  author: Author | null,
  id: CareerId,
  values: CareerFormValues,
  times: { openedUpdatedAt: string; now: string },
): Promise<EditCareerOutcome> => {
  if (!author) return { status: 'forbidden' };

  const parsed = parseCareerContent(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const { content } = parsed;

  const organizationError = await checkOrganizationForSave(organizations, content);
  if (organizationError) return { status: 'invalid', errors: organizationError, values };
  const result = await careers.edit(id, content, times);
  if (result.ok) return { status: 'saved' };
  if (result.reason === 'not-found') return { status: 'not-found' };
  return result.reason === 'conflict'
    ? { status: 'conflict', values }
    : { status: 'invalid', errors: { organizationNameMasked: 'masked-name-required' }, values };
};
