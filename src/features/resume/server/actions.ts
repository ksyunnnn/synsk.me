'use server';

import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { changeResumeStatus as changeResumeStatusUseCase } from '@/features/resume/application/change-resume-status';
import { createResume as createResumeUseCase } from '@/features/resume/application/create-resume';
import { deleteResume as deleteResumeUseCase } from '@/features/resume/application/delete-resume';
import type { EditOutcome } from '@/features/resume/application/edit-outcome';
import {
  editResumeCareer as editResumeCareerUseCase,
  editResumeEducation as editResumeEducationUseCase,
  editResumeProject as editResumeProjectUseCase,
  editResumeSkillOverrides as editResumeSkillOverridesUseCase,
} from '@/features/resume/application/edit-resume-rows';
import { editResumeSettings as editResumeSettingsUseCase } from '@/features/resume/application/edit-resume-settings';
import { parseResumeId, parseResumeRowId, type EditTimes } from '@/features/resume/domain/resume';
import {
  OPENED_UPDATED_AT_FIELD,
  OVERRIDE_MONTHS_FIELD,
  OVERRIDE_NAME_FIELD,
  OVERRIDE_YEARS_FIELD,
  RESUME_CAREER_FIELDS,
  RESUME_EDUCATION_FIELDS,
  RESUME_ID_FIELD,
  RESUME_PROJECT_FIELDS,
  RESUME_SETTINGS_FIELDS,
  ROW_ID_FIELD,
  SELECTION_FIELDS,
  STATUS_FIELD,
  type CreateResumeFormResult,
  type FieldError,
  type ResumeCareerField,
  type ResumeCareerFormValues,
  type ResumeEducationField,
  type ResumeEducationFormValues,
  type ResumeProjectField,
  type ResumeProjectFormValues,
  type ResumeSettingsField,
  type SkillOverrideFormRow,
} from '@/features/resume/domain/resume-forms';
import { createResumeRepository } from '@/features/resume/server/queries';
import { getCurrentAuthor } from '@/shared/server/author';

/**
 * 職務経歴書の管理画面のフォームが呼ぶ Server Action（specs/002-resume/contracts/dash.md）。
 * 何より先に作り手であることを確かめる（ADR-0036）。作り手でなければ、入力した値を返さない
 */

const readString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

const readStrings = (formData: FormData, name: string) =>
  formData.getAll(name).filter((value): value is string => typeof value === 'string');

const readValues = <F extends string>(formData: FormData, fields: readonly F[]) =>
  Object.fromEntries(fields.map((field) => [field, readString(formData, field)])) as Record<
    F,
    string
  >;

const readTimes = (formData: FormData): EditTimes => ({
  openedUpdatedAt: readString(formData, OPENED_UPDATED_AT_FIELD),
  now: new Date().toISOString(),
});

/** 送られた職務経歴書の id。読めなければ一覧へ移す */
const readResumeId = (formData: FormData) => {
  const id = parseResumeId(readString(formData, RESUME_ID_FIELD));
  if (id === null) redirect('/dash/resumes');
  return id;
};

/** 限定公開用の URL。鍵を含むため、作成に成功した応答の中でだけ返す（research.md の R5） */
const limitedUrl = async (slug: string, key: string) => {
  const host = (await headers()).get('host') ?? 'synsk.me';
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https';
  return `${scheme}://${host}/resume/${slug}/${key}`;
};

/** 職務経歴書を作る。限定公開用は移らず、鍵を含む URL を同じ画面に返す */
export const createResume = async (
  _state: CreateResumeFormResult | null,
  formData: FormData,
): Promise<CreateResumeFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const outcome = await createResumeUseCase(await createResumeRepository(), author, {
    title: readString(formData, 'title'),
    audience: readString(formData, 'audience'),
    expires: readString(formData, 'expires'),
    careerIds: readStrings(formData, SELECTION_FIELDS.careerIds),
    projectIds: readStrings(formData, SELECTION_FIELDS.projectIds),
    educationIds: readStrings(formData, SELECTION_FIELDS.educationIds),
  });
  if (outcome.status !== 'created') return outcome;
  if (outcome.key === null) redirect(`/dash/resumes/${outcome.id}?saved=1`);
  return {
    status: 'created',
    id: outcome.id,
    url: await limitedUrl(outcome.slug, outcome.key),
  };
};

/** 書き込みの結果を画面に返す形にする。保存したら設定の画面へ移す */
const finish = <V, E>(id: number, outcome: EditOutcome<V, E>) => {
  if (outcome.status === 'saved') redirect(`/dash/resumes/${id}?saved=1`);
  if (outcome.status === 'not-found') redirect(`/dash/resumes/${id}`);
  return outcome;
};

