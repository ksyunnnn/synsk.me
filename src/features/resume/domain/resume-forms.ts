import {
  type ResumeAudience,
  type ResumeCareer,
  type ResumeCareerContent,
  type ResumeEducation,
  type ResumeEducationContent,
  type ResumeProject,
  type ResumeProjectContent,
  type ResumeSkillOverride,
  type ResumeStatus,
} from '@/features/resume/domain/resume';
import type { EditOutcome } from '@/features/resume/domain/edit-outcome';
import { MAX_COPIED_ROWS } from '@/features/resume/domain/build-resume';
import { emptyToNull } from '@/shared/domain/empty-to-null';
import { toPeriod, type Period, toPeriodFieldError } from '@/shared/domain/period';
import { isWebUrl } from '@/shared/domain/web-url';
import { isProjectKind } from '@/shared/domain/project-kind';
import { normalizeNewlines } from '@/shared/domain/newlines';

/**
 * 職務経歴書の管理画面の入力の名前と、入力を保存する内容に読み替える決まり
 * （specs/002-resume/contracts/dash.md）。秘匿化するかどうかの入力は持たない（FR-031）
 */

/** 職務経歴書と写した行は uid で指す。主キーはフォームに出さない（src/shared/domain/uid.ts） */
export const RESUME_UID_FIELD = 'resumeUid';
export const ROW_UID_FIELD = 'rowUid';
export const OPENED_UPDATED_AT_FIELD = 'openedUpdatedAt';

export type FieldError = 'missing' | 'invalid' | 'ended-before-started';

type Parsed<F extends string, C> =
  { ok: true; content: C } | { ok: false; errors: Partial<Record<F, FieldError>> };

const readPeriod = <F extends string>(
  values: { startedOn: string; endedOn: string },
  errors: Partial<Record<F | 'startedOn' | 'endedOn', FieldError>>,
): Period | null => {
  const result = toPeriod(values.startedOn, values.endedOn);
  if (result.ok) return result.period;
  const [field, reason] = toPeriodFieldError(result.error, values.startedOn);
  errors[field] = reason;
  return null;
};

const readUrl = <F extends string>(
  value: string,
  errors: Partial<Record<F | 'url', FieldError>>,
): string | null => {
  const url = emptyToNull(value)?.trim() ?? null;
  if (url !== null && !isWebUrl(url)) errors.url = 'invalid';
  return url;
};

/* 作成（contracts/dash.md の `createResume`） */

export const SELECTION_FIELDS = {
  careerIds: 'careerIds',
  projectIds: 'projectIds',
  educationIds: 'educationIds',
} as const;

export type CreateResumeFormValues = {
  title: string;
  /** 空なら限定公開用（FR-003） */
  audience: string;
  /** 限定公開用の期限。空なら期限なし（plan.md の U9 の仮の形） */
  expires: string;
  careerIds: string[];
  projectIds: string[];
  educationIds: string[];
};

export type CreateResumeField = 'title' | 'audience' | 'expires' | 'selection';
export type CreateResumeError = FieldError | 'public-not-supported' | 'source-missing' | 'too-many';

export type CreateResumeFormResult =
  /** 作った。`url` は限定公開用の URL（`/resume/{slug}`）。公開用は null */
  | {
      status: 'created';
      /** 作った職務経歴書の uid。設定の画面の URL とフォームに使う */
      uid: string;
      updatedAt: string;
      audience: ResumeAudience;
      url: string | null;
    }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<CreateResumeField, CreateResumeError>>;
      values: CreateResumeFormValues;
    };

/* 作ったあとに足す（contracts/dash.md の `addResumeRows`、FR-041）。選んだ id は種類ごとに
 * `SELECTION_FIELDS` の名前で送る */

/** 足す写した行の種類（careers・projects・educations） */
export const ROW_KIND_FIELD = 'rowKind';

export type AddResumeRowsError =
  'missing' | 'invalid' | 'source-missing' | 'already-copied' | 'public-not-supported' | 'too-many';

/** 足すときの誤り。選択の 1 つの項目だけを持つ */
export type AddResumeRowsErrors = { selection?: AddResumeRowsError };

