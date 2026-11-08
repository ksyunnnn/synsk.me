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

/**
 * スキルのフォームが呼ぶ Server Action。何より先にオーナーであることを確かめる（ADR-0036）。
 * オーナーでなければ、入力した値を返さない
 */

export const registerSkill = async (
  _state: SkillFormResult | null,
  formData: FormData,
): Promise<SkillFormResult> => {
  const outcome = await registerSkillUseCase(
    await createSkillRepository(),
    await getCurrentAuthor(),
    readValues(formData, SKILL_FIELDS),
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
  const outcome = await editSkillUseCase(skills, author, id, readValues(formData, SKILL_FIELDS));
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
