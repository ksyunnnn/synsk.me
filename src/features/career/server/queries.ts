import 'server-only';

import type { CareerDeps } from '@/features/career/application/deps';
import { getCareerForEdit as getCareerForEditUseCase } from '@/features/career/application/get-career-for-edit';
import { listCareers as listCareersUseCase } from '@/features/career/application/list-careers';
import type { Career, CareerSummary } from '@/features/career/domain/career';
import { createD1CareerRepository } from '@/features/career/server/d1-career-repository';
import { requireAuthor } from '@/shared/server/author';
import { findIdByUid } from '@/shared/domain/uid';
import { readEnv } from '@/shared/server/env';
import { createD1OrganizationRepository } from '@/shared/server/organization-repository';

/** 職歴の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030） */

export const createCareerDeps = async (): Promise<CareerDeps> => {
  const { DB } = await readEnv();
  return {
    careers: createD1CareerRepository(DB),
    organizations: createD1OrganizationRepository(DB),
  };
};

/** 作り手の一覧。作り手でなければ 403 */
export const listCareers = async (): Promise<CareerSummary[]> => {
  await requireAuthor();
  return listCareersUseCase((await createCareerDeps()).careers);
};

/** 作り手が編集する職歴。作り手でなければ 403。無い uid なら null */
export const getCareerForEdit = async (uid: string): Promise<Career | null> => {
  await requireAuthor();
  const { careers } = await createCareerDeps();
  const id = await findIdByUid(careers, uid);
  return id === null ? null : getCareerForEditUseCase(careers, id);
};

/** `src/proxy.ts` が呼ぶ。職歴がある uid か */
export const hasCareerUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createCareerDeps()).careers, uid)) !== null;
