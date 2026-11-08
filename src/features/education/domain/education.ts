import type { ActionResult } from '@/shared/domain/action-result';
import { toPeriod, type Period } from '@/shared/domain/period';
import type { Uid } from '@/shared/domain/uid';

/**
 * 学歴の型と決まり（specs/001-career-and-project/spec.md の FR-036・FR-037・FR-039）。
 * 学歴は職務経歴書（002）を通してだけ訪問者に出す。001 は訪問者向けの形を持たない
 */

export type EducationId = number;

export type Education = {
  id: EducationId;
  /** 管理画面の URL とフォームで学歴を指す識別子 */
  uid: Uid;
  school: string;
  department: string | null;
  period: Period;
  remarks: string | null;
};

export type EducationContent = Omit<Education, 'id' | 'uid'>;

export const EDUCATION_FIELDS = [
  'school',
  'department',
  'startedOn',
  'endedOn',
  'remarks',
] as const;
export type EducationField = (typeof EDUCATION_FIELDS)[number];
export type EducationFieldError = 'missing' | 'invalid' | 'ended-before-started';
export type EducationFormValues = Record<EducationField, string>;
export type EducationFormResult = ActionResult<EducationField, EducationFieldError>;

export const EDUCATION_UID_FIELD = 'educationUid';

const emptyToNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** フォームの値を保存する内容に読み替える。学部・終わりの日・備考は空にできる（FR-036） */
export const parseEducationContent = (
  values: EducationFormValues,
):
  | { ok: true; content: EducationContent }
  | { ok: false; errors: Partial<Record<EducationField, EducationFieldError>> } => {
  const errors: Partial<Record<EducationField, EducationFieldError>> = {};
  if (values.school.trim() === '') errors.school = 'missing';
  const period = toPeriod(values.startedOn, values.endedOn);
  if (!period.ok) {
    if (period.error === 'invalid-started-on')
      errors.startedOn = values.startedOn === '' ? 'missing' : 'invalid';
    else if (period.error === 'invalid-ended-on') errors.endedOn = 'invalid';
    else errors.endedOn = 'ended-before-started';
  }
  if (Object.keys(errors).length > 0 || !period.ok) return { ok: false, errors };
  return {
    ok: true,
    content: {
      school: values.school.trim(),
      department: emptyToNull(values.department),
      period: period.period,
      remarks: emptyToNull(values.remarks.replace(/\r\n?/g, '\n')),
    },
  };
};

export const toEducationFormValues = (education?: EducationContent): EducationFormValues => ({
  school: education?.school ?? '',
  department: education?.department ?? '',
  startedOn: education?.period.startedOn ?? '',
  endedOn: education?.period.endedOn ?? '',
  remarks: education?.remarks ?? '',
});
