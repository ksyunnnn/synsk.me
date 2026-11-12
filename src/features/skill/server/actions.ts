'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteSkill as deleteSkillUseCase } from '@/features/skill/application/delete-skill';
import { editSkill as editSkillUseCase } from '@/features/skill/application/edit-skill';
import { registerSkill as registerSkillUseCase } from '@/features/skill/application/register-skill';
import { SKILL_FIELDS, SKILL_UID_FIELD, type SkillFormResult } from '@/features/skill/domain/skill';
import { createSkillRepository } from '@/features/skill/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';
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
  if (outcome.status === 'registered') redirect(`${routes.dash.skills.list}?saved=1`);
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
  if (outcome.status === 'saved') redirect(`${routes.dash.skills.list}?saved=1`);
  if (outcome.status === 'not-found') redirect(routes.dash.skills.list);
  return outcome;
};

export const deleteSkill = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { skills, id } = await resolveSkill(formData);
  if (id === null) redirect(routes.dash.skills.list);
  const outcome = await deleteSkillUseCase(skills, author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect(`${routes.dash.skills.list}?deleted=1`);
};
