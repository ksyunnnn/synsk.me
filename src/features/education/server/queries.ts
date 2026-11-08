import 'server-only';

import type { Education } from '@/features/education/domain/education';
import type { EducationRepository } from '@/features/education/domain/education-repository';
import { createD1EducationRepository } from '@/features/education/server/d1-education-repository';
import { parseUid } from '@/shared/domain/uid';
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

/** URL とフォームの uid が指す学歴の id。形の違う値は D1 を読まずに null */
export const findEducationId = async (educations: EducationRepository, uid: string) => {
  const parsed = parseUid(uid);
  return parsed === null ? null : educations.findIdByUid(parsed);
};

/** 作り手が編集する学歴。作り手でなければ 403。無い uid なら null */
export const getEducationForEdit = async (uid: string): Promise<Education | null> => {
  await requireAuthor();
  const educations = await createEducationRepository();
  const id = await findEducationId(educations, uid);
  return id === null ? null : educations.findById(id);
};

/** `src/proxy.ts` が呼ぶ。学歴がある uid か */
export const hasEducationUid = async (uid: string): Promise<boolean> =>
  (await findEducationId(await createEducationRepository(), uid)) !== null;
