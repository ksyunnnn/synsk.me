import 'server-only';

import { cache } from 'react';
import type { ProjectDeps } from '@/features/project/application/deps';
import { getProjectForEdit as getProjectForEditUseCase } from '@/features/project/application/get-project-for-edit';
import { getVisitorProject as getVisitorProjectUseCase } from '@/features/project/application/get-visitor-project';
import { visitorProjectMediaAccess } from '@/features/project/application/project-media';
import { listProjects as listProjectsUseCase } from '@/features/project/application/list-projects';
import type { Project, ProjectSummary, VisitorProject } from '@/features/project/domain/project';
import { createD1ProjectRepository } from '@/features/project/server/d1-project-repository';
import { requireAuthor } from '@/shared/server/author';
import { parseMediaStorageKey } from '@/shared/domain/media';
import { findIdByUid } from '@/shared/domain/uid';
import { createMediaStorage, respondWithMedia } from '@/shared/server/media-storage';
import { readEnv } from '@/shared/server/env';
import { createD1OrganizationRepository } from '@/shared/server/organization-repository';

/**
 * 実績の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 */

export const createProjectDeps = async (): Promise<ProjectDeps> => {
  const { DB } = await readEnv();
  return {
    projects: createD1ProjectRepository(DB),
    organizations: createD1OrganizationRepository(DB),
    media: await createMediaStorage(),
  };
};

/**
 * 実績の画像を訪問者に配る（FR-030）。`/projects/{slug}/media/{key}` の `route.ts` が呼び、見せて
 * よいかを確かめた結果を共有の `respondWithMedia` に渡す。形の違うキーは D1 を読まずに 404 にする
 */
export const respondWithProjectMedia = async (
  slug: string,
  key: string,
  ifNoneMatch: string | null,
): Promise<Response> => {
  const { projects, media } = await createProjectDeps();
  const access =
    parseMediaStorageKey(key) === null
      ? 'hidden'
      : visitorProjectMediaAccess(await projects.findVisitorBySlug(slug), key);
  const response = await respondWithMedia(media, key, access, ifNoneMatch);
  // 実績の画像は検索エンジンに載せない。画像には meta タグを置けないため、応答のヘッダで伝える
  // （https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag）
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
};

/**
 * 訪問者に見せる実績。無い識別子なら null。ページの本体とメタデータの両方が呼ぶため、
 * 1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const getVisitorProject = cache(async (slug: string): Promise<VisitorProject | null> =>
  getVisitorProjectUseCase((await createProjectDeps()).projects, slug),
);

/** オーナーの一覧。オーナーでなければ 403 */
export const listProjects = async (): Promise<ProjectSummary[]> => {
  await requireAuthor();
  return listProjectsUseCase((await createProjectDeps()).projects);
};

/** オーナーが編集する実績。オーナーでなければ 403。無い uid なら null */
export const getProjectForEdit = async (uid: string): Promise<Project | null> => {
  await requireAuthor();
  const { projects } = await createProjectDeps();
  const id = await findIdByUid(projects, uid);
  return id === null ? null : getProjectForEditUseCase(projects, id);
};

/** 実績の入力でつなげるスキルの選択肢（FR-032）。オーナーでなければ 403 */
export const listSkillOptions = async (): Promise<{ id: number; name: string }[]> => {
  await requireAuthor();
  return (await createProjectDeps()).projects.listSkillOptions();
};

/*
 * 以下は `src/proxy.ts` が描画の前に呼ぶ。題や組織名を読まず、有無だけを返す
 */

/** 訪問者に見せる実績がある識別子か。`getVisitorProject` が null を返さない識別子と一致する */
export const hasProjectSlug = async (slug: string): Promise<boolean> =>
  (await createProjectDeps()).projects.hasSlug(slug);

/** オーナーが編集できる実績がある uid か。`getProjectForEdit` が null を返さない uid と一致する */
export const hasProjectUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createProjectDeps()).projects, uid)) !== null;
