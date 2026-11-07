import 'server-only';

import { parseEducationId, type Education } from '@/features/education/domain/education';
import type { EducationRepository } from '@/features/education/domain/education-repository';
import { createD1EducationRepository } from '@/features/education/server/d1-education-repository';
import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';

/** 学歴の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030） */

export const createEducationRepository = async (): Promise<EducationRepository> =>
  createD1EducationRepository((await readEnv()).DB);

/** 作り手の一覧。作り手でなければ 403 */
export const listEducations = async (): Promise<Education[]> => {
  await requireAuthor();
  return (await createEducationRepository()).list();
};

/** 作り手が編集する学歴。作り手でなければ 403。無い id なら null */
export const getEducationForEdit = async (id: string): Promise<Education | null> => {
  await requireAuthor();
  const educationId = parseEducationId(id);
  return educationId === null ? null : (await createEducationRepository()).findById(educationId);
};

/** `src/proxy.ts` が呼ぶ。学歴がある id か */
export const hasEducationId = async (id: string): Promise<boolean> => {
  const educationId = parseEducationId(id);
  return educationId !== null && (await createEducationRepository()).hasId(educationId);
};
