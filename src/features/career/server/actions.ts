'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { addCareerImage as addCareerImageUseCase } from '@/features/career/application/add-career-image';
import { deleteCareer as deleteCareerUseCase } from '@/features/career/application/delete-career';
import { editCareer as editCareerUseCase } from '@/features/career/application/edit-career';
import { registerCareer as registerCareerUseCase } from '@/features/career/application/register-career';
import {
  CAREER_FIELDS,
  CAREER_UID_FIELD,
  OPENED_UPDATED_AT_FIELD,
  type CareerFormResult,
} from '@/features/career/domain/career';
import { createCareerDeps } from '@/features/career/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';

/**
 * 職歴のフォームが呼ぶ Server Action。何より先にオーナーであることを確かめる（ADR-0036）。
 * オーナーでなければ、入力した値を返さない
 */

/** 職歴を登録し、編集の画面へ移る */
export const registerCareer = async (
  _state: CareerFormResult | null,
  formData: FormData,
): Promise<CareerFormResult> => {
  const outcome = await registerCareerUseCase(
    await createCareerDeps(),
    await getCurrentAuthor(),
    readValues(formData, CAREER_FIELDS),
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
  const id = await findIdByUid(deps.careers, uid);
  if (id === null) redirect('/dash/careers');

  const outcome = await editCareerUseCase(deps, author, id, readValues(formData, CAREER_FIELDS), {
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
  const deps = await createCareerDeps();
  const id = await findIdByUid(deps.careers, readString(formData, CAREER_UID_FIELD));
  if (id === null) redirect('/dash/careers');
  const outcome = await deleteCareerUseCase(deps, author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect('/dash/careers?deleted=1');
};

/** 職歴に画像を足し、本文に貼る書き方を編集の画面に出す（FR-027） */
export const addCareerImage = async (
  _state: { status: string } | null,
  formData: FormData,
): Promise<{ status: string }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const deps = await createCareerDeps();
  const uid = readString(formData, CAREER_UID_FIELD);
  const id = await findIdByUid(deps.careers, uid);
  if (id === null) redirect('/dash/careers');
  const file = formData.get('image');
  const outcome = await addCareerImageUseCase(
    deps,
    author,
    id,
    file instanceof File && file.size > 0
      ? { size: file.size, read: () => file.arrayBuffer() }
      : null,
  );
  if (outcome.status === 'added') {
    redirect(`/dash/careers/${uid}?done=image-added&image=${encodeURIComponent(outcome.file)}`);
  }
  if (outcome.status === 'not-found') redirect('/dash/careers');
  return outcome;
};
