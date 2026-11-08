'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import {
  deleteEducation as deleteEducationUseCase,
  editEducation as editEducationUseCase,
  registerEducation as registerEducationUseCase,
} from '@/features/education/application/save-education';
import {
  EDUCATION_FIELDS,
  EDUCATION_UID_FIELD,
  type EducationFormResult,
  type EducationFormValues,
} from '@/features/education/domain/education';
import { createEducationRepository } from '@/features/education/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';

/**
 * 学歴のフォームが呼ぶ Server Action。何より先に作り手であることを確かめる（ADR-0036）。
 * 作り手でなければ、入力した値を返さない
 */

const readString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

const readValues = (formData: FormData): EducationFormValues =>
  Object.fromEntries(
    EDUCATION_FIELDS.map((field) => [field, readString(formData, field)]),
  ) as EducationFormValues;

export const registerEducation = async (
  _state: EducationFormResult | null,
  formData: FormData,
): Promise<EducationFormResult> => {
  const outcome = await registerEducationUseCase(
    await createEducationRepository(),
    await getCurrentAuthor(),
    readValues(formData),
  );
  if (outcome.status === 'registered') redirect('/dash/educations?saved=1');
  return outcome;
};

export const editEducation = async (
  _state: EducationFormResult | null,
  formData: FormData,
): Promise<EducationFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const educations = await createEducationRepository();
  const id = await findIdByUid(educations, readString(formData, EDUCATION_UID_FIELD));
  if (id === null) redirect('/dash/educations');
  const outcome = await editEducationUseCase(educations, author, id, readValues(formData));
  if (outcome.status === 'saved') redirect('/dash/educations?saved=1');
  if (outcome.status === 'not-found') redirect('/dash/educations');
  return outcome;
};

export const deleteEducation = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const educations = await createEducationRepository();
  const id = await findIdByUid(educations, readString(formData, EDUCATION_UID_FIELD));
  if (id === null) redirect('/dash/educations');
  const outcome = await deleteEducationUseCase(educations, author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect('/dash/educations?deleted=1');
};
