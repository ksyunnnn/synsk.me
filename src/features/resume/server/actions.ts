'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import {
  addResumeRows as addResumeRowsUseCase,
  type AddResumeRowsOutcome,
} from '@/features/resume/application/add-resume-rows';
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
import { regenerateResumeUrl as regenerateResumeUrlUseCase } from '@/features/resume/application/regenerate-resume-url';
import {
  isResumeRowKind,
  isResumeStatus,
  type EditTimes,
  SELECTION_KEY_OF_KIND,
  type ResumeId,
  type ResumeStatus,
} from '@/features/resume/domain/resume';
import {
  OPENED_UPDATED_AT_FIELD,
  OVERRIDE_MONTHS_FIELD,
  OVERRIDE_NAME_FIELD,
  OVERRIDE_YEARS_FIELD,
  RESUME_CAREER_FIELDS,
  RESUME_EDUCATION_FIELDS,
  RESUME_UID_FIELD,
  RESUME_PROJECT_FIELDS,
  RESUME_SETTINGS_FIELDS,
  ROW_KIND_FIELD,
  ROW_UID_FIELD,
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
import {
  createResumeRepository,
  findResumeRowId,
  limitedResumeUrl,
} from '@/features/resume/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
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

/** 送られた uid が指す職務経歴書。無ければ一覧へ移す。redirect 先の URL は uid で作る */
const readResume = async (formData: FormData) => {
  const resumes = await createResumeRepository();
  const uid = readString(formData, RESUME_UID_FIELD);
  const id = await findIdByUid(resumes, uid);
  if (id === null) redirect('/dash/resumes');
  return { resumes, id, uid };
};

type ResumeTarget = { id: ResumeId; uid: string };

/** 職務経歴書を作る。限定公開用は移らず、URL を同じ画面に返す */
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
  if (outcome.audience !== 'limited') redirect(`/dash/resumes/${outcome.uid}?saved=1`);
  return {
    status: 'created',
    uid: outcome.uid,
    updatedAt: outcome.updatedAt,
    audience: outcome.audience,
    url: await limitedResumeUrl(outcome.slug),
  };
};

/** 書き込みの結果を画面に返す形にする。保存したら設定の画面へ移す */
const finish = <V, E>({ uid }: ResumeTarget, outcome: EditOutcome<V, E>) => {
  if (outcome.status === 'saved') redirect(`/dash/resumes/${uid}?saved=1`);
  if (outcome.status === 'not-found') redirect(`/dash/resumes/${uid}`);
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
  const { resumes, ...target } = await readResume(formData);
  return finish(
    target,
    await editResumeSettingsUseCase(
      resumes,
      author,
      target.id,
      readValues(formData, RESUME_SETTINGS_FIELDS),
      readTimes(formData),
    ),
  );
};

export type ResumeStatusResult =
  | EditOutcome<{ status: string }, { status?: FieldError }>
  /** 移らずに切り替えた。画面に残す、切り替えた後の状態と更新日時 */
  | { status: 'changed'; resumeStatus: ResumeStatus; updatedAt: string };

/** 状態を書き、書いた状態と更新日時を返す。保存できなければ `finish` と同じ形にする */
const writeStatus = async (formData: FormData): Promise<ResumeStatusResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { resumes, ...target } = await readResume(formData);
  const status = readString(formData, STATUS_FIELD);
  const times = readTimes(formData);
  const outcome = await changeResumeStatusUseCase(resumes, author, target.id, status, times);
  if (outcome.status === 'saved' && isResumeStatus(status)) {
    return { status: 'changed', resumeStatus: status, updatedAt: times.now };
  }
  return finish(target, outcome);
};

/** 下書きか、訪問者に見せるかを切り替え、設定の画面へ移す */
export const changeResumeStatus = async (
  _state: ResumeStatusResult | null,
  formData: FormData,
): Promise<ResumeStatusResult> => {
  const result = await writeStatus(formData);
  if (result.status === 'changed') {
    redirect(`/dash/resumes/${readString(formData, RESUME_UID_FIELD)}?saved=1`);
  }
  return result;
};

