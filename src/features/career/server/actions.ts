'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteCareer as deleteCareerUseCase } from '@/features/career/application/delete-career';
import { editCareer as editCareerUseCase } from '@/features/career/application/edit-career';
import { registerCareer as registerCareerUseCase } from '@/features/career/application/register-career';
import {
  CAREER_FIELDS,
  CAREER_UID_FIELD,
  OPENED_UPDATED_AT_FIELD,
  type CareerFormResult,
  type CareerFormValues,
} from '@/features/career/domain/career';
import { createCareerDeps, findCareerId } from '@/features/career/server/queries';
import { getCurrentAuthor } from '@/shared/server/author';

/**
 * 職歴のフォームが呼ぶ Server Action。何より先に作り手であることを確かめる（ADR-0036）。
 * 作り手でなければ、入力した値を返さない
 */

const readString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

const readValues = (formData: FormData): CareerFormValues =>
  Object.fromEntries(
    CAREER_FIELDS.map((field) => [field, readString(formData, field)]),
  ) as CareerFormValues;

/** 職歴を登録し、編集の画面へ移る */
export const registerCareer = async (
  _state: CareerFormResult | null,
  formData: FormData,
): Promise<CareerFormResult> => {
  const outcome = await registerCareerUseCase(
    await createCareerDeps(),
    await getCurrentAuthor(),
    readValues(formData),
  );
  if (outcome.status === 'registered') redirect(`/dash/careers/${outcome.uid}?saved=1`);
  return outcome;
};

/** 職歴を編集し、同じ画面へ移る。先に書き換えられていたら、入力を残して知らせる（FR-042） */
export const editCareer = async (
  _state: CareerFormResult | null,
  formData: FormData,
): Promise<CareerFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const deps = await createCareerDeps();
  const uid = readString(formData, CAREER_UID_FIELD);
  const id = await findCareerId(deps.careers, uid);
  if (id === null) redirect('/dash/careers');

  const outcome = await editCareerUseCase(deps, author, id, readValues(formData), {
    openedUpdatedAt: readString(formData, OPENED_UPDATED_AT_FIELD),
    now: new Date().toISOString(),
  });
  if (outcome.status === 'saved') redirect(`/dash/careers/${uid}?saved=1`);
  if (outcome.status === 'not-found') redirect('/dash/careers');
  return outcome;
};

/** 職歴を削除し、一覧の画面へ移る */
export const deleteCareer = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { careers } = await createCareerDeps();
  const id = await findCareerId(careers, readString(formData, CAREER_UID_FIELD));
  if (id === null) redirect('/dash/careers');
  const outcome = await deleteCareerUseCase(careers, author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect('/dash/careers?deleted=1');
};
