'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteProject as deleteProjectUseCase } from '@/features/project/application/delete-project';
import { editProject as editProjectUseCase } from '@/features/project/application/edit-project';
import { registerProject as registerProjectUseCase } from '@/features/project/application/register-project';
import {
  OPENED_UPDATED_AT_FIELD,
  PROJECT_FIELDS,
  PROJECT_ID_FIELD,
  parseProjectId,
  type ProjectFormResult,
  type ProjectFormValues,
} from '@/features/project/domain/project';
import { createProjectDeps } from '@/features/project/server/queries';
import { getCurrentAuthor } from '@/shared/server/author';

/**
 * 実績のフォームが呼ぶ Server Action。`page.tsx` が読み込み、フォームの部品に props で渡す
 * （ADR-0026 の依存の向き 3）。
 *
 * どの操作も、何より先に作り手であることを確かめる（ユースケースの先頭）。Server Action は
 * 経路に縛られず、`/dash` の外への POST からも呼べるため（ADR-0036）。
 * 作り手でなければ、入力した値を返さない
 */

const readString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

/** スキルはチェックボックスの並びで送られるため、すべての値をカンマで区切って 1 つにする */
const readValues = (formData: FormData): ProjectFormValues =>
  Object.fromEntries(
    PROJECT_FIELDS.map((field) => [
      field,
      field === 'skillIds'
        ? formData
            .getAll(field)
            .filter((value) => typeof value === 'string')
            .join(',')
        : readString(formData, field),
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
  if (outcome.status === 'registered') redirect(`/dash/projects/${outcome.id}?saved=1`);
  return outcome;
};

/** 実績を編集し、同じ画面へ移る。先に書き換えられていたら、入力を残して知らせる（FR-042） */
export const editProject = async (
  _state: ProjectFormResult | null,
  formData: FormData,
): Promise<ProjectFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const id = parseProjectId(readString(formData, PROJECT_ID_FIELD));
  if (id === null) redirect('/dash/projects');

  const outcome = await editProjectUseCase(
    await createProjectDeps(),
    author,
    id,
    readValues(formData),
    {
      openedUpdatedAt: readString(formData, OPENED_UPDATED_AT_FIELD),
      now: new Date().toISOString(),
    },
  );
  if (outcome.status === 'saved') redirect(`/dash/projects/${id}?saved=1`);
  if (outcome.status === 'not-found') redirect('/dash/projects');
  return outcome;
};

/** 実績を削除し、一覧の画面へ移る。確認の画面（`/dash/projects/{id}/delete`）のフォームが呼ぶ */
export const deleteProject = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const id = parseProjectId(readString(formData, PROJECT_ID_FIELD));
  if (id === null) redirect('/dash/projects');

  const outcome = await deleteProjectUseCase((await createProjectDeps()).projects, author, id);
  if (outcome.status === 'forbidden') return outcome;
  redirect('/dash/projects?deleted=1');
};