/**
 * 下書きか、訪問者に見せるかを切り替え、同じ画面に留まる。作成の画面が使い、作った後の
 * 知らせと URL を示したままにする
 */
export const changeResumeStatusInPlace = async (
  _state: ResumeStatusResult | null,
  formData: FormData,
): Promise<ResumeStatusResult> => writeStatus(formData);

export type RegenerateResumeUrlResult = EditOutcome<Record<string, never>, Record<string, never>>;

/** 限定公開用の URL を出し直し、設定の画面へ移す（FR-040） */
export const regenerateResumeUrl = async (
  _state: RegenerateResumeUrlResult | null,
  formData: FormData,
): Promise<RegenerateResumeUrlResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { resumes, ...target } = await readResume(formData);
  const outcome = await regenerateResumeUrlUseCase(resumes, author, target.id, readTimes(formData));
  if (outcome.status === 'saved') redirect(`/dash/resumes/${target.uid}?regenerated=1`);
  return finish(target, outcome);
};

/** 送られた uid が指す写した行。行が無いか、その職務経歴書に属さなければ設定の画面へ移す */
const readTarget = async (formData: FormData, kind: 'careers' | 'projects' | 'educations') => {
  const { resumes, ...resume } = await readResume(formData);
  const rowId = await findResumeRowId(
    resumes,
    resume.id,
    kind,
    readString(formData, ROW_UID_FIELD),
  );
  if (rowId === null) redirect(`/dash/resumes/${resume.uid}`);
  return { resumes, resume, row: { id: resume.id, rowId } };
};

export type AddResumeRowsResult = AddResumeRowsOutcome;

/**
 * 作ったあとに、元の職歴・実績・学歴から選んだ行を足し、設定の画面へ移す（FR-041）。
 * 選んだ id は種類ごとに作成と同じ名前（`SELECTION_FIELDS`）で送る
 */
export const addResumeRows = async (
  _state: AddResumeRowsResult | null,
  formData: FormData,
): Promise<AddResumeRowsResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { resumes, ...target } = await readResume(formData);
  const kind = readString(formData, ROW_KIND_FIELD);
  if (!isResumeRowKind(kind)) redirect(`/dash/resumes/${target.uid}`);
  return finish(
    target,
    await addResumeRowsUseCase(
      resumes,
      author,
      { id: target.id, kind },
      readStrings(formData, SELECTION_FIELDS[SELECTION_KEY_OF_KIND[kind]]),
      readTimes(formData),
    ),
  );
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
  const { resumes, resume, row } = await readTarget(formData, 'careers');
  return finish(
    resume,
    await editResumeCareerUseCase(
      resumes,
      author,
      row,
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
  const { resumes, resume, row } = await readTarget(formData, 'projects');
  return finish(
    resume,
    await editResumeProjectUseCase(
      resumes,
      author,
      row,
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
  const { resumes, resume, row } = await readTarget(formData, 'educations');
  return finish(
    resume,
    await editResumeEducationUseCase(
      resumes,
      author,
      row,
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
  const { resumes, ...target } = await readResume(formData);
  const names = readStrings(formData, OVERRIDE_NAME_FIELD);
  const years = readStrings(formData, OVERRIDE_YEARS_FIELD);
  const months = readStrings(formData, OVERRIDE_MONTHS_FIELD);
  const rows = names.map((name, index) => ({
    name,
    years: years[index] ?? '',
    months: months[index] ?? '',
  }));
  return finish(
    target,
    await editResumeSkillOverridesUseCase(resumes, author, target.id, rows, readTimes(formData)),
  );
};

/** 職務経歴書を削除し、一覧の画面へ移る */
export const deleteResume = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { resumes, id } = await readResume(formData);
  const outcome = await deleteResumeUseCase(resumes, author, id);
  if (outcome.status === 'forbidden') return { status: 'forbidden' };
  redirect('/dash/resumes?deleted=1');
};
