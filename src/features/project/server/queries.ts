import 'server-only';

import { cache } from 'react';
import type { ProjectDeps } from '@/features/project/application/deps';
import { getProjectForEdit as getProjectForEditUseCase } from '@/features/project/application/get-project-for-edit';
import { getVisitorProject as getVisitorProjectUseCase } from '@/features/project/application/get-visitor-project';
import { listProjects as listProjectsUseCase } from '@/features/project/application/list-projects';
import {
  parseProjectId,
  type Project,
  type ProjectSummary,
  type VisitorProject,
} from '@/features/project/domain/project';
import { createD1ProjectRepository } from '@/features/project/server/d1-project-repository';
import { requireAuthor } from '@/shared/server/author';
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
  };
};

/**
 * 訪問者に見せる実績。無い識別子なら null。ページの本体とメタデータの両方が呼ぶため、
 * 1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const getVisitorProject = cache(async (slug: string): Promise<VisitorProject | null> =>
  getVisitorProjectUseCase((await createProjectDeps()).projects, slug),
);

/** 作り手の一覧。作り手でなければ 403 */
export const listProjects = async (): Promise<ProjectSummary[]> => {
  await requireAuthor();
  return listProjectsUseCase((await createProjectDeps()).projects);
};

/** 作り手が編集する実績。作り手でなければ 403。無い id なら null */
export const getProjectForEdit = async (id: string): Promise<Project | null> => {
  await requireAuthor();
  const projectId = parseProjectId(id);
  return projectId === null
    ? null
    : getProjectForEditUseCase((await createProjectDeps()).projects, projectId);
};

/** 実績の入力でつなげるスキルの選択肢（FR-032）。作り手でなければ 403 */
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

/** 作り手が編集できる実績がある id か。`getProjectForEdit` が null を返さない id と一致する */
export const hasProjectId = async (id: string): Promise<boolean> => {
  const projectId = parseProjectId(id);
  return projectId !== null && (await createProjectDeps()).projects.hasId(projectId);
};
