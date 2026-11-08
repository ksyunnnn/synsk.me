import {
  parseEducationContent,
  type EducationField,
  type EducationFieldError,
  type EducationFormValues,
  type EducationId,
} from '@/features/education/domain/education';
import type { EducationRepository } from '@/features/education/domain/education-repository';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';

type Invalid = {
  status: 'invalid';
  errors: Partial<Record<EducationField, EducationFieldError>>;
  values: EducationFormValues;
};

/** 学歴を登録する（FR-036）。オーナーでなければ何も書かない（FR-040） */
export const registerEducation = async (
  educations: EducationRepository,
  author: Author | null,
  values: EducationFormValues,
): Promise<
  { status: 'registered'; id: EducationId; uid: Uid } | { status: 'forbidden' } | Invalid
> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseEducationContent(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  return { status: 'registered', ...(await educations.register(parsed.content)) };
};

/** 学歴を編集する（FR-036）。オーナーでなければ何も書かない（FR-040） */
export const editEducation = async (
  educations: EducationRepository,
  author: Author | null,
  id: EducationId,
  values: EducationFormValues,
): Promise<{ status: 'saved' } | { status: 'forbidden' } | { status: 'not-found' } | Invalid> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseEducationContent(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  return (await educations.edit(id, parsed.content)).ok
    ? { status: 'saved' }
    : { status: 'not-found' };
};

/** 学歴を物理削除する（FR-036）。オーナーでなければ何も書かない（FR-040） */
export const deleteEducation = async (
  educations: EducationRepository,
  author: Author | null,
  id: EducationId,
): Promise<{ status: 'deleted' | 'forbidden' | 'not-found' }> => {
  if (!author) return { status: 'forbidden' };
  return { status: (await educations.delete(id)).ok ? 'deleted' : 'not-found' };
};
