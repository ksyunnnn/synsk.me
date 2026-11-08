'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { addProjectImage as addProjectImageUseCase } from '@/features/project/application/add-project-image';
import { chooseProjectCardImage as chooseProjectCardImageUseCase } from '@/features/project/application/choose-project-card-image';
import { deleteProject as deleteProjectUseCase } from '@/features/project/application/delete-project';
import { editProject as editProjectUseCase } from '@/features/project/application/edit-project';
import { registerProject as registerProjectUseCase } from '@/features/project/application/register-project';
import {
  OPENED_UPDATED_AT_FIELD,
  PROJECT_FIELDS,
  PROJECT_UID_FIELD,
  type ProjectFormResult,
  type ProjectFormValues,
} from '@/features/project/domain/project';
import { createProjectDeps } from '@/features/project/server/queries';
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

/** 画像の操作の結果。成功したときは編集の画面へ移すため、返すのは止めたときだけ */
type ImageOperationResult = { status: string };

/** 画像の操作の前に、オーナーと実績を確かめる。オーナーでなければ null */
const resolveImageTarget = async (formData: FormData) => {
  const author = await getCurrentAuthor();
  if (!author) return null;
  const deps = await createProjectDeps();
  const uid = readString(formData, PROJECT_UID_FIELD);
  const id = await findIdByUid(deps.projects, uid);
  if (id === null) redirect('/dash/projects');
  return { author, deps, uid, id };
};

/** 実績に画像を足し、本文に貼る書き方を編集の画面に出す（FR-027・FR-028） */
export const addProjectImage = async (
  _state: ImageOperationResult | null,
  formData: FormData,
): Promise<ImageOperationResult> => {
  const target = await resolveImageTarget(formData);
  if (!target) return { status: 'forbidden' };
  const file = formData.get('image');
  const outcome = await addProjectImageUseCase(
    target.deps,
    target.author,
    target.id,
    file instanceof File && file.size > 0
      ? { size: file.size, read: () => file.arrayBuffer() }
      : null,
  );
  if (outcome.status === 'added') {
    redirect(
      `/dash/projects/${target.uid}?done=image-added&image=${encodeURIComponent(outcome.file)}`,
    );
  }
  if (outcome.status === 'not-found') redirect('/dash/projects');
  return outcome;
};

/** 実績の代表画像を選ぶ（FR-028）。空の値なら代表画像を外す */
export const chooseProjectCardImage = async (
  _state: ImageOperationResult | null,
  formData: FormData,
): Promise<ImageOperationResult> => {
  const target = await resolveImageTarget(formData);
  if (!target) return { status: 'forbidden' };
  const outcome = await chooseProjectCardImageUseCase(
    target.deps,
    target.author,
    target.id,
    readString(formData, 'cardImage'),
  );
  if (outcome.status === 'done') redirect(`/dash/projects/${target.uid}?done=card-image`);
  if (outcome.status === 'not-found') redirect('/dash/projects');
  return outcome;
};