export type ResumeSettingsResult = EditOutcome<
  Record<ResumeSettingsField, string>,
  Partial<Record<ResumeSettingsField, FieldError>>
>;

/** 題と期限を直す */
export const editResumeSettings = async (
  _state: ResumeSettingsResult | null,
  formData: FormData,
): Promise<ResumeSettingsResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const id = readResumeId(formData);
  return finish(
    id,
    await editResumeSettingsUseCase(
      await createResumeRepository(),
      author,
      id,
      readValues(formData, RESUME_SETTINGS_FIELDS),
      readTimes(formData),
    ),
  );
};

export type ResumeStatusResult = EditOutcome<{ status: string }, { status?: FieldError }>;

/** 下書きか、訪問者に見せるかを切り替える */
export const changeResumeStatus = async (
  _state: ResumeStatusResult | null,
  formData: FormData,
): Promise<ResumeStatusResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const id = readResumeId(formData);
  return finish(
    id,
    await changeResumeStatusUseCase(
      await createResumeRepository(),
      author,
      id,
      readString(formData, STATUS_FIELD),
      readTimes(formData),
    ),
  );
};

/** 写した行の id。読めなければ設定の画面へ移す */
const readTarget = (formData: FormData) => {
  const id = readResumeId(formData);
  const rowId = parseResumeRowId(readString(formData, ROW_ID_FIELD));
  if (rowId === null) redirect(`/dash/resumes/${id}`);
  return { id, rowId };
};

export type ResumeCareerResult = EditOutcome<
  ResumeCareerFormValues,
  Partial<Record<ResumeCareerField, FieldError>>
>;

export const editResumeCareer = async (
  _state: ResumeCareerResult | null,
  formData: FormData,
): Promise<ResumeCareerResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const target = readTarget(formData);
  return finish(
    target.id,
    await editResumeCareerUseCase(
      await createResumeRepository(),
      author,
      target,
      readValues(formData, RESUME_CAREER_FIELDS),
      readTimes(formData),
    ),
  );
};

export type ResumeProjectResult = EditOutcome<
  ResumeProjectFormValues,
  Partial<Record<ResumeProjectField, FieldError>>
>;

export const editResumeProject = async (
  _state: ResumeProjectResult | null,
  formData: FormData,
): Promise<ResumeProjectResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const target = readTarget(formData);
  return finish(
    target.id,
    await editResumeProjectUseCase(
      await createResumeRepository(),
      author,
      target,
      readValues(formData, RESUME_PROJECT_FIELDS),
      readTimes(formData),
    ),
  );
};

export type ResumeEducationResult = EditOutcome<
  ResumeEducationFormValues,
  Partial<Record<ResumeEducationField, FieldError>>
>;

export const editResumeEducation = async (
  _state: ResumeEducationResult | null,
  formData: FormData,
): Promise<ResumeEducationResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const target = readTarget(formData);
  return finish(
    target.id,
    await editResumeEducationUseCase(
      await createResumeRepository(),
      author,
      target,
      readValues(formData, RESUME_EDUCATION_FIELDS),
      readTimes(formData),
    ),
  );
};

export type ResumeSkillOverridesResult = EditOutcome<
  SkillOverrideFormRow[],
  { invalidRows: number[] }
>;

/** 写した経験年数の上書きを直す。行はスキルの名前・年・月を同じ順に並べて送る */
export const editResumeSkillOverrides = async (
  _state: ResumeSkillOverridesResult | null,
  formData: FormData,
): Promise<ResumeSkillOverridesResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const id = readResumeId(formData);
  const names = readStrings(formData, OVERRIDE_NAME_FIELD);
  const years = readStrings(formData, OVERRIDE_YEARS_FIELD);
  const months = readStrings(formData, OVERRIDE_MONTHS_FIELD);
  const rows = names.map((name, index) => ({
    name,
    years: years[index] ?? '',
    months: months[index] ?? '',
  }));
  return finish(
    id,
    await editResumeSkillOverridesUseCase(
      await createResumeRepository(),
      author,
      id,
      rows,
      readTimes(formData),
    ),
  );
};

/** 職務経歴書を削除し、一覧の画面へ移る */
export const deleteResume = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const id = readResumeId(formData);
  const outcome = await deleteResumeUseCase(await createResumeRepository(), author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect('/dash/resumes?deleted=1');
};
