'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { addCareerMedia as addCareerMediaUseCase } from '@/features/career/application/add-career-media';
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
import { MEDIA_FILE_FIELD, type MediaFormResult } from '@/shared/domain/media';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';
import { routes } from '@/shared/routes';

/**
 * 職歴のフォームが呼ぶ Server Action。何より先にオーナーであることを確かめる（ADR-0036）。
 * オーナーでなければ、入力した値を返さない
 */

/** フォームの uid が指す職歴の id。無い uid なら null。オーナーの確認の後に呼ぶ */
const resolveCareer = async (formData: FormData) => {
  const deps = await createCareerDeps();
  const uid = readString(formData, CAREER_UID_FIELD);
  const id = await findIdByUid(deps.careers, uid);
  return { deps, uid, id };
};

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
  if (outcome.status === 'registered') redirect(`${routes.dash.careers.row(outcome.uid)}?saved=1`);
  return outcome;
};

/** 職歴を編集し、同じ画面へ移る。先に書き換えられていたら、入力を残して知らせる（FR-042） */
export const editCareer = async (
  _state: CareerFormResult | null,
  formData: FormData,
): Promise<CareerFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveCareer(formData);
  if (id === null) redirect(routes.dash.careers.list);

  const outcome = await editCareerUseCase(deps, author, id, readValues(formData, CAREER_FIELDS), {
    openedUpdatedAt: readString(formData, OPENED_UPDATED_AT_FIELD),
    now: new Date().toISOString(),
  });
  if (outcome.status === 'saved') redirect(`${routes.dash.careers.row(uid)}?saved=1`);
  if (outcome.status === 'not-found') redirect(routes.dash.careers.list);
  return outcome;
};

/** 職歴を削除し、一覧の画面へ移る */
export const deleteCareer = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, id } = await resolveCareer(formData);
  if (id === null) redirect(routes.dash.careers.list);
  const outcome = await deleteCareerUseCase(deps, author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect(`${routes.dash.careers.list}?deleted=1`);
};

/** 本文の画像を 1 枚足し、同じ画面へ移る（FR-027） */
export const addCareerMedia = async (
  _state: MediaFormResult | null,
  formData: FormData,
): Promise<MediaFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveCareer(formData);
  if (id === null) redirect(routes.dash.careers.list);

  const file = formData.get(MEDIA_FILE_FIELD);
  const outcome = await addCareerMediaUseCase(
    deps,
    author,
    id,
    file instanceof Blob && file.size > 0 ? file : null,
  );
  if (outcome.status === 'added') redirect(`${routes.dash.careers.row(uid)}?mediaAdded=1`);
  if (outcome.status === 'not-found') redirect(routes.dash.careers.list);
  if (outcome.status === 'forbidden') return outcome;
  return { status: 'invalid', errors: { [MEDIA_FILE_FIELD]: outcome.error }, values: {} };
};