/** 設定（題と期限）の入力の名前 */
export const RESUME_SETTINGS_FIELDS = ['title', 'expires'] as const;
export type ResumeSettingsField = (typeof RESUME_SETTINGS_FIELDS)[number];

export const STATUS_FIELD = 'status';

/* 写した職歴 */

export const RESUME_CAREER_FIELDS = [
  'organizationName',
  'role',
  'startedOn',
  'endedOn',
  'description',
  'url',
] as const;
export type ResumeCareerField = (typeof RESUME_CAREER_FIELDS)[number];
export type ResumeCareerFormValues = Record<ResumeCareerField, string>;

export const toResumeCareerFormValues = (career: ResumeCareer): ResumeCareerFormValues => ({
  organizationName: career.organizationName,
  role: career.role,
  startedOn: career.period.startedOn,
  endedOn: career.period.endedOn ?? '',
  description: career.description ?? '',
  url: career.url ?? '',
});

export const parseResumeCareer = (
  values: ResumeCareerFormValues,
): Parsed<ResumeCareerField, ResumeCareerContent> => {
  const errors: Partial<Record<ResumeCareerField, FieldError>> = {};
  if (values.organizationName.trim() === '') errors.organizationName = 'missing';
  if (values.role.trim() === '') errors.role = 'missing';
  const period = readPeriod(values, errors);
  const url = readUrl(values.url, errors);
  if (Object.keys(errors).length > 0 || period === null) return { ok: false, errors };
  return {
    ok: true,
    content: {
      organizationName: values.organizationName.trim(),
      role: values.role.trim(),
      period,
      description: emptyToNull(normalizeNewlines(values.description)),
      url,
    },
  };
};

/* 写した実績 */

export const RESUME_PROJECT_FIELDS = [
  'organizationName',
  'kind',
  'title',
  'startedOn',
  'endedOn',
  'description',
  'url',
  'skills',
] as const;
export type ResumeProjectField = (typeof RESUME_PROJECT_FIELDS)[number];
export type ResumeProjectFormValues = Record<ResumeProjectField, string>;

/** スキルの名前は 1 行に 1 つ */
export const toResumeProjectFormValues = (project: ResumeProject): ResumeProjectFormValues => ({
  organizationName: project.organizationName,
  kind: project.kind,
  title: project.title,
  startedOn: project.period.startedOn,
  endedOn: project.period.endedOn ?? '',
  description: project.description ?? '',
  url: project.url ?? '',
  skills: project.skills.join('\n'),
});

export const parseResumeProject = (
  values: ResumeProjectFormValues,
): Parsed<ResumeProjectField, ResumeProjectContent> => {
  const errors: Partial<Record<ResumeProjectField, FieldError>> = {};
  if (values.organizationName.trim() === '') errors.organizationName = 'missing';
  if (!isProjectKind(values.kind)) errors.kind = 'invalid';
  if (values.title.trim() === '') errors.title = 'missing';
  const period = readPeriod(values, errors);
  const url = readUrl(values.url, errors);
  const skills = [
    ...new Set(
      normalizeNewlines(values.skills)
        .split('\n')
        .map((name) => name.trim())
        .filter((name) => name !== ''),
    ),
  ];
  // スキルは 1 つごとに D1 の文を 1 つ積む。写すときと同じ上限で止める（research.md の R15）
  if (skills.length > MAX_COPIED_ROWS) errors.skills = 'invalid';
  if (Object.keys(errors).length > 0 || period === null || !isProjectKind(values.kind)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    content: {
      organizationName: values.organizationName.trim(),
      kind: values.kind,
      title: values.title.trim(),
      period,
      description: emptyToNull(normalizeNewlines(values.description)),
      url,
      skills,
    },
  };
};

/* 写した学歴 */

export const RESUME_EDUCATION_FIELDS = [
  'school',
  'department',
  'startedOn',
  'endedOn',
  'remarks',
] as const;
export type ResumeEducationField = (typeof RESUME_EDUCATION_FIELDS)[number];
export type ResumeEducationFormValues = Record<ResumeEducationField, string>;

export const toResumeEducationFormValues = (
  education: ResumeEducation,
): ResumeEducationFormValues => ({
  school: education.school,
  department: education.department ?? '',
  startedOn: education.period.startedOn,
  endedOn: education.period.endedOn ?? '',
  remarks: education.remarks ?? '',
});

