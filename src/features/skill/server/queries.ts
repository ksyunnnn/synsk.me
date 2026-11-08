import 'server-only';

import { listSkills as listSkillsUseCase } from '@/features/skill/application/list-skills';
import type { Skill, SkillSummary } from '@/features/skill/domain/skill';
import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import { createD1SkillRepository } from '@/features/skill/server/d1-skill-repository';
import { findIdByUid } from '@/shared/domain/uid';
import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';

/** スキルの画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030） */

export const createSkillRepository = async (): Promise<SkillRepository> =>
  createD1SkillRepository((await readEnv()).DB);

/** 作り手の一覧と経験年数。作り手でなければ 403 */
export const listSkills = async (): Promise<SkillSummary[]> => {
  await requireAuthor();
  return listSkillsUseCase(await createSkillRepository(), new Date());
};

/** 作り手が編集するスキル。作り手でなければ 403。無い uid なら null */
export const getSkillForEdit = async (uid: string): Promise<Skill | null> => {
  await requireAuthor();
  const skills = await createSkillRepository();
  const id = await findIdByUid(skills, uid);
  return id === null ? null : skills.findById(id);
};

/** `src/proxy.ts` が呼ぶ。スキルがある uid か */
export const hasSkillUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid(await createSkillRepository(), uid)) !== null;
