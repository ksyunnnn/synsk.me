import {
  isResumeProjectKind,
  type ResumeCareer,
  type ResumeCareerContent,
  type ResumeEducation,
  type ResumeEducationContent,
  type ResumeProject,
  type ResumeProjectContent,
  type ResumeSkillOverride,
} from '@/features/resume/domain/resume';
import { toPeriod, type Period } from '@/shared/domain/period';
import { isWebUrl } from '@/shared/domain/web-url';

/**
 * 職務経歴書の管理画面の入力の名前と、入力を保存する内容に読み替える決まり
 * （specs/002-resume/contracts/dash.md）。秘匿化するかどうかの入力は持たない（FR-031）
 */

export const RESUME_ID_FIELD = 'resumeId';
export const ROW_ID_FIELD = 'rowId';
export const OPENED_UPDATED_AT_FIELD = 'openedUpdatedAt';

export type FieldError = 'missing' | 'invalid' | 'ended-before-started';

const emptyToNull = (value: string) => (value.trim() === '' ? null : value);
const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, '\n');

type Parsed<F extends string, C> =
  { ok: true; content: C } | { ok: false; errors: Partial<Record<F, FieldError>> };

const readPeriod = <F extends string>(
  values: { startedOn: string; endedOn: string },
  errors: Partial<Record<F | 'startedOn' | 'endedOn', FieldError>>,
): Period | null => {
  const result = toPeriod(values.startedOn, values.endedOn);
  if (result.ok) return result.period;
  if (result.error === 'invalid-started-on')
    errors.startedOn = values.startedOn === '' ? 'missing' : 'invalid';
  else if (result.error === 'invalid-ended-on') errors.endedOn = 'invalid';
  else errors.endedOn = 'ended-before-started';
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
export type CreateResumeError = FieldError | 'public-not-supported' | 'source-missing';

export type CreateResumeFormResult =
  /** 作った。限定公開用の鍵を含む URL は、この結果の中でだけ示す（research.md の R5） */
  | { status: 'created'; id: number; url: string | null }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<CreateResumeField, CreateResumeError>>;
      values: CreateResumeFormValues;
    };

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
  if (!isResumeProjectKind(values.kind)) errors.kind = 'invalid';
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
  if (Object.keys(errors).length > 0 || period === null || !isResumeProjectKind(values.kind)) {
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
 * 誤りのある行の位置を返す
 */
export const parseSkillOverrides = (
  rows: SkillOverrideFormRow[],
): { ok: true; overrides: ResumeSkillOverride[] } | { ok: false; invalidRows: number[] } => {
  const overrides: ResumeSkillOverride[] = [];
  const invalidRows: number[] = [];
  rows.forEach((row, index) => {
    const years = row.years.trim();
    const months = row.months.trim();
    if (years === '' && months === '') return;
    const y = years === '' ? 0 : NON_NEGATIVE_INTEGER.test(years) ? Number(years) : NaN;
    const m = months === '' ? 0 : NON_NEGATIVE_INTEGER.test(months) ? Number(months) : NaN;
    if (Number.isNaN(y) || Number.isNaN(m) || m > 11 || row.name.trim() === '') {
      invalidRows.push(index);
      return;
    }
    overrides.push({ skillName: row.name, months: y * 12 + m });
  });
  return invalidRows.length > 0 ? { ok: false, invalidRows } : { ok: true, overrides };
};
