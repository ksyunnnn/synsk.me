import 'server-only';

import type { CareerDeps } from '@/features/career/application/deps';
import { getCareerForEdit as getCareerForEditUseCase } from '@/features/career/application/get-career-for-edit';
import {
  listCareerProjects,
  type CareerProjects,
} from '@/features/career/application/list-career-projects';
import { listCareers as listCareersUseCase } from '@/features/career/application/list-careers';
import type { Career, CareerSummary } from '@/features/career/domain/career';
import { createD1CareerRepository } from '@/features/career/server/d1-career-repository';
import { isImageFile, toStorageKey } from '@/shared/domain/media-image';
import { getCurrentAuthor, requireAuthor } from '@/shared/server/author';
import { findIdByUid } from '@/shared/domain/uid';
import { readEnv } from '@/shared/server/env';
import { createR2MediaStorage, type StoredMedia } from '@/shared/server/media-storage';
import { createD1OrganizationRepository } from '@/shared/server/organization-repository';

/** 職歴の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030） */

export const createCareerDeps = async (): Promise<CareerDeps> => {
  const env = await readEnv();
  return {
    careers: createD1CareerRepository(env.DB),
    organizations: createD1OrganizationRepository(env.DB),
    images: createR2MediaStorage(env.NOTE_IMAGES),
  };
};

/**
 * オーナーが見る職歴の画像。オーナーでなければ `forbidden`。その職歴の画像でなければ null。
 * route handler が呼ぶため、`forbidden()` で投げずに値で返す。訪問者に職歴の画像を配る経路は、
 * 職歴を訪問者に見せる画面（005 の一覧）が持つ
 */
export const getOwnerCareerImage = async (
  uid: string,
  file: string,
): Promise<StoredMedia | null | 'forbidden'> => {
  if (!(await getCurrentAuthor())) return 'forbidden';
  if (!isImageFile(file)) return null;
  const { careers } = await createCareerDeps();
  const id = await findIdByUid(careers, uid);
  if (id === null) return null;
  const key = await careers.findOwnerImage(id, toStorageKey('careers', file));
  return key === null ? null : createR2MediaStorage((await readEnv()).NOTE_IMAGES).get(key);
};

/** オーナーの一覧。オーナーでなければ 403 */
export const listCareers = async (): Promise<CareerSummary[]> => {
  await requireAuthor();
  return listCareersUseCase((await createCareerDeps()).careers);
};

/** オーナーが編集する職歴。オーナーでなければ 403。無い uid なら null */
export const getCareerForEdit = async (uid: string): Promise<Career | null> => {
  await requireAuthor();
  const { careers } = await createCareerDeps();
  const id = await findIdByUid(careers, uid);
  return id === null ? null : getCareerForEditUseCase(careers, id);
};

/**
 * 管理画面に出す、職歴の実績とスキル（FR-017・FR-035）。サイトに載せない実績も含める。
 * オーナーでなければ 403
 */
export const getCareerProjectsForEdit = async (career: Career): Promise<CareerProjects> => {
  await requireAuthor();
  return listCareerProjects((await createCareerDeps()).careers, career, 'all');
};

/** `src/proxy.ts` が呼ぶ。職歴がある uid か */
export const hasCareerUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createCareerDeps()).careers, uid)) !== null;
