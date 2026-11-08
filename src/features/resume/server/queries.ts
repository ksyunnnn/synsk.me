import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';
import { getResumeForEdit as getResumeForEditUseCase } from '@/features/resume/application/get-resume-for-edit';
import {
  getResumePreview as getResumePreviewUseCase,
  getVisitorLimitedResume as getVisitorLimitedResumeUseCase,
} from '@/features/resume/application/get-visitor-resume';
import { listResumeSources as listResumeSourcesUseCase } from '@/features/resume/application/list-resume-sources';
import { listResumes as listResumesUseCase } from '@/features/resume/application/list-resumes';
import { toProfile } from '@/features/resume/domain/profile';
import {
  isResumeRowKind,
  type Resume,
  type ResumeForEdit,
  type ResumeSources,
} from '@/features/resume/domain/resume';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { VisitorResume } from '@/features/resume/domain/visitor-resume';
import { createD1ResumeRepository } from '@/features/resume/server/d1-resume-repository';
import { findIdByUid, parseUid } from '@/shared/domain/uid';
import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';

/**
 * 職務経歴書の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 */

export const createResumeRepository = async (): Promise<ResumeRepository> =>
  createD1ResumeRepository((await readEnv()).DB);

/** プロフィールは写さず、要求のたびに定数と環境変数から作る（FR-036、research.md の R10） */
const readProfile = async () => toProfile((await readEnv()).RESUME_EMAIL);

/** 作り手の一覧。作り手でなければ 403 */
export const listResumes = async (): Promise<Resume[]> => {
  await requireAuthor();
  return listResumesUseCase(await createResumeRepository());
};

/** 作成の画面の選択肢。作り手でなければ 403 */
export const listResumeSources = async (): Promise<ResumeSources> => {
  await requireAuthor();
  return listResumeSourcesUseCase(await createResumeRepository());
};

/**
 * URL とフォームの uid が指す写した行の id。`kind` は経路の名前（careers・projects・educations）。
 * 行が無いか、その職務経歴書に属さなければ null
 */
export const findResumeRowId = async (
  resumes: ResumeRepository,
  id: number,
  kind: string,
  rowUid: string,
) => {
  const parsed = parseUid(rowUid);
  return parsed === null || !isResumeRowKind(kind)
    ? null
    : resumes.findRowIdByUid(id, kind, parsed);
};

/** 作り手が編集する職務経歴書。作り手でなければ 403。無い uid なら null */
export const getResumeForEdit = async (uid: string): Promise<ResumeForEdit | null> => {
  await requireAuthor();
  const resumes = await createResumeRepository();
  const id = await findIdByUid(resumes, uid);
  return id === null ? null : getResumeForEditUseCase(resumes, id);
};

/**
 * 限定公開用の URL（`/resume/{slug}`）。要求の host から作る。URL を知る人は誰でも読めるため、
 * 作り手の画面と Server Action の結果にだけ出す（FR-012・FR-040）
 */
export const limitedResumeUrl = async (slug: string): Promise<string> => {
  const host = (await headers()).get('host') ?? 'synsk.me';
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https';
  return `${scheme}://${host}/resume/${slug}`;
};

/** 訪問者に見せたときの見た目。作り手でなければ 403。無い uid なら null */
export const getResumePreview = async (uid: string): Promise<VisitorResume | null> => {
  await requireAuthor();
  const resumes = await createResumeRepository();
  const id = await findIdByUid(resumes, uid);
  return id === null
    ? null
    : getResumePreviewUseCase(resumes, { id, profile: await readProfile(), now: new Date() });
};

/**
 * 訪問者に見せる限定公開用。条件に合わなければ null。ページの本体とメタデータの両方が呼ぶため、
 * 1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const getVisitorLimitedResume = cache(async (slug: string): Promise<VisitorResume | null> =>
  getVisitorLimitedResumeUseCase(await createResumeRepository(), {
    slug,
    profile: await readProfile(),
    now: new Date(),
  }),
);

/*
 * 以下は `src/proxy.ts` が描画の前に呼ぶ。中身を読まず、有無だけを返す
 */

/** 訪問者に中身を返してよい限定公開用か。`getVisitorLimitedResume` が null を返さない識別子と一致する */
export const hasVisitorResume = async (slug: string): Promise<boolean> =>
  (await (
    await createResumeRepository()
  ).findLimitedIdForVisitor(slug, new Date().toISOString())) !== null;

/** 作り手が編集できる職務経歴書がある uid か */
export const hasResumeUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid(await createResumeRepository(), uid)) !== null;

/**
 * 写した行の画面の URL が指すもののうち、無いもの。職務経歴書が無ければ `resume`、職務経歴書に
 * 属する写した行が無ければ `row`、どちらもあれば null。`kind` は経路の名前（careers・projects・
 * educations）。職務経歴書の id は 1 回だけ引く
 */
export const findMissingResumeRow = async (
  uid: string,
  kind: string,
  rowUid: string,
): Promise<'resume' | 'row' | null> => {
  const resumes = await createResumeRepository();
  const id = await findIdByUid(resumes, uid);
  if (id === null) return 'resume';
  return (await findResumeRowId(resumes, id, kind, rowUid)) === null ? 'row' : null;
};
