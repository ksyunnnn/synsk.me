'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteProject as deleteProjectUseCase } from '@/features/project/application/delete-project';
import { editProject as editProjectUseCase } from '@/features/project/application/edit-project';
import {
  addProjectMedia as addProjectMediaUseCase,
  changeProjectCardImage as changeProjectCardImageUseCase,
} from '@/features/project/application/project-media';
import { registerProject as registerProjectUseCase } from '@/features/project/application/register-project';
import {
  AS_CARD_IMAGE_FIELD,
  CARD_IMAGE_FIELD,
  NO_CARD_IMAGE,
  OPENED_UPDATED_AT_FIELD,
  PROJECT_FIELDS,
  PROJECT_UID_FIELD,
  type CardImageFormResult,
  type ProjectFormResult,
  type ProjectFormValues,
} from '@/features/project/domain/project';
import { createProjectDeps } from '@/features/project/server/queries';
import {
  MEDIA_FILE_FIELD,
  parseMediaStorageKey,
  type MediaFormResult,
} from '@/shared/domain/media';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readStrings } from '@/shared/server/form-data';

/**
 * 実績のフォームが呼ぶ Server Action。`page.tsx` が読み込み、フォームの部品に props で渡す
 * （ADR-0026 の依存の向き 3）。
 *
 * どの操作も、何より先にオーナーであることを確かめる（ユースケースの先頭）。Server Action は
 * 経路に縛られず、`/dash` の外への POST からも呼べるため（ADR-0036）。
 * オーナーでなければ、入力した値を返さない
 */

/** スキルはチェックボックスの並びで送られるため、すべての値をカンマで区切って 1 つにする */
const readValues = (formData: FormData): ProjectFormValues =>
  Object.fromEntries(
    PROJECT_FIELDS.map((field) => [
      field,
      field === 'skillIds' ? readStrings(formData, field).join(',') : readString(formData, field),
    ]),
  ) as ProjectFormValues;

/** 実績を登録し、編集の画面へ移る */
export const registerProject = async (
  _state: ProjectFormResult | null,
  formData: FormData,
): Promise<ProjectFormResult> => {
  const outcome = await registerProjectUseCase(
    await createProjectDeps(),
    await getCurrentAuthor(),
    readValues(formData),
  );
  if (outcome.status === 'registered') redirect(`/dash/projects/${outcome.uid}?saved=1`);
  return outcome;
};

/** 実績を編集し、同じ画面へ移る。先に書き換えられていたら、入力を残して知らせる（FR-042） */
export const editProject = async (
  _state: ProjectFormResult | null,
  formData: FormData,
): Promise<ProjectFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const deps = await createProjectDeps();
  const uid = readString(formData, PROJECT_UID_FIELD);
  const id = await findIdByUid(deps.projects, uid);
  if (id === null) redirect('/dash/projects');

  const outcome = await editProjectUseCase(deps, author, id, readValues(formData), {
    openedUpdatedAt: readString(formData, OPENED_UPDATED_AT_FIELD),
    now: new Date().toISOString(),
  });
  if (outcome.status === 'saved') redirect(`/dash/projects/${uid}?saved=1`);
  if (outcome.status === 'not-found') redirect('/dash/projects');
  return outcome;
};

/** 実績を削除し、一覧の画面へ移る。確認の画面（`/dash/projects/{uid}/delete`）のフォームが呼ぶ */
export const deleteProject = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const deps = await createProjectDeps();
  const id = await findIdByUid(deps.projects, readString(formData, PROJECT_UID_FIELD));
  if (id === null) redirect('/dash/projects');

  const outcome = await deleteProjectUseCase(deps, author, id);
  if (outcome.status === 'forbidden') return outcome;
  redirect('/dash/projects?deleted=1');
};

/** 画像を 1 枚足し、同じ画面へ移る（FR-027）。代表画像にもする指定があれば、代表画像にする（FR-028） */
export const addProjectMedia = async (
  _state: MediaFormResult | null,
  formData: FormData,
): Promise<MediaFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const deps = await createProjectDeps();
  const uid = readString(formData, PROJECT_UID_FIELD);
  const id = await findIdByUid(deps.projects, uid);
  if (id === null) redirect('/dash/projects');

  const file = formData.get(MEDIA_FILE_FIELD);
  const outcome = await addProjectMediaUseCase(
    deps,
    author,
    id,
    file instanceof Blob && file.size > 0 ? file : null,
    { asCardImage: readString(formData, AS_CARD_IMAGE_FIELD) === '1' },
  );
  if (outcome.status === 'added') redirect(`/dash/projects/${uid}?mediaAdded=1`);
  if (outcome.status === 'not-found') redirect('/dash/projects');
  if (outcome.status === 'forbidden') return outcome;
  return { status: 'invalid', errors: { [MEDIA_FILE_FIELD]: outcome.error }, values: {} };
};

/** 代表画像を選ぶ・外し、同じ画面へ移る（FR-028） */
export const changeProjectCardImage = async (
  _state: CardImageFormResult | null,
  formData: FormData,
): Promise<CardImageFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const deps = await createProjectDeps();
  const uid = readString(formData, PROJECT_UID_FIELD);
  const id = await findIdByUid(deps.projects, uid);
  if (id === null) redirect('/dash/projects');

  const value = readString(formData, CARD_IMAGE_FIELD);
  const storageKey = value === NO_CARD_IMAGE ? null : parseMediaStorageKey(value);
  if (value !== NO_CARD_IMAGE && storageKey === null)
    return { status: 'invalid', errors: { [CARD_IMAGE_FIELD]: 'invalid' }, values: {} };
  const outcome = await changeProjectCardImageUseCase(deps.projects, author, id, storageKey);
  if (outcome.status === 'changed') redirect(`/dash/projects/${uid}?cardImageChanged=1`);
  if (outcome.status === 'not-found') redirect('/dash/projects');
  if (outcome.status === 'forbidden') return outcome;
  return { status: 'invalid', errors: { [CARD_IMAGE_FIELD]: outcome.error }, values: {} };
};