export const parseResumeEducation = (
  values: ResumeEducationFormValues,
): Parsed<ResumeEducationField, ResumeEducationContent> => {
  const errors: Partial<Record<ResumeEducationField, FieldError>> = {};
  if (values.school.trim() === '') errors.school = 'missing';
  const period = readPeriod(values, errors);
  if (Object.keys(errors).length > 0 || period === null) return { ok: false, errors };
  return {
    ok: true,
    content: {
      school: values.school.trim(),
      department: emptyToNull(values.department)?.trim() ?? null,
      period,
      remarks: emptyToNull(normalizeNewlines(values.remarks)),
    },
  };
};

/* 写した経験年数の上書き（FR-028）。スキルごとに年と月、または空 */

export const OVERRIDE_NAME_FIELD = 'overrideName';
export const OVERRIDE_YEARS_FIELD = 'overrideYears';
export const OVERRIDE_MONTHS_FIELD = 'overrideMonths';

export type SkillOverrideFormRow = { name: string; years: string; months: string };

const NON_NEGATIVE_INTEGER = /^\d{1,3}$/;

/**
 * 行ごとの年と月を月数にする。年と月の両方が空の行は上書きなし。月は 0〜11。
 * 同じスキルの名前は 1 行だけ受け取る（`resume_skill_override` はスキルの名前ごとに 1 行）。
 * 上書きは 1 つごとに D1 の文を 1 つ積むため、写すときと同じ上限で止める（research.md の R15）。
 * 誤りのある行の位置を返す
 */
export const parseSkillOverrides = (
  rows: SkillOverrideFormRow[],
): { ok: true; overrides: ResumeSkillOverride[] } | { ok: false; invalidRows: number[] } => {
  const overrides: ResumeSkillOverride[] = [];
  const invalidRows: number[] = [];
  const names = new Set<string>();
  rows.forEach((row, index) => {
    const name = row.name.trim();
    if (names.has(name)) {
      invalidRows.push(index);
      return;
    }
    names.add(name);
    const years = row.years.trim();
    const months = row.months.trim();
    if (years === '' && months === '') return;
    const y = years === '' ? 0 : NON_NEGATIVE_INTEGER.test(years) ? Number(years) : NaN;
    const m = months === '' ? 0 : NON_NEGATIVE_INTEGER.test(months) ? Number(months) : NaN;
    if (
      Number.isNaN(y) ||
      Number.isNaN(m) ||
      m > 11 ||
      name === '' ||
      overrides.length >= MAX_COPIED_ROWS
    ) {
      invalidRows.push(index);
      return;
    }
    overrides.push({ skillName: name, months: y * 12 + m });
  });
  return invalidRows.length > 0 ? { ok: false, invalidRows } : { ok: true, overrides };
};

/*
 * 管理画面の Server Action（src/features/resume/server/actions.ts）が返す結果
 */

export type ResumeSettingsValues = Record<ResumeSettingsField, string>;

export type ResumeSettingsResult = EditOutcome<
  ResumeSettingsValues,
  Partial<Record<ResumeSettingsField, FieldError>>
>;

export type ResumeStatusResult =
  | EditOutcome<{ status: string }, { status?: FieldError }>
  /** 移らずに切り替えた。画面に残す、切り替えた後の状態と更新日時 */
  | { status: 'changed'; resumeStatus: ResumeStatus; updatedAt: string };

export type RegenerateResumeUrlResult = EditOutcome<Record<string, never>, Record<string, never>>;

export type ResumeCareerResult = EditOutcome<
  ResumeCareerFormValues,
  Partial<Record<ResumeCareerField, FieldError>>
>;

export type ResumeProjectResult = EditOutcome<
  ResumeProjectFormValues,
  Partial<Record<ResumeProjectField, FieldError>>
>;

export type ResumeEducationResult = EditOutcome<
  ResumeEducationFormValues,
  Partial<Record<ResumeEducationField, FieldError>>
>;

export type ResumeSkillOverridesResult = EditOutcome<
  SkillOverrideFormRow[],
  { invalidRows: number[] }
>;
