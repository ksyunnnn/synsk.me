'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { deleteSkill as deleteSkillUseCase } from '@/features/skill/application/delete-skill';
import { editSkill as editSkillUseCase } from '@/features/skill/application/edit-skill';
import { registerSkill as registerSkillUseCase } from '@/features/skill/application/register-skill';
import {
  SKILL_FIELDS,
  SKILL_UID_FIELD,
  type SkillFormResult,
  type SkillFormValues,
} from '@/features/skill/domain/skill';
import { createSkillRepository } from '@/features/skill/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';

/**
 * スキルのフォームが呼ぶ Server Action。何より先に作り手であることを確かめる（ADR-0036）。
 * 作り手でなければ、入力した値を返さない
 */

const readString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

const readValues = (formData: FormData): SkillFormValues =>
  Object.fromEntries(
    SKILL_FIELDS.map((field) => [field, readString(formData, field)]),
  ) as SkillFormValues;

export const registerSkill = async (
  _state: SkillFormResult | null,
  formData: FormData,
): Promise<SkillFormResult> => {
  const outcome = await registerSkillUseCase(
    await createSkillRepository(),
    await getCurrentAuthor(),
    readValues(formData),
  );
  if (outcome.status === 'registered') redirect('/dash/skills?saved=1');
  return outcome;
};

export const editSkill = async (
  _state: SkillFormResult | null,
  formData: FormData,
): Promise<SkillFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const skills = await createSkillRepository();
  const id = await findIdByUid(skills, readString(formData, SKILL_UID_FIELD));
  if (id === null) redirect('/dash/skills');
  const outcome = await editSkillUseCase(skills, author, id, readValues(formData));
  if (outcome.status === 'saved') redirect('/dash/skills?saved=1');
  if (outcome.status === 'not-found') redirect('/dash/skills');
  return outcome;
};

export const deleteSkill = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const skills = await createSkillRepository();
  const id = await findIdByUid(skills, readString(formData, SKILL_UID_FIELD));
  if (id === null) redirect('/dash/skills');
  const outcome = await deleteSkillUseCase(skills, author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect('/dash/skills?deleted=1');
};
