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
} from '@/features/education/domain/education';
import { createEducationRepository } from '@/features/education/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';
import { routes } from '@/shared/routes';

/**
 * 学歴のフォームが呼ぶ Server Action。何より先にオーナーであることを確かめる（ADR-0036）。
 * オーナーでなければ、入力した値を返さない
 */

export const registerEducation = async (
  _state: EducationFormResult | null,
  formData: FormData,
): Promise<EducationFormResult> => {
  const outcome = await registerEducationUseCase(
    await createEducationRepository(),
    await getCurrentAuthor(),
    readValues(formData, EDUCATION_FIELDS),
  );
  if (outcome.status === 'registered') redirect(`${routes.dash.educations.list}?saved=1`);
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
  if (id === null) redirect(routes.dash.educations.list);
  const outcome = await editEducationUseCase(
    educations,
    author,
    id,
    readValues(formData, EDUCATION_FIELDS),
  );
  if (outcome.status === 'saved') redirect(`${routes.dash.educations.list}?saved=1`);
  if (outcome.status === 'not-found') redirect(routes.dash.educations.list);
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
  if (id === null) redirect(routes.dash.educations.list);
  const outcome = await deleteEducationUseCase(educations, author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect(`${routes.dash.educations.list}?deleted=1`);
};
