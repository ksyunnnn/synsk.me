'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteSkill as deleteSkillUseCase } from '@/features/skill/application/delete-skill';
import { editSkill as editSkillUseCase } from '@/features/skill/application/edit-skill';
import { registerSkill as registerSkillUseCase } from '@/features/skill/application/register-skill';
import {
  SKILL_FIELDS,
  SKILL_UID_FIELD,
  type DeleteSkillResult,
  type SkillFormResult,
} from '@/features/skill/domain/skill';
import { createSkillRepository } from '@/features/skill/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';
import { RETURN_QUERY_FIELD } from '@/shared/domain/search-param';
import { routes } from '@/shared/routes';

/**
 * スキルのフォームが呼ぶ Server Action。何より先にオーナーであることを確かめる（ADR-0036）。
 * オーナーでなければ、入力した値を返さない
 */

/** フォームの uid が指すスキルの id。無い uid なら null。オーナーの確認の後に呼ぶ */
const resolveSkill = async (formData: FormData) => {
  const skills = await createSkillRepository();
  const uid = readString(formData, SKILL_UID_FIELD);
  const id = await findIdByUid(skills, uid);
  return { skills, uid, id };
};

export const registerSkill = async (
  _state: SkillFormResult | null,
  formData: FormData,
): Promise<SkillFormResult> => {
  const outcome = await registerSkillUseCase(
    await createSkillRepository(),
    await getCurrentAuthor(),
    readValues(formData, SKILL_FIELDS),
  );
  if (outcome.status === 'registered') redirect(routes.dash.skills.selected(outcome.uid, 'saved'));
  return outcome;
};

export const editSkill = async (
  _state: SkillFormResult | null,
  formData: FormData,
): Promise<SkillFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { skills, id } = await resolveSkill(formData);
  if (id === null) redirect(routes.dash.skills.list);
  const outcome = await editSkillUseCase(skills, author, id, readValues(formData, SKILL_FIELDS));
  // 保存した 1 件を選んだ一覧へ戻る（#366 の明文化）。更新日時を持たないので、印の値に保存した
  // 時刻を入れ、画面が保存のたびに知らせとフォームを置き直せるようにする
  if (outcome.status === 'saved')
    redirect(
      routes.dash.skills.selected(
        readString(formData, SKILL_UID_FIELD),
        'saved',
        String(Date.now()),
        readString(formData, RETURN_QUERY_FIELD),
      ),
    );
  if (outcome.status === 'not-found') redirect(routes.dash.skills.list);
  return outcome;
};

/** スキルを消し、一覧の画面へ移る。消せなければ、確認の画面に理由を返す */
export const deleteSkill = async (
  _state: DeleteSkillResult | null,
  formData: FormData,
): Promise<DeleteSkillResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { skills, id } = await resolveSkill(formData);
  if (id === null) redirect(routes.dash.skills.list);
  const outcome = await deleteSkillUseCase(skills, author, id);
  if (outcome.status === 'forbidden' || outcome.status === 'has-children') return outcome;
  redirect(`${routes.dash.skills.list}?deleted=1`);
};
